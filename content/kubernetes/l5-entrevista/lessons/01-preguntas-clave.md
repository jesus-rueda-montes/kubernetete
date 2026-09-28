---
title: Las preguntas que siempre salen
minutes: 15
---

## Qué problema resuelve

En una entrevista de Kubernetes no basta con saber las cosas: hay que **explicarlas en poco tiempo, con orden y con criterio**. Muchas preguntas se repiten en casi todas las empresas. Si llevas preparada una respuesta clara para cada una, te queda energía para las preguntas difíciles.

Esta lección repasa las preguntas más habituales con una **respuesta modelo** de 30-60 segundos, conectando lo que has visto en todo el itinerario.

## Analogía

Es como preparar un examen oral con las **preguntas de años anteriores**: no memorizas frases, sino la **estructura** de cada respuesta (qué es → para qué sirve → cómo funciona → un matiz que demuestra experiencia).

## Concepto

### La estructura de una buena respuesta

1. **Definición** en una frase.
2. **Para qué sirve** (el problema que resuelve).
3. **Cómo funciona** por dentro, sin entrar en todos los detalles.
4. **Un matiz práctico**: un error típico, un límite o cuándo *no* usarlo. Esto es lo que diferencia a quien lo ha usado de verdad.

### Arquitectura

**«¿Qué pasa cuando haces `kubectl apply` de un Deployment?»**
kubectl envía el objeto al **API server**, que lo autentica, autoriza (RBAC), pasa los *admission controllers* y lo guarda en **etcd**. El **controlador de Deployments** (en el controller-manager) crea un **ReplicaSet**, y el controlador de ReplicaSets crea los **Pods**. El **scheduler** ve Pods sin nodo y les asigna uno. El **kubelet** de ese nodo ve el Pod asignado y pide al **container runtime** que arranque los contenedores. Todo es **reconciliación**: cada componente observa el estado deseado y actúa para alcanzarlo.

**«¿Qué pasa si se cae el control plane?»**
Los Pods que ya corren **siguen funcionando** (los gestiona el kubelet), pero no se pueden hacer cambios ni se reprograman Pods si falla un nodo. Por eso el control plane va en alta disponibilidad y **etcd necesita copias de seguridad**.

### Workloads

**«¿Deployment o StatefulSet?»**
Deployment para aplicaciones **sin estado**: Pods intercambiables. StatefulSet para aplicaciones **con estado**: cada Pod tiene **nombre estable** (`db-0`, `db-1`), **su propio volumen** (volumeClaimTemplates) y se crean y borran **en orden**. DaemonSet si necesitas un Pod por nodo (agentes de logs); Job/CronJob para tareas que terminan.

**«¿Cómo actualizas sin caída?»**
Rolling update con `maxUnavailable: 0` y `maxSurge` de al menos 1, **readiness probes** para que solo reciban tráfico los Pods listos y, si falla, `kubectl rollout undo`.

### Configuración y recursos

**«¿Diferencia entre ConfigMap y Secret? ¿El Secret está cifrado?»**
Ambos inyectan configuración como variables o archivos. El Secret es para datos sensibles, pero solo va en **base64**, que **no es cifrado**. Hay que activar el cifrado en reposo de etcd, limitar el acceso con RBAC o usar un gestor externo (Secret Manager, Vault).

**«¿Requests y limits?»**
Las **requests** son lo que el scheduler **reserva** para decidir el nodo. Los **limits** son el **máximo**: si se pasa de CPU, se ralentiza (*throttling*); si se pasa de memoria, **OOMKilled**. Definen la clase **QoS** (Guaranteed, Burstable, BestEffort), que decide quién se desaloja primero.

**«¿Liveness, readiness y startup?»**
**Readiness**: si falla, el Pod **deja de recibir tráfico**. **Liveness**: si falla, **se reinicia** el contenedor. **Startup**: protege a las aplicaciones lentas en arrancar, desactivando las otras dos hasta que pasa. Error típico: una liveness que comprueba dependencias externas y reinicia todo en cascada.

### Red

**«¿Tipos de Service?»**
**ClusterIP** (solo dentro del clúster, por defecto), **NodePort** (un puerto en cada nodo), **LoadBalancer** (balanceador del proveedor cloud). Para HTTP con varios hosts o rutas, un **Ingress** (o Gateway API) delante de Services ClusterIP.

**«¿Cómo aíslas el tráfico entre aplicaciones?»**
NetworkPolicies con un **deny por defecto** y reglas que permiten solo lo necesario. Requieren un CNI que las soporte, y hay que acordarse del egress al DNS.

### Seguridad y escalado

**«¿Cómo das permisos a una aplicación que llama a la API de Kubernetes?»**
Una **ServiceAccount** propia, un **Role** con los verbos y recursos mínimos y un **RoleBinding**. Se comprueba con `kubectl auth can-i --as=system:serviceaccount:NS:NOMBRE`.

**«¿Cómo escala Kubernetes?»**
**HPA**: más o menos Pods según métricas (necesita requests y metrics-server). **VPA**: ajusta requests. **Cluster Autoscaler** (o el autoscaler del proveedor): añade nodos cuando hay Pods en Pending por falta de recursos.

## Ejemplo

Respuesta completa, con la estructura en cuatro pasos, a «¿Qué es un Pod?»:

```text
1. Definición:  la unidad mínima que se despliega en Kubernetes: uno o varios
                contenedores que comparten red (misma IP) y volúmenes.
2. Para qué:    agrupa contenedores que deben ir siempre juntos (app + sidecar).
3. Cómo:        el scheduler lo asigna a un nodo y el kubelet arranca sus
                contenedores; es efímero: si muere, no se "repara", se crea otro.
4. Matiz:       casi nunca se crea un Pod suelto; se usa un Deployment,
                StatefulSet o Job para que alguien lo recree si falla.
```

## Errores comunes

- **Responder con una lista de comandos** en vez de explicar el concepto.
- **Hablar sin estructura** durante minutos: define, explica y termina con un matiz.
- **Decir que un Secret está cifrado** porque va en base64.
- **Confundir liveness y readiness**: una reinicia, la otra quita tráfico.
- **Inventar cuando no sabes**: es mejor decir cómo lo averiguarías (documentación, `kubectl explain`, pruebas).

## En la entrevista

**«¿Qué es lo más difícil que has depurado en Kubernetes?»**
Cuenta un caso con el método: síntoma, cómo lo investigaste (get, describe, logs, eventos), la causa y qué cambiaste para que no se repita (una alerta, un límite, una probe mejor). Lo importante es el razonamiento, no la anécdota.

**«¿Qué pondrías en un Deployment para producción?»**
Varias réplicas repartidas entre zonas, readiness y liveness probes, requests y limits, rolling update sin indisponibilidad, una imagen con tag inmutable, un securityContext sin root y un PodDisruptionBudget. Se trabaja en la siguiente lección.

## Resumen

- Estructura: **definición → para qué → cómo funciona → matiz práctico**.
- `kubectl apply` → API server → etcd → controladores → scheduler → kubelet: **reconciliación**.
- Deployment (sin estado), StatefulSet (identidad y volumen propios), DaemonSet, Job.
- Secret ≠ cifrado; requests reservan, limits limitan; readiness quita tráfico, liveness reinicia.
- Si no sabes algo, explica **cómo lo averiguarías**; no te lo inventes.
