---
title: De Pods sueltos a Deployments
minutes: 11
---

## Qué problema resuelve

Un Pod suelto es frágil: si muere o su Node falla, **nadie lo vuelve a crear**. Además, una aplicación real necesita **varias copias** (réplicas) para repartir carga y sobrevivir a fallos, y **actualizarse** a nuevas versiones sin cortar el servicio.

Los **Deployments** resuelven las tres cosas. Son la forma estándar de ejecutar aplicaciones *stateless* (sin estado propio) en Kubernetes.

## Analogía

Piensa en un **encargado de turno** de una tienda con la instrucción «siempre tiene que haber 3 cajeros atendiendo». Si un cajero se va a casa enfermo, el encargado llama a otro. Ese encargado es el **ReplicaSet**. Y el **Deployment** es el **gerente**: decide cuándo cambiar a todo el equipo por cajeros con el uniforme nuevo, haciéndolo poco a poco para que las cajas nunca se queden vacías.

## Concepto

### La cadena Deployment → ReplicaSet → Pods

```
Deployment web  (replicas: 3, imagen nginx:1.27)
   └── ReplicaSet web-7d9c6b5f4          ← uno por cada versión de la plantilla
         ├── Pod web-7d9c6b5f4-2xk8p
         ├── Pod web-7d9c6b5f4-q9w3z
         └── Pod web-7d9c6b5f4-t5r7m
```

- Un **ReplicaSet** mantiene **un número fijo de Pods idénticos**. Si sobran, borra; si faltan, crea.
- Un **Deployment** gestiona ReplicaSets: cada vez que cambias la **plantilla de los Pods**, crea un ReplicaSet **nuevo** y va pasando réplicas del viejo al nuevo.
- En la práctica **no se crean ReplicaSets a mano**: se crean Deployments.

### Las tres partes clave del manifest

```yaml
spec:
  replicas: 3              # 1) cuántos Pods quiero
  selector:                # 2) cómo reconoce el Deployment a "sus" Pods
    matchLabels:
      app: web
  template:                # 3) el molde de cada Pod
    metadata:
      labels:
        app: web           # ¡debe cumplir el selector!
    spec:
      containers: ...
```

1. **`replicas`**: el número deseado de Pods.
2. **`selector`**: qué labels identifican a los Pods de este Deployment. En `apps/v1` es **obligatorio** e **inmutable**: no se puede cambiar después de crear el Deployment.
3. **`template`**: un Pod completo (metadata + spec) sin nombre; cada réplica se crea a partir de él. Sus **labels deben cumplir el selector**, o la API rechaza el Deployment.

Kubernetes añade a cada Pod la label **`pod-template-hash`**, que distingue a qué ReplicaSet (a qué versión) pertenece.

### Escalar

Cambiar `replicas` **no crea un ReplicaSet nuevo**: el mismo ReplicaSet crea o borra Pods.

```bash
kubectl scale deployment web --replicas=5
```

(O cambiando `replicas` en el YAML y volviendo a hacer `kubectl apply`, que es lo recomendable si el YAML está en git.)

## Ejemplo

```yaml
apiVersion: apps/v1          # Los Deployments están en el grupo "apps"
kind: Deployment
metadata:
  name: web
  labels:
    app: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web               # gestiona los Pods con app=web...
  template:
    metadata:
      labels:
        app: web             # ...y crea sus Pods con app=web
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
          ports:
            - containerPort: 80
```

```bash
kubectl apply -f web.yaml
kubectl get deployments          # READY 3/3
kubectl get replicasets          # un ReplicaSet web-xxxxxxxxx con 3 réplicas
kubectl get pods -l app=web      # los 3 Pods

# Alternativa rápida sin YAML (útil en exámenes como el CKAD):
kubectl create deployment web --image=nginx:1.27 --replicas=3
# Generar el YAML sin crear nada, para editarlo después:
kubectl create deployment web --image=nginx:1.27 --dry-run=client -o yaml
```

## Errores comunes

- **Labels del `template` que no cumplen el `selector`.** La API lo rechaza: «selector does not match template labels».
- **Intentar cambiar el `selector`** de un Deployment existente. Es inmutable en `apps/v1`: hay que borrarlo y recrearlo.
- **Usar `apiVersion: v1`** para un Deployment. Es `apps/v1`.
- **Editar o borrar el ReplicaSet** en vez del Deployment. El Deployment lo recrea o lo corrige: trabaja siempre sobre el Deployment.
- **Escalar con `kubectl scale` y olvidar el YAML.** El próximo `kubectl apply` del archivo devuelve el número antiguo de réplicas.

## En la entrevista

**«¿Qué relación hay entre Deployment, ReplicaSet y Pod?»**
El Deployment gestiona ReplicaSets, uno por versión de la plantilla de Pods. El ReplicaSet mantiene el número deseado de Pods idénticos. Al actualizar, el Deployment crea un ReplicaSet nuevo y traslada réplicas del viejo al nuevo; los viejos se conservan (a cero réplicas) para poder volver atrás.

**«¿Cómo sabe un Deployment qué Pods son suyos?»**
Por su `selector`: gestiona los Pods cuyas labels lo cumplen. Por eso las labels de la plantilla deben coincidir con el selector, que además es inmutable en `apps/v1`.

## Resumen

- **Deployment → ReplicaSet → Pods**; en la práctica solo creas Deployments.
- Claves del manifest: **`replicas`**, **`selector`** y **`template`**; las labels de la plantilla deben cumplir el selector.
- El `selector` es **obligatorio e inmutable** en `apps/v1`.
- **Escalar** cambia réplicas del mismo ReplicaSet; **cambiar la plantilla** crea un ReplicaSet nuevo.
- `kubectl create deployment ... --dry-run=client -o yaml` genera un YAML de partida.
