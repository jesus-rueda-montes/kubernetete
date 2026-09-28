---
title: Requests, limits y QoS
minutes: 11
---

## Qué problema resuelve

En un Node conviven muchos Pods. Sin reglas:

- el scheduler no sabe **cuánto necesita** cada Pod y puede meter demasiados en la misma máquina,
- un Pod con una fuga de memoria puede **acaparar el Node** y tumbar a sus vecinos,
- cuando falta memoria, Kubernetes no sabe **a quién sacrificar primero**.

Los **requests** y **limits** de CPU y memoria resuelven las tres cosas.

## Analogía

Un **restaurante con reservas**:

- El **request** es la **reserva**: «necesito una mesa para 4». El maître (scheduler) solo te sienta donde caben 4 sillas libres.
- El **limit** es el **máximo permitido**: «como mucho, 6 personas». Si llegan más, hay consecuencias.

## Concepto

```yaml
resources:
  requests:          # lo que se reserva (para el scheduler)
    cpu: 250m
    memory: 256Mi
  limits:            # el máximo que puede usar
    cpu: 500m
    memory: 512Mi
```

### Requests: para decidir dónde

- El **scheduler** coloca el Pod solo en un Node con **suficientes recursos sin reservar** para cubrir los requests.
- El request **no es un límite**: el contenedor puede usar más si hay recursos libres (hasta su limit).

### Limits: el máximo

| Recurso | Si se supera el limit… |
|---|---|
| **CPU** | Se **frena** (*throttling*): el contenedor va más lento, pero **no se mata**. |
| **Memoria** | El kernel puede **matar** el contenedor: **`OOMKilled`** (*out of memory*). Kubernetes lo reinicia según su política. |

Si pones un **limit sin request**, Kubernetes usa el limit también como request.

### Unidades

- **CPU**: `1` = un núcleo; **`500m`** = medio núcleo (m = milésimas de CPU); `250m` = un cuarto.
- **Memoria**: **`Mi`**, **`Gi`** (potencias de 2: 1 Mi = 1024 × 1024 bytes) o `M`, `G` (potencias de 10). `512Mi` ≠ `512M`, y **`512m`** en memoria significaría ¡0,512 bytes!

### Clases de QoS

Según cómo definas requests y limits, cada Pod recibe una **clase de calidad de servicio** (QoS). Decide el orden de desalojo cuando un Node se queda sin memoria:

| Clase | Condición | Se desaloja… |
|---|---|---|
| **Guaranteed** | Todos los contenedores tienen requests y limits de CPU y memoria, y **requests = limits** | El último |
| **Burstable** | Tiene algún request o limit, pero no cumple Guaranteed | En medio |
| **BestEffort** | **Ningún** request ni limit | El primero |

## Ejemplo

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: api
spec:
  containers:
    - name: api
      image: ghcr.io/tienda/api:2.1.0
      resources:
        requests:
          cpu: 250m          # reserva un cuarto de CPU...
          memory: 256Mi      # ...y 256 MiB para colocarlo
        limits:
          memory: 256Mi      # si pasa de 256 MiB → OOMKilled
```

Este Pod es **Burstable** (tiene requests, pero no limit de CPU). Diagnóstico típico:

```bash
kubectl describe pod api
#   Last State:  Terminated
#     Reason:    OOMKilled       ← superó su limit de memoria
#   Restart Count: 4

kubectl describe node nodo-1      # "Allocated resources": requests y limits reservados en el Node
```

Si un Pod se queda en **`Pending`** y sus eventos dicen *«Insufficient cpu»* o *«Insufficient memory»*, ningún Node tiene hueco para sus **requests**.

## Errores comunes

- **No poner requests.** El scheduler amontona Pods; bajo presión, esos Pods son los primeros en ser desalojados (BestEffort).
- **Requests muy altos «por si acaso».** Reservas máquinas que no usas: Pods en `Pending` y facturas de nube infladas.
- **Limit de memoria demasiado justo**: `OOMKilled` y reinicios constantes.
- **Confundir unidades**: `memory: 512m` o `512M` en lugar de `512Mi`.
- **Pensar que superar el limit de CPU mata el contenedor.** Solo lo frena.

## En la entrevista

**«¿Diferencia entre requests y limits?»**
Los requests son lo que se reserva: el scheduler los usa para decidir en qué Node cabe el Pod. Los limits son el máximo que puede consumir: si supera el de CPU se le frena (throttling) y si supera el de memoria puede ser matado (OOMKilled).

**«Un Pod se reinicia con OOMKilled. ¿Qué haces?»**
Confirmo con `kubectl describe pod` que el motivo es OOMKilled. Reviso el consumo real (métricas o `kubectl top pod` si hay metrics-server) y decido: subir el limit de memoria si el consumo es legítimo, o investigar una fuga de memoria en la aplicación.

## Resumen

- **requests** = reserva, usada por el **scheduler**; **limits** = máximo.
- Superar el limit de **CPU** → **throttling**; de **memoria** → **OOMKilled**.
- Unidades: CPU en núcleos o **m** (`500m`); memoria en **Mi/Gi**.
- QoS: **Guaranteed** (requests = limits) > **Burstable** > **BestEffort** (nada); el último se desaloja el primero.
- `Pending` con *Insufficient cpu/memory* = ningún Node tiene hueco para los requests.
