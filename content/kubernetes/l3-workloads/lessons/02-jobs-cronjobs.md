---
title: Jobs y CronJobs
minutes: 10
---

## Qué problema resuelve

No todo es un servicio que debe estar siempre en marcha. Muchas tareas **empiezan, hacen su trabajo y terminan**: una migración de base de datos, procesar un lote de imágenes, generar un informe… Con un Deployment, al terminar el proceso Kubernetes lo **reiniciaría una y otra vez**. Y hay tareas que deben repetirse **según un horario**, como una copia de seguridad cada noche.

Para eso existen los **Jobs** y los **CronJobs**.

## Analogía

- Un **Deployment** es un **empleado a jornada completa**: siempre debe estar en su puesto.
- Un **Job** es un **encargo**: «pinta esta pared»; cuando termina, se va. Si le sale mal, se le vuelve a pedir, hasta un límite.
- Un **CronJob** es un **encargo recurrente en la agenda**: «cada lunes a las 3, limpia el almacén».

## Concepto

### Job

Un Job crea uno o varios Pods y los **reintenta** hasta que el número deseado **termina con éxito**.

| Campo | Significado | Por defecto |
|---|---|---|
| `completions` | Cuántas ejecuciones con éxito hacen falta | 1 |
| `parallelism` | Cuántos Pods a la vez como máximo | 1 |
| `backoffLimit` | Reintentos antes de dar el Job por **fallido** | **6** |
| `activeDeadlineSeconds` | Tiempo máximo total del Job | — |
| `ttlSecondsAfterFinished` | Borrar el Job automáticamente X segundos después de terminar | — |

El `restartPolicy` de la plantilla debe ser **`Never`** o **`OnFailure`**; **`Always` no está permitido** en un Job.

### CronJob

Un CronJob crea un **Job** según un horario en formato **cron** (5 campos):

```
┌──────── minuto (0-59)
│ ┌────── hora (0-23)
│ │ ┌──── día del mes (1-31)
│ │ │ ┌── mes (1-12)
│ │ │ │ ┌ día de la semana (0-6, domingo = 0)
│ │ │ │ │
0 3 * * *     → todos los días a las 03:00
*/15 * * * *  → cada 15 minutos
0 9 * * 1     → los lunes a las 09:00
```

También admite atajos como `@hourly`, `@daily` o `@weekly`.

| Campo | Para qué | Por defecto |
|---|---|---|
| `schedule` | El horario cron | (obligatorio) |
| `timeZone` | Zona horaria, p. ej. `Europe/Madrid` | La del controlador del clúster (normalmente UTC) |
| `concurrencyPolicy` | Si la ejecución anterior no ha terminado: **`Allow`** (ejecuta ambas), **`Forbid`** (se salta la nueva), **`Replace`** (cancela la anterior) | `Allow` |
| `successfulJobsHistoryLimit` / `failedJobsHistoryLimit` | Cuántos Jobs terminados conservar | 3 / 1 |
| `suspend` | Pausar el CronJob | `false` |

## Ejemplo

Una copia de seguridad diaria a las 3 de la mañana (hora de Madrid), sin solapar ejecuciones:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup-db
spec:
  schedule: "0 3 * * *"
  timeZone: Europe/Madrid
  concurrencyPolicy: Forbid          # si la de ayer sigue, no lanzar otra
  jobTemplate:                       # plantilla del Job
    spec:
      backoffLimit: 2
      template:                      # plantilla del Pod
        spec:
          restartPolicy: OnFailure
          containers:
            - name: backup
              image: ghcr.io/tienda/backup:1.3.0
              args: ["--destino", "gs://tienda-backups-7f3k/"]
```

```bash
kubectl get cronjobs                               # alias: cj
kubectl create job backup-manual --from=cronjob/backup-db   # lanzarlo ahora, a mano
kubectl get jobs                                   # COMPLETIONS 1/1 cuando termina
kubectl logs job/backup-manual                     # salida del Pod del Job
```

Fíjate en el anidamiento: **CronJob → `jobTemplate` → Job → `template` → Pod**.

## Errores comunes

- **Usar un Deployment para una tarea que termina**: se reinicia en bucle (`CrashLoopBackOff` o reinicios constantes).
- **`restartPolicy: Always` en un Job**: la API lo rechaza.
- **Olvidar la zona horaria**: el horario se interpreta en la del clúster (normalmente UTC).
- **Tareas largas con `concurrencyPolicy: Allow`**: se acumulan ejecuciones simultáneas.
- **Jobs terminados que se acumulan**: usa `ttlSecondsAfterFinished` o los límites de historial.
- **Tareas no idempotentes**: un reintento (por `backoffLimit`) podría duplicar trabajo. Diseña la tarea para que repetirla sea seguro.

## En la entrevista

**«¿Diferencia entre un Job y un Deployment?»**
El Deployment mantiene Pods siempre en marcha y los reinicia si terminan. El Job ejecuta Pods hasta que terminan con éxito el número de veces pedido, con reintentos limitados (`backoffLimit`), y después no los reinicia.

**«¿Cómo evitarías que un CronJob lance una ejecución mientras la anterior sigue en curso?»**
Con `concurrencyPolicy: Forbid` (o `Replace` si prefieres cancelar la anterior), y fijando `activeDeadlineSeconds` para que ninguna ejecución se eternice.

## Resumen

- **Job**: Pods que **terminan**; `completions`, `parallelism`, **`backoffLimit` (6 por defecto)**; `restartPolicy` **Never u OnFailure**.
- **CronJob**: crea Jobs según un **horario cron**; `timeZone`, `concurrencyPolicy` (`Allow`, `Forbid`, `Replace`).
- Anidamiento: **CronJob → jobTemplate → Job → template → Pod**.
- `kubectl create job X --from=cronjob/Y` lanza un CronJob a mano.
- Limpia con `ttlSecondsAfterFinished` y diseña tareas **idempotentes**.
