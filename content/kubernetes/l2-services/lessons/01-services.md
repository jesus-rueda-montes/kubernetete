---
title: Services
minutes: 12
---

## Qué problema resuelve

Los Pods de un Deployment **van y vienen**: se recrean en cada actualización, cambian de Node y **cambian de IP**. Si tu frontend guardase las IPs de los Pods del backend, dejaría de funcionar en el siguiente despliegue. Además, con 3 réplicas, ¿a cuál le envías cada petición?

Un **Service** da **una dirección estable** (IP y nombre DNS) delante de un grupo de Pods y **reparte el tráfico** entre ellos.

## Analogía

Un Service es como el **número de teléfono de una centralita**: los clientes siempre llaman al mismo número, aunque los empleados que atienden cambien cada día. La centralita pasa cada llamada a uno de los que están disponibles en ese momento.

## Concepto

### Cómo encuentra sus Pods

Un Service usa un **selector** de labels, igual que un Deployment:

- Los Pods que cumplen el selector **y están listos** (*ready*) forman los **endpoints** del Service.
- Kubernetes actualiza esa lista continuamente, en objetos **EndpointSlice**.
- Sin Pods que cumplan el selector, el Service existe pero **no tiene a quién enviar tráfico**.

### Puertos

```yaml
ports:
  - port: 80          # puerto del Service (al que llaman los clientes)
    targetPort: 8080  # puerto del contenedor al que se reenvía
```

Si omites `targetPort`, vale lo mismo que `port`. También puede ser el **nombre** de un puerto del contenedor (`targetPort: http`).

### Tipos de Service

| Tipo | Accesible desde | Cómo |
|---|---|---|
| **ClusterIP** (por defecto) | **Solo dentro** del clúster | Una IP virtual interna. |
| **NodePort** | Fuera, vía `IP-de-cualquier-Node:puerto` | Abre el mismo puerto (por defecto, del rango **30000–32767**) en todos los Nodes. Incluye un ClusterIP. |
| **LoadBalancer** | Fuera, con una IP pública o externa | Pide al proveedor de nube un load balancer que envía tráfico a los NodePorts. Incluye NodePort y ClusterIP. |
| **ExternalName** | Dentro | Un alias DNS (CNAME) hacia un nombre externo; no selecciona Pods. |

Cada tipo **se construye sobre el anterior**: LoadBalancer ⊃ NodePort ⊃ ClusterIP.

Además existen los **headless Services** (`clusterIP: None`): no tienen IP virtual y el DNS devuelve **las IPs de los Pods** directamente. Se usan sobre todo con StatefulSets (nivel 3).

Para exponer **varias aplicaciones HTTP** con un único punto de entrada (por dominio o por ruta) no se crea un LoadBalancer por app: se usa un **Ingress** (nivel 3).

### DNS del clúster

Cada Service recibe un nombre DNS:

```
<servicio>.<namespace>.svc.cluster.local
```

- Desde el **mismo namespace** basta con `<servicio>` (por ejemplo, `http://api`).
- Desde **otro namespace**: `<servicio>.<namespace>` (por ejemplo, `http://api.pagos`) o el nombre completo.

`cluster.local` es el dominio por defecto del clúster; se puede configurar distinto.

## Ejemplo

Un Deployment `api` (Pods con `app: api` escuchando en el 8080) y su Service:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  type: ClusterIP        # por defecto; se podría omitir
  selector:
    app: api             # Pods con esta label (y listos)
  ports:
    - name: http
      protocol: TCP
      port: 80           # los clientes usan api:80
      targetPort: 8080   # el contenedor escucha en 8080
```

```bash
kubectl apply -f api-svc.yaml
kubectl get svc api                       # TYPE ClusterIP, CLUSTER-IP 10.96.x.x
kubectl get endpointslices -l kubernetes.io/service-name=api   # IPs de los Pods detrás

# Lo mismo sin YAML, a partir del Deployment:
kubectl expose deployment api --port=80 --target-port=8080

# Probar desde tu máquina sin exponer nada al exterior:
kubectl port-forward service/api 8080:80  # http://localhost:8080 → Service api:80
```

Desde otro Pod del mismo namespace: `curl http://api` (puerto 80).

## Errores comunes

- **Selector que no coincide** con las labels de los Pods (o un error de mayúsculas): el Service no tiene endpoints y las conexiones fallan. Lo primero que hay que mirar es si tiene endpoints.
- **`targetPort` equivocado**: el Service envía al puerto 80 y la app escucha en el 8080.
- **Pods que no están *ready***: no reciben tráfico aunque estén `Running`. Revisa su readiness probe.
- **Un LoadBalancer por cada microservicio.** Cada uno cuesta dinero; para HTTP es mejor un Ingress.
- **Usar NodePort en producción** como entrada pública: expone puertos altos en todos los Nodes y depende de sus IPs.
- **Llamar a un Service de otro namespace solo por su nombre corto**: hay que añadir el namespace.

## En la entrevista

**«Explica los tipos de Service.»**
ClusterIP (por defecto) da una IP interna solo accesible dentro del clúster. NodePort abre un puerto (30000–32767 por defecto) en todos los Nodes. LoadBalancer pide un load balancer externo al proveedor de nube, que envía tráfico a los NodePorts. ExternalName es un alias DNS hacia un nombre externo. Cada uno de los tres primeros se apoya en el anterior.

**«Un Service no responde. ¿Cómo lo depuras?»**
Compruebo que tiene endpoints (`kubectl get endpointslices` o `kubectl describe svc`). Si no tiene, reviso que el selector coincida con las labels de los Pods y que estén ready. Si tiene, reviso `port` y `targetPort`, y pruebo desde otro Pod por el nombre DNS y con `kubectl port-forward`.

## Resumen

- Un **Service** da **IP y nombre DNS estables** delante de Pods que cambian, y reparte el tráfico.
- Elige Pods por **selector de labels**; solo reciben tráfico los que están **ready** (endpoints).
- **`port`** es el del Service; **`targetPort`**, el del contenedor (por defecto, igual que `port`).
- Tipos: **ClusterIP** (interno, por defecto) ⊂ **NodePort** ⊂ **LoadBalancer**; y **ExternalName**.
- DNS: **`servicio.namespace.svc.cluster.local`**; en el mismo namespace basta con el nombre.
