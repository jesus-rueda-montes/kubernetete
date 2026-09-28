---
title: ¿Qué es un Pod?
minutes: 8
---

## Qué problema resuelve

Un contenedor ejecuta **un proceso**. Pero muchas aplicaciones reales necesitan **varios procesos muy unidos**: por ejemplo, una web y un pequeño programa que recoge sus logs. Esos procesos tienen que:

- arrancar y pararse juntos,
- ejecutarse en la **misma máquina**,
- hablar entre sí de forma sencilla (por `localhost`).

Kubernetes no gestiona contenedores sueltos. Gestiona **Pods**: un envoltorio que agrupa uno o varios contenedores que deben vivir juntos.

## Analogía

Piensa en un **piso compartido**. Cada inquilino (contenedor) tiene su habitación, pero todos comparten **la misma dirección postal** (la IP del Pod) y pueden compartir la cocina (los volúmenes). Si se derriba el piso, se van todos a la vez.

## Concepto

Un **Pod** es la unidad mínima que Kubernetes crea, programa y gestiona.

1. **Uno o varios contenedores.** Lo más habitual es **un contenedor por Pod**. Varios contenedores solo cuando están muy acoplados (el patrón *sidecar*).
2. **Red compartida.** Todos los contenedores del Pod comparten **una IP** y el mismo espacio de puertos. Entre ellos se hablan por `localhost`. Por eso dos contenedores del mismo Pod no pueden escuchar en el mismo puerto.
3. **Almacenamiento compartible.** El Pod puede declarar **volúmenes** que sus contenedores montan para compartir archivos.
4. **Siempre en un único Node.** Todos los contenedores de un Pod se ejecutan en la misma máquina del clúster.
5. **Efímero.** Un Pod no se "repara": si muere o su Node falla, ese Pod desaparece. Otro objeto (como un *Deployment*, que verás más adelante) crea uno **nuevo**, con otra IP.

Ciclo de vida simplificado (campo `status.phase`):

| Fase | Significado |
|---|---|
| `Pending` | Aceptado por el clúster, pero aún no se están ejecutando todos sus contenedores (p. ej. descargando la imagen). |
| `Running` | Asignado a un Node y al menos un contenedor está en marcha. |
| `Succeeded` | Todos los contenedores terminaron con éxito y no se reiniciarán. |
| `Failed` | Todos terminaron y al menos uno falló. |
| `Unknown` | No se puede obtener el estado (normalmente, problema de comunicación con el Node). |

## Ejemplo

Un manifest mínimo de un Pod con un servidor nginx:

```yaml
apiVersion: v1          # Los Pods pertenecen al grupo "core", versión v1
kind: Pod               # Tipo de objeto que queremos crear
metadata:
  name: web             # Nombre único dentro del namespace
  labels:
    app: web            # Etiquetas: sirven para seleccionar el Pod después
spec:
  containers:           # Lista de contenedores (aquí solo uno)
    - name: nginx       # Nombre del contenedor dentro del Pod
      image: nginx:1.27 # Imagen a ejecutar (fija siempre una versión)
      ports:
        - containerPort: 80  # Puerto en el que escucha (informativo)
```

Comandos básicos con kubectl:

```bash
kubectl apply -f pod.yaml     # Crea (o actualiza) el Pod desde el archivo
kubectl get pods              # Lista los Pods y su estado
kubectl describe pod web      # Detalle y eventos: la primera parada al depurar
kubectl logs web              # Salida del contenedor
kubectl delete pod web        # Borra el Pod
```

También se puede crear sin archivo, útil para pruebas rápidas:

```bash
kubectl run web --image=nginx:1.27
```

## Errores comunes

- **Crear Pods sueltos en producción.** Si el Pod muere, nadie lo recrea. En la práctica se usan *Deployments* u otros controladores.
- **Meter varios servicios independientes en un Pod** (p. ej. la web y la base de datos). Escalan y fallan por separado: deben ir en Pods distintos.
- **Usar `image: nginx` sin versión** (equivale a `latest`). Cada despliegue puede traer una versión distinta.
- **Confiar en la IP de un Pod.** Cambia cada vez que se recrea. Para una dirección estable existen los *Services*.
- **Mirar solo `kubectl get pods` al depurar.** Los eventos de `kubectl describe pod` suelen decir exactamente qué pasa.

## En la entrevista

**«¿Cuál es la diferencia entre un contenedor y un Pod?»**
Un contenedor es un proceso aislado. Un Pod es la unidad de Kubernetes que agrupa uno o varios contenedores que comparten red (una IP, `localhost`) y pueden compartir volúmenes, y que siempre se programan juntos en el mismo Node.

**«¿Cuándo pondrías más de un contenedor en un Pod?»**
Solo cuando están fuertemente acoplados y deben compartir ciclo de vida y recursos, como un sidecar que envía logs o un proxy. Si pueden escalar por separado, van en Pods distintos.

## Resumen

- Un Pod es la **unidad mínima** de Kubernetes, no el contenedor.
- Sus contenedores comparten **IP y `localhost`**, y pueden compartir **volúmenes**.
- Todo el Pod se ejecuta en **un único Node**.
- Los Pods son **efímeros**: no se reparan, se sustituyen (con otra IP).
- Lo normal es **un contenedor por Pod**, gestionado por un controlador como un Deployment.
