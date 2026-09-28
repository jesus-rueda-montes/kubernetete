---
title: Rolling updates y rollback
minutes: 11
---

## Qué problema resuelve

Actualizar una aplicación «parando todo y arrancando la versión nueva» provoca **cortes de servicio**. Y si la versión nueva tiene un fallo, necesitas **volver a la anterior en segundos**, no reconstruir nada a mano.

Los Deployments hacen actualizaciones **progresivas** (*rolling updates*) y guardan el historial para hacer **rollback**.

## Analogía

Es como **cambiar las ruedas de un autobús en marcha, de una en una**: el autobús nunca se detiene. Y si la rueda nueva hace un ruido raro, vuelves a montar la anterior, que guardaste en el maletero.

## Concepto

### Qué dispara un rollout

Un **rollout** (despliegue de una nueva versión) se dispara **solo cuando cambia la plantilla de los Pods** (`spec.template`): la imagen, las variables de entorno, los recursos, las labels de la plantilla…

Cambiar `replicas` **no** es un rollout: solo escala.

### Estrategias

| Estrategia | Cómo actúa | Cuándo |
|---|---|---|
| **`RollingUpdate`** (por defecto) | Crea Pods nuevos y borra viejos poco a poco. Conviven las dos versiones durante un rato. | Casi siempre. |
| **`Recreate`** | Borra **todos** los Pods viejos y después crea los nuevos. **Hay corte.** | Cuando dos versiones no pueden convivir (p. ej. un cambio incompatible de esquema). |

`RollingUpdate` se ajusta con dos parámetros (por defecto, **25 %** cada uno):

- **`maxSurge`**: cuántos Pods **de más** puede haber por encima de `replicas` durante la actualización.
- **`maxUnavailable`**: cuántos Pods pueden estar **no disponibles** a la vez.

Con `replicas: 4` y los valores por defecto: como máximo 5 Pods a la vez (4 + 1) y al menos 3 disponibles (4 − 1).

Para que el rolling update sea seguro, Kubernetes tiene que saber cuándo un Pod nuevo está **listo** para recibir tráfico. Eso lo dicen las **readiness probes**, que verás en este mismo nivel.

### Historial y rollback

- Cada rollout crea una **revisión**. El Deployment conserva los ReplicaSets antiguos (a 0 réplicas) para poder volver: por defecto **10** (`revisionHistoryLimit`).
- La columna `CHANGE-CAUSE` del historial sale de la annotation **`kubernetes.io/change-cause`**.

| Comando | Qué hace |
|---|---|
| `kubectl rollout status deployment/web` | Sigue el progreso hasta que termina (o falla). |
| `kubectl rollout history deployment/web` | Lista las revisiones. |
| `kubectl rollout undo deployment/web` | Vuelve a la revisión **anterior**. |
| `kubectl rollout undo deployment/web --to-revision=2` | Vuelve a una revisión concreta. |
| `kubectl rollout restart deployment/web` | Recrea todos los Pods poco a poco (p. ej. para recargar un ConfigMap). |
| `kubectl rollout pause` / `resume` | Pausa el rollout para acumular varios cambios y lo reanuda. |

## Ejemplo

```yaml
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # como mucho 5 Pods durante la actualización
      maxUnavailable: 0    # nunca menos de 4 disponibles
```

```bash
# Nueva versión: cambia la imagen del contenedor "nginx" del Deployment "web"
kubectl set image deployment/web nginx=nginx:1.28
kubectl rollout status deployment/web
# Waiting for deployment "web" rollout to finish: 2 out of 4 new replicas have been updated...
# deployment "web" successfully rolled out

# ¡La versión nueva falla! Volvemos a la anterior
kubectl rollout undo deployment/web
kubectl rollout history deployment/web
```

`kubectl set image` es cómodo para practicar, pero en un equipo real se cambia la imagen **en el YAML de git** y se aplica (a mano o con un pipeline), para que el repositorio siga reflejando lo que hay en el clúster.

## Errores comunes

- **Usar `latest` como imagen.** Si el tag no cambia, la plantilla no cambia y **no hay rollout**; además, no sabes qué versión corre.
- **Rolling updates sin readiness probe.** Kubernetes considera listo el Pod nuevo en cuanto arranca, aunque la aplicación aún no responda: puedes enviar tráfico a Pods que fallan.
- **Hacer `rollout undo` y olvidar el YAML.** El clúster vuelve atrás, pero git sigue con la versión mala: el siguiente `apply` la reintroduce.
- **Esperar que cambiar `replicas` actualice la versión.** Solo escala.
- **Usar `Recreate` sin necesidad**, provocando un corte en cada despliegue.

## En la entrevista

**«¿Cómo actualizas una aplicación sin cortes en Kubernetes?»**
Con un Deployment y la estrategia RollingUpdate: se cambia la plantilla (normalmente la imagen) y el Deployment crea un ReplicaSet nuevo, subiendo Pods nuevos y bajando viejos según `maxSurge` y `maxUnavailable`. Las readiness probes aseguran que solo reciben tráfico los Pods listos.

**«¿Cómo haces rollback?»**
`kubectl rollout undo deployment/<nombre>` (o `--to-revision=N`), que reactiva el ReplicaSet de la revisión anterior. Después hay que reflejar el cambio en el repositorio para no reintroducir la versión mala.

## Resumen

- Solo los cambios en **`spec.template`** disparan un **rollout**; `replicas` solo escala.
- **RollingUpdate** (por defecto, `maxSurge` y `maxUnavailable` al 25 %) evita cortes; **Recreate** los provoca.
- Se conservan **10** revisiones por defecto (`revisionHistoryLimit`).
- `kubectl rollout status | history | undo | restart`.
- Actualiza siempre **el YAML de git**; los cambios manuales se pierden en el siguiente `apply`.
