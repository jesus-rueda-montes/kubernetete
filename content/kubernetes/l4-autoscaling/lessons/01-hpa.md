---
title: HorizontalPodAutoscaler
minutes: 12
---

## Qué problema resuelve

Tu tienda online tiene 3 réplicas. Un lunes a las 10:00 van sobradas; el Black Friday se saturan y la web va lenta. Si pones 20 réplicas siempre, pagas por recursos que casi nunca usas. Cambiar el número a mano con `kubectl scale` no es viable a las 3 de la mañana.

El **HorizontalPodAutoscaler** (HPA) **ajusta el número de réplicas** de un Deployment o StatefulSet según una métrica, normalmente el uso de CPU.

## Analogía

Es como un **supermercado que abre y cierra cajas** según la cola: si hay mucha gente esperando, abre más cajas; cuando se vacía, las cierra. Siempre deja un mínimo abierto y nunca abre más cajas de las que tiene.

## Concepto

### Qué necesita

1. **metrics-server** instalado en el clúster: recoge el uso de CPU y memoria de los Pods. En GKE viene incluido. Sin él, el HPA muestra `<unknown>` y no escala.
2. **`resources.requests`** en los contenedores: el objetivo en porcentaje se calcula **sobre los requests**. Sin requests de CPU, no se puede calcular el uso de CPU en porcentaje.

### Cómo decide

Cada **15 segundos** (por defecto), el HPA calcula:

```text
réplicas deseadas = ceil( réplicas actuales × valor actual / valor objetivo )
```

Ejemplo: 4 réplicas al 90 % de CPU con objetivo del 60 % → `ceil(4 × 90 / 60) = 6` réplicas.

- Siempre entre **`minReplicas`** y **`maxReplicas`**.
- Ignora diferencias pequeñas (tolerancia del **10 %** por defecto) para no estar cambiando constantemente.
- **Sube rápido** y **baja despacio**: antes de reducir réplicas espera una **ventana de estabilización de 5 minutos**, para no quitar Pods que luego vuelvan a hacer falta.
- Con **varias métricas**, calcula las réplicas para cada una y se queda con **el número mayor**.

### El objeto

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web
spec:
  scaleTargetRef:                 # qué escala
    apiVersion: apps/v1
    kind: Deployment
    name: web
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization       # porcentaje de los requests
          averageUtilization: 60
```

- `autoscaling/v2` permite CPU, memoria, **métricas personalizadas** (peticiones por segundo) y **externas** (mensajes en una cola), y ajustar la velocidad con `behavior`.
- También se puede crear con `kubectl autoscale deployment web --min=2 --max=10 --cpu=60%`.

### HPA y `replicas` del Deployment

Cuando un HPA gestiona un Deployment, **el HPA manda** sobre el número de réplicas. Si tu manifiesto tiene `replicas: 3` y lo vuelves a aplicar, lo devolverás a 3 hasta que el HPA lo corrija. Por eso, con HPA, se suele **quitar `replicas`** del manifiesto.

## Ejemplo

```bash
kubectl autoscale deployment web --min=2 --max=10 --cpu=60%
kubectl get hpa
```

```text
NAME   REFERENCE        TARGETS         MINPODS   MAXPODS   REPLICAS   AGE
web    Deployment/web   cpu: 85%/60%    2         10        4          12m
```

El 85 % supera el objetivo del 60 %: el HPA subirá a `ceil(4 × 85 / 60) = 6` réplicas.

```bash
kubectl top pods -l app=web        # uso real de CPU y memoria (metrics-server)
kubectl describe hpa web           # eventos: por qué ha escalado o no
```

## Errores comunes

- **Contenedores sin `requests` de CPU**: el HPA no puede calcular el porcentaje y no escala.
- **metrics-server no instalado**: `TARGETS` muestra `<unknown>`.
- **`maxReplicas` sin pensar en el resto del sistema**: 50 réplicas pueden agotar las conexiones de la base de datos.
- **Mantener `replicas` en el manifiesto** con un HPA: cada `apply` pelea con el autoescalado.
- **Escalar por memoria** una aplicación que no libera memoria al bajar la carga: el HPA sube y nunca baja.
- **Esperar que escale en segundos**: hay que contar con el intervalo, el arranque de los Pods y, a veces, la creación de nodos.

## En la entrevista

**«¿Cómo funciona el HPA?»**
Lee las métricas (normalmente de metrics-server), compara el valor actual con el objetivo y calcula las réplicas: réplicas actuales por valor actual entre objetivo, redondeando hacia arriba, dentro de min y max. Sube rápido y baja con una ventana de estabilización de 5 minutos. Los porcentajes de CPU se calculan sobre los requests.

**«Un HPA no escala y muestra `<unknown>`. ¿Qué miras?»**
Que metrics-server funcione (`kubectl top pods`), que los contenedores tengan requests de CPU y los eventos de `kubectl describe hpa`.

## Resumen

- **HPA**: ajusta las **réplicas** según métricas, entre **min** y **max**.
- Necesita **metrics-server** y **requests** (el % es sobre los requests).
- Fórmula: **ceil(actuales × actual / objetivo)**; cada 15 s; tolerancia del 10 %.
- Sube rápido, **baja tras 5 minutos** de estabilización; con varias métricas, gana la mayor.
- `kubectl autoscale deployment web --min=2 --max=10 --cpu=60%`; quita `replicas` del manifiesto.
