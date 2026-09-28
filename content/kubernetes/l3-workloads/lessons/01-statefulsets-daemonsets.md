---
title: StatefulSets y DaemonSets
minutes: 11
---

## Qué problema resuelve

Los Deployments tratan a sus Pods como **intercambiables**: nombres aleatorios, cualquiera puede sustituir a otro. Eso es perfecto para una web, pero no para:

- **Bases de datos o colas replicadas** (PostgreSQL, Kafka, etcd): cada réplica tiene **su identidad** (el primario, la réplica 1…) y **sus propios datos**, que deben seguirla aunque se reprograme.
- **Agentes de sistema** (recogida de logs, monitorización, red): necesitas **exactamente uno por Node**, también en los Nodes que se añadan mañana.

Para eso existen los **StatefulSets** y los **DaemonSets**.

## Analogía

- Un **Deployment** es un grupo de **camareros eventuales**: da igual quién venga, todos hacen lo mismo.
- Un **StatefulSet** es un **equipo con puestos fijos**: «Ana es la portera, Luis el defensa»; si Ana se pone enferma, su sustituta ocupa **su puesto, con su taquilla y su dorsal**.
- Un **DaemonSet** es el **conserje de cada edificio**: uno por edificio; si se construye un edificio nuevo, se contrata un conserje para él.

## Concepto

### StatefulSet

Garantías respecto a un Deployment:

| | Deployment | StatefulSet |
|---|---|---|
| Nombres de los Pods | Aleatorios (`web-7d9c…-x2k8p`) | **Fijos y ordenados**: `db-0`, `db-1`, `db-2` |
| Red | Solo a través del Service | Además, **un DNS por Pod**: `db-0.db.<ns>.svc.cluster.local` |
| Almacenamiento | Compartido o ninguno | **Un PVC por Pod** (`volumeClaimTemplates`), que le sigue siempre |
| Orden | Todos a la vez | Por defecto **en orden**: `db-0` listo antes de crear `db-1`; se borran en orden inverso |

Piezas necesarias:

- Un **headless Service** (`clusterIP: None`) indicado en **`serviceName`**, que da los DNS por Pod.
- **`volumeClaimTemplates`**: plantilla de PVC; se crea `datos-db-0`, `datos-db-1`…
- Al **escalar hacia abajo o borrar** el StatefulSet, los PVC **se conservan** por defecto (para no perder datos).

Un StatefulSet **no replica los datos por ti**: da identidad y almacenamiento estables; la replicación la hace la propia base de datos. Por eso, para bases de datos en producción, a menudo se usa un **operator** (nivel 4) o un servicio gestionado.

### DaemonSet

- Ejecuta **un Pod en cada Node** (o en los que elijas con `nodeSelector` o afinidad).
- Cuando se **añade un Node**, crea su Pod; cuando se quita, lo recoge.
- Añade automáticamente las tolerancias necesarias para, por ejemplo, ciertos taints de sistema (verás los taints en el siguiente módulo).
- Usos típicos: **recogida de logs**, **métricas del Node**, plugins de **red** y de **almacenamiento**. `kube-proxy` suele ser un DaemonSet.

## Ejemplo

```yaml
apiVersion: v1
kind: Service
metadata:
  name: db
spec:
  clusterIP: None            # headless: DNS por Pod
  selector:
    app: db
  ports:
    - port: 5432
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: db
spec:
  serviceName: db            # el headless Service de arriba
  replicas: 3
  selector:
    matchLabels:
      app: db
  template:
    metadata:
      labels:
        app: db
    spec:
      containers:
        - name: postgres
          image: postgres:17
          volumeMounts:
            - name: datos
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:      # un PVC por Pod: datos-db-0, datos-db-1, datos-db-2
    - metadata:
        name: datos
      spec:
        accessModes: [ReadWriteOnce]
        resources:
          requests:
            storage: 20Gi
```

```bash
kubectl get pods -l app=db      # db-0, db-1, db-2 (creados en orden)
kubectl get pvc                 # datos-db-0, datos-db-1, datos-db-2
kubectl get daemonsets -A       # p. ej. kube-proxy en kube-system (alias: ds)
```

## Errores comunes

- **Usar un Deployment para una base de datos replicada**: los Pods no tienen identidad ni disco propio estables.
- **Olvidar el headless Service** o poner otro nombre en `serviceName`: no hay DNS por Pod.
- **Pensar que el StatefulSet replica los datos**: solo da identidad y almacenamiento; la replicación es cosa de la aplicación.
- **Sorprenderse de que queden PVC** tras borrar el StatefulSet: es intencionado; bórralos si ya no los quieres.
- **Usar un Deployment con muchas réplicas** para «tener un agente en cada Node»: no garantiza uno por Node; eso es un DaemonSet.

## En la entrevista

**«¿Cuándo usarías un StatefulSet en lugar de un Deployment?»**
Cuando cada réplica necesita identidad estable (nombre y DNS fijos), su propio almacenamiento persistente que la siga, o un orden de arranque y parada: bases de datos, colas, sistemas distribuidos con quórum. Para aplicaciones stateless, un Deployment.

**«¿Qué es un DaemonSet? Pon un ejemplo.»**
Un controlador que ejecuta un Pod en cada Node (o en un subconjunto), incluidos los que se añadan. Por ejemplo, un agente de recogida de logs o de métricas del Node, o kube-proxy.

## Resumen

- **StatefulSet**: Pods con **nombre fijo** (`db-0`), **DNS por Pod** (headless Service en `serviceName`) y **un PVC por Pod** (`volumeClaimTemplates`).
- Crea y borra **en orden**; sus **PVC se conservan** al borrar o escalar.
- No replica datos: eso lo hace la aplicación (u operators).
- **DaemonSet**: **un Pod por Node**, también en los nuevos; para logs, métricas, red.
- Stateless → Deployment; identidad y datos propios → StatefulSet; uno por Node → DaemonSet.
