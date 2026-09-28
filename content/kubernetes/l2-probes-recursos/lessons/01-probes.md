---
title: Liveness, readiness y startup probes
minutes: 11
---

## Qué problema resuelve

Que un contenedor esté **en marcha** (`Running`) no significa que funcione:

- La aplicación puede estar **colgada** (el proceso vive, pero no responde).
- Puede estar **arrancando**: tarda 30 segundos en cargar datos y todavía no puede atender.
- Puede estar **temporalmente saturada** y convenir dejar de enviarle tráfico un rato.

Kubernetes no lo sabe por sí solo. Las **probes** (sondas) son comprobaciones periódicas que le dicen si reiniciar un contenedor o si enviarle tráfico.

## Analogía

En un hospital, la enfermera hace dos preguntas distintas:

- **¿Está vivo?** (*liveness*): si no hay pulso, se reanima (se **reinicia** el contenedor).
- **¿Puede recibir visitas?** (*readiness*): puede estar vivo pero en observación; entonces **no pasan visitas** (no recibe tráfico) hasta que se recupere.

Y para un paciente que sale de la anestesia (**startup**), se le deja tiempo antes de empezar con las otras preguntas.

## Concepto

### Los tres tipos

| Probe | Pregunta | Si falla… |
|---|---|---|
| **liveness** | ¿Está vivo o se ha quedado colgado? | Se **reinicia el contenedor**. |
| **readiness** | ¿Puede atender tráfico ahora? | Se **saca el Pod de los endpoints** de los Services (no recibe tráfico). No se reinicia. |
| **startup** | ¿Ha terminado de arrancar? | Mientras no tenga éxito, **las otras dos no se ejecutan**. Si agota sus intentos, el contenedor se reinicia. |

La **readiness** es la que hace seguros los **rolling updates**: un Pod nuevo no recibe tráfico (ni el Deployment sigue avanzando) hasta que está listo.

### Cómo comprueban

| Mecanismo | Éxito si… |
|---|---|
| `httpGet` | La respuesta HTTP tiene un código **200–399**. |
| `tcpSocket` | Se puede abrir una conexión TCP al puerto. |
| `exec` | El comando termina con código de salida **0**. |
| `grpc` | El servicio de salud gRPC responde que está sano. |

### Parámetros (y sus valores por defecto)

| Campo | Por defecto | Significado |
|---|---|---|
| `initialDelaySeconds` | 0 | Espera antes de la primera comprobación. |
| `periodSeconds` | 10 | Cada cuánto se comprueba. |
| `timeoutSeconds` | 1 | Tiempo máximo de respuesta. |
| `failureThreshold` | 3 | Fallos seguidos para darla por fallida. |
| `successThreshold` | 1 | Éxitos seguidos para darla por buena. |

Con los valores por defecto, una liveness tarda unos **30 segundos** (3 fallos × 10 s) en reiniciar un contenedor colgado.

Para aplicaciones lentas en arrancar, usa una **startup probe** en lugar de un `initialDelaySeconds` enorme: `failureThreshold × periodSeconds` es el tiempo máximo que se le da para arrancar.

## Ejemplo

```yaml
containers:
  - name: api
    image: ghcr.io/tienda/api:2.1.0
    ports:
      - containerPort: 8080
    startupProbe:              # hasta 30 × 10 s = 5 min para arrancar
      httpGet:
        path: /healthz
        port: 8080
      failureThreshold: 30
      periodSeconds: 10
    livenessProbe:             # ¿sigue vivo? (solo estado interno)
      httpGet:
        path: /healthz
        port: 8080
      periodSeconds: 10
    readinessProbe:            # ¿puede atender? (p. ej. ya cargó su caché)
      httpGet:
        path: /ready
        port: 8080
      periodSeconds: 5
```

Qué verás:

```bash
kubectl get pods
# NAME        READY   STATUS    RESTARTS   AGE
# api-7c9d…   0/1     Running   0          20s    ← vivo, pero aún no ready
# api-7c9d…   1/1     Running   0          45s    ← ya recibe tráfico
kubectl describe pod api-7c9d…   # los fallos de las probes aparecen en Events
```

## Errores comunes

- **Liveness que depende de servicios externos** (la base de datos, otra API). Si la base de datos cae, Kubernetes reinicia **todos** tus Pods en bucle sin arreglar nada. La liveness debe comprobar solo el **estado interno** del proceso.
- **Usar el mismo endpoint y los mismos tiempos** para liveness y readiness sin pensar: una sobrecarga momentánea acaba en reinicios.
- **Liveness sin startup probe en una app lenta**: la reinicia antes de que termine de arrancar (bucle de `CrashLoopBackOff`).
- **No tener readiness**: durante un despliegue llega tráfico a Pods que todavía no responden.
- **`timeoutSeconds: 1`** con un endpoint lento: falsos fallos.

## En la entrevista

**«¿Diferencia entre liveness y readiness?»**
La liveness decide si el contenedor debe reiniciarse (está colgado). La readiness decide si el Pod recibe tráfico: si falla, se saca de los endpoints de los Services, pero no se reinicia. La startup probe protege a las aplicaciones lentas en arrancar, retrasando las otras dos.

**«¿Qué pondrías en una liveness probe?»**
Una comprobación ligera del propio proceso (por ejemplo `/healthz` que no consulta dependencias). Las dependencias externas, si acaso, en la readiness, para dejar de recibir tráfico sin provocar reinicios en cascada.

## Resumen

- **liveness** falla → **reinicio** del contenedor.
- **readiness** falla → **sin tráfico** (fuera de los endpoints), sin reinicio.
- **startup** → da tiempo a arrancar; hasta que tiene éxito, las otras no se ejecutan.
- Mecanismos: **httpGet** (200–399), **tcpSocket**, **exec** (salida 0), **grpc**.
- Por defecto: cada **10 s**, **3** fallos seguidos, timeout de **1 s**. La liveness **no debe depender de servicios externos**.
