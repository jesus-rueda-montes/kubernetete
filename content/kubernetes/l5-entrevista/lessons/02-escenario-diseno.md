---
title: "Escenario de diseño: una aplicación lista para producción"
minutes: 15
---

## Qué problema resuelve

Muchas entrevistas terminan con un **escenario abierto**: «Tenemos una API web y queremos desplegarla en Kubernetes en producción. ¿Cómo lo harías?». No hay una única respuesta correcta. Lo que se evalúa es que:

- **Preguntes** por los requisitos antes de diseñar.
- Cubras los aspectos importantes con **orden**: disponibilidad, despliegues, seguridad, escalado y observabilidad.
- **Justifiques** cada decisión y conozcas sus contrapartidas.

## Analogía

Es como un arquitecto al que le piden «una casa». Antes de dibujar pregunta: ¿cuántas personas?, ¿qué presupuesto?, ¿dónde está el terreno? Luego diseña por capas: cimientos, estructura, instalaciones y seguridad. Y explica por qué eligió cada cosa.

## Concepto

### 1. Preguntar primero

- ¿Tiene **estado** o es sin estado? ¿Dónde están los datos?
- ¿Cuánto **tráfico**, con qué picos? ¿Qué **disponibilidad** se espera (SLO)?
- ¿Hay requisitos de **seguridad** o normativos?
- ¿Cómo se despliega hoy? ¿Hay CI/CD?

### 2. Checklist de un workload de producción

**Disponibilidad**
- **Varias réplicas** (al menos 3) repartidas entre **nodos y zonas**: pod anti-affinity o **`topologySpreadConstraints`** (`topologyKey: topology.kubernetes.io/zone`).
- **PodDisruptionBudget** (`minAvailable` o `maxUnavailable`): durante un `kubectl drain` o una actualización de nodos, Kubernetes no desaloja más Pods de los permitidos. Solo protege de interrupciones **voluntarias**.
- El estado, **fuera** del Pod: una base de datos gestionada (Cloud SQL) o un StatefulSet con volúmenes.

**Despliegues sin caída**
- Rolling update con `maxUnavailable: 0` y `maxSurge: 1`.
- **Readiness probe** (y liveness con cuidado); **startup probe** si arranca lento.
- Imagen con **tag inmutable** (versión o commit), nunca `latest`.
- Entrega con GitOps o un pipeline; rollback con `kubectl rollout undo` o volviendo al commit anterior.

**Recursos y escalado**
- **Requests** realistas (medidas, no inventadas) y **limit** de memoria.
- **HPA** por CPU o por una métrica de negocio; **Cluster Autoscaler** para los nodos.

**Seguridad**
- **ServiceAccount** propia, sin permisos si no llama a la API; RBAC mínimo.
- **`securityContext`**: `runAsNonRoot: true`, `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `capabilities.drop: ["ALL"]`.
- **NetworkPolicies**: deny por defecto y solo el tráfico necesario.
- Secretos desde un **gestor externo**; imágenes escaneadas y, si se puede, firmadas.

**Configuración y exposición**
- ConfigMaps y Secrets separados del código; un namespace por aplicación o equipo.
- **Ingress** o Gateway con **TLS** delante de un Service ClusterIP.

**Observabilidad**
- Logs a la salida estándar, métricas (Prometheus o Cloud Monitoring), alertas sobre **SLOs**.

### 3. Hablar de contrapartidas

- Más réplicas y zonas = más disponibilidad, pero más coste.
- `readOnlyRootFilesystem` es más seguro, pero la app necesita un `emptyDir` donde escribir temporales.
- Un HPA sin requests bien puestas escala mal.

## Ejemplo

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  strategy:
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0          # nunca menos de 3 Pods listos
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      serviceAccountName: api
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone   # repartir entre zonas
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app: api
      containers:
        - name: api
          image: europe-west1-docker.pkg.dev/tienda/apps/api:2.3.1   # tag inmutable
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              memory: 256Mi
          securityContext:
            runAsNonRoot: true
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api
spec:
  minAvailable: 2               # en un drain, al menos 2 Pods siguen funcionando
  selector:
    matchLabels:
      app: api
```

## Errores comunes

- **Empezar a escribir YAML sin preguntar nada**: parece que no piensas en el negocio.
- **Olvidar el PodDisruptionBudget**: una actualización de nodos puede tirar todas las réplicas a la vez.
- **Tres réplicas en el mismo nodo o zona**: la caída de ese nodo o zona las tumba todas.
- **Poner limit de CPU muy bajo "por seguridad"**: provoca throttling y latencia; muchos equipos solo ponen limit de memoria.
- **No mencionar la observabilidad**: sin métricas ni alertas no sabrás si el diseño funciona.

## En la entrevista

**«Diseña el despliegue de nuestra API en Kubernetes.»**
Primero preguntaría por el estado, el tráfico y el SLO. Luego: Deployment con 3+ réplicas repartidas por zonas, PDB, rolling update sin indisponibilidad y readiness probe; requests medidas y HPA; ServiceAccount propia, securityContext sin root y NetworkPolicies; secretos en un gestor externo; Ingress con TLS; y métricas con alertas sobre el SLO. Explicaría el coste de cada decisión.

**«¿Para qué sirve un PodDisruptionBudget?»**
Limita cuántos Pods de una aplicación se pueden desalojar a la vez en interrupciones voluntarias, como un drain o una actualización de nodos. No protege de fallos de hardware.

## Resumen

- **Pregunta primero**: estado, tráfico, SLO, seguridad y proceso de despliegue.
- Disponibilidad: **3+ réplicas**, repartidas por **zonas** (`topologySpreadConstraints`), **PDB**.
- Despliegues: `maxUnavailable: 0`, readiness probe, **tag inmutable**, rollback preparado.
- Seguridad: ServiceAccount propia, **securityContext** sin root, NetworkPolicies, secretos externos.
- Escalado (requests + HPA + Cluster Autoscaler), observabilidad con SLOs y **contrapartidas** explicadas.
