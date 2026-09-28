---
title: Red, nodos y kubectl debug
minutes: 13
---

## Qué problema resuelve

A veces los Pods están en `Running` y `1/1 READY`, pero la aplicación sigue sin responder: el problema está **entre** las piezas. Puede ser el Service, el DNS, una NetworkPolicy o el Ingress. Otras veces falla un **nodo** entero y arrastra a todos sus Pods.

Y muchas imágenes modernas (*distroless*) no traen shell ni herramientas, así que `kubectl exec` no sirve para investigar. Para eso existe **`kubectl debug`**.

## Analogía

Es como averiguar por qué no llega una carta:

- ¿Existe la **dirección** (el Service) y apunta a una casa habitada (los endpoints)?
- ¿Funciona la **guía de calles** (el DNS)?
- ¿Hay una **barrera** en la calle (una NetworkPolicy)?
- ¿Está en pie el **edificio** (el nodo)?

Y `kubectl debug` es mandar a un **técnico con su maletín** al edificio, porque el inquilino no tiene herramientas.

## Concepto

### Un Service que no responde

Revísalo en este orden:

1. **¿Tiene endpoints?** `kubectl get endpointslices -l kubernetes.io/service-name=web`. Si no hay direcciones, el **selector** del Service no coincide con las **etiquetas** de los Pods, o los Pods no están **Ready** (los que fallan la readiness probe no reciben tráfico).
2. **¿Puertos correctos?** El `targetPort` del Service debe ser el puerto en el que **escucha el contenedor**.
3. **¿Resuelve el DNS?** Desde un Pod: `nslookup web` (mismo namespace) o `web.NAMESPACE.svc.cluster.local`. Si falla todo el DNS, revisa los Pods de **CoreDNS** en `kube-system`.
4. **¿Lo bloquea una NetworkPolicy?** `kubectl get netpol`. Con un *deny* por defecto, hace falta una regla que permita ese tráfico (y el egress al DNS, puerto 53).
5. **¿Y el Ingress?** Que exista el Ingress controller, que la `ingressClassName` sea la correcta y que el Service y el puerto del backend existan.

### Un nodo con problemas

- `kubectl get nodes`: un nodo **NotReady** no acepta Pods nuevos.
- `kubectl describe node NOMBRE`: las **conditions**:
  - `Ready` en `Unknown`: el control plane no sabe nada del nodo desde hace más de **50 segundos** (por defecto). Suele ser el **kubelet** caído o un problema de red.
  - `MemoryPressure`, `DiskPressure`, `PIDPressure`: falta memoria, disco o procesos. El kubelet empieza a **desalojar** (*evict*) Pods.
- Kubernetes pone **taints** automáticos (`node.kubernetes.io/not-ready`, `node.kubernetes.io/unreachable`) y, pasado un tiempo, los Pods se recrean en otros nodos.
- `kubectl top node` y `kubectl top pod` muestran el consumo real (necesitan metrics-server).

### kubectl debug

Tres formas de uso:

- **Contenedor efímero** en un Pod que ya existe: `kubectl debug -it POD --image=busybox --target=app`. Con `--target` ves los procesos del contenedor `app`. Ideal para imágenes distroless o contenedores que ya han fallado.
- **Copia del Pod**: `--copy-to=NOMBRE`, opcionalmente cambiando el comando o la imagen (`--set-image`). No tocas el Pod original.
- **En un nodo**: `kubectl debug node/NOMBRE -it --image=ubuntu` crea un Pod en ese nodo con el sistema de archivos del nodo montado en **`/host`**.

## Ejemplo

```text
$ kubectl get endpointslices -l kubernetes.io/service-name=web
NAME        ADDRESSTYPE   PORTS     ENDPOINTS   AGE
web-8xk2p   IPv4          <unset>   <unset>     10m

$ kubectl describe svc web | grep Selector
Selector:          app=web

$ kubectl get pods --show-labels
NAME                   READY   STATUS    RESTARTS   AGE   LABELS
web-5f7c9d8b6-2mzqt    1/1     Running   0          10m   app=frontend,pod-template-hash=5f7c9d8b6
```

Conclusión: el Service busca `app=web`, pero los Pods tienen `app=frontend`. Sin endpoints, el tráfico no llega a ningún sitio. Se corrige el selector del Service o las etiquetas de la plantilla del Deployment.

```bash
# La imagen es distroless: sin shell. Añadimos un contenedor efímero con herramientas
kubectl debug -it web-5f7c9d8b6-2mzqt --image=busybox --target=web
```

## Errores comunes

- **Service sin endpoints por un selector mal escrito**: es el fallo de red más frecuente. Mira siempre los endpoints primero.
- **Confundir `port` y `targetPort`**: `port` es el del Service; `targetPort`, el del contenedor.
- **Aplicar un deny por defecto de egress y olvidar el DNS**: nada resuelve nombres y todo parece roto.
- **Intentar `kubectl exec -- sh` en una imagen distroless**: no hay shell; usa `kubectl debug`.
- **Reiniciar Pods cuando el problema es el nodo**: se reprograman allí o en nodos igual de saturados. Mira las conditions del nodo.

## En la entrevista

**«Los Pods funcionan, pero el Service no responde. ¿Qué compruebas?»**
Primero los endpoints: si están vacíos, el selector no coincide con las etiquetas o los Pods no están Ready. Después, que `targetPort` sea el puerto del contenedor. Luego la resolución DNS desde otro Pod, las NetworkPolicies y, si entra por fuera, el Ingress y su controlador.

**«¿Cómo depuras un contenedor sin shell?»**
Con `kubectl debug`: un contenedor efímero con una imagen de herramientas en el mismo Pod, usando `--target` para ver sus procesos. O una copia del Pod con `--copy-to`, para no tocar el original.

## Resumen

- Service sin respuesta: **endpoints → targetPort → DNS → NetworkPolicy → Ingress**.
- Sin endpoints = **selector ≠ etiquetas** o Pods **no Ready**.
- Nodo **NotReady**/`Unknown` (más de 50 s sin noticias): kubelet o red. Las **pressures** provocan desalojos.
- **`kubectl debug`**: contenedor efímero (`--target`), copia del Pod (`--copy-to`) o nodo (`node/NOMBRE`, con el disco del nodo en `/host`).
- `kubectl top` necesita metrics-server.
