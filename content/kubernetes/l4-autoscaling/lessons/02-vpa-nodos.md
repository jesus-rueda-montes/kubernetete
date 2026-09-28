---
title: VPA, autoescalado de nodos y eventos
minutes: 10
---

## Qué problema resuelve

El HPA añade réplicas, pero no resuelve todo:

- ¿Qué **requests** pongo a mis contenedores? Si pido de más, desperdicio; si pido de menos, el Pod se queda sin recursos o lo matan por memoria.
- Si el HPA crea 10 Pods nuevos y **no caben en los nodos**, se quedan en `Pending`. Hacen falta **más nodos**.
- Algunas cargas no dependen de la CPU, sino de **eventos**: mensajes en una cola, peticiones que llegan de vez en cuando.

Para esto existen el **Vertical Pod Autoscaler**, el **autoescalado de nodos** y herramientas como **KEDA**.

## Analogía

- **HPA**: contratar **más camareros**.
- **VPA**: darle a cada camarero una **bandeja del tamaño adecuado**.
- **Autoescalado de nodos**: **ampliar el restaurante** cuando ya no caben más camareros.
- **KEDA**: abrir la cocina **solo cuando llegan pedidos**, y cerrarla del todo si no hay ninguno.

## Concepto

### Vertical Pod Autoscaler (VPA)

- Ajusta los **requests** (y límites) de CPU y memoria de los contenedores según su consumo real.
- **No viene incluido** en Kubernetes: se instala aparte (añade sus propios tipos de objeto). GKE lo ofrece integrado.
- Modos habituales: **solo recomendar** (`Off`, muy útil para descubrir qué requests poner) o **aplicar** los cambios. Hoy, para aplicarlos, VPA **recrea los Pods**; todavía no los redimensiona en caliente.
- **No combines VPA y HPA sobre la misma métrica** (CPU o memoria): uno cambia los requests y el otro calcula porcentajes sobre esos requests, y se pelean. Sí se pueden combinar si el HPA usa otras métricas.

### Autoescalado de nodos

Funciona **en respuesta a los Pods**:

- **Aprovisionar**: si hay Pods en `Pending` porque ningún nodo tiene sitio para sus **requests**, añade nodos.
- **Consolidar**: si hay nodos poco usados cuyos Pods caben en otros, los vacía y los quita.

Implementaciones:

- **Cluster Autoscaler**: trabaja con grupos de nodos (en GKE, los **node pools** con autoescalado).
- **Karpenter**: crea nodos a medida según la configuración (muy usado en AWS).
- En **GKE Autopilot** no gestionas nada de esto: Google añade y quita la capacidad.

Todo se basa en los **requests**: un Pod sin requests «no ocupa nada» para el scheduler, y el autoescalado de nodos no sabrá cuánto necesita.

### Escalar por eventos: KEDA

**KEDA** (*Kubernetes Event-Driven Autoscaling*, proyecto de la CNCF) escala según **eventos**: mensajes pendientes en una cola, filas en una tabla, métricas de Prometheus… Puede bajar un Deployment **a cero réplicas** cuando no hay trabajo, algo que el HPA por sí solo no hace.

### Cómo encaja todo

```text
Sube el tráfico
  → HPA crea más Pods
    → no caben: Pods en Pending
      → el autoescalado de nodos añade nodos
        → los Pods se programan
Baja el tráfico
  → HPA quita Pods (tras 5 min)
    → nodos casi vacíos
      → el autoescalado de nodos los consolida y los quita
```

## Ejemplo

Usar VPA **solo para recomendar** requests:

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: web
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  updatePolicy:
    updateMode: "Off"          # no toca los Pods: solo calcula recomendaciones
```

```bash
kubectl describe vpa web       # muestra los requests recomendados (target, lowerBound, upperBound)
```

Con esas recomendaciones ajustas los requests en el manifiesto, y dejas que el HPA gestione las réplicas por CPU.

## Errores comunes

- **VPA y HPA por CPU a la vez** sobre el mismo Deployment: se pelean.
- **VPA aplicando cambios en una app con una sola réplica**: al recrear el Pod hay una caída.
- **Pods sin requests**: ni el HPA (por porcentaje) ni el autoescalado de nodos funcionan bien.
- **Límites del autoescalado de nodos demasiado bajos**: el HPA crea Pods que se quedan en `Pending`.
- **Esperar escalado instantáneo**: crear un nodo tarda minutos. Para picos previsibles, sube el mínimo antes.

## En la entrevista

**«¿Qué diferencia hay entre HPA, VPA y Cluster Autoscaler?»**
El HPA cambia el número de réplicas; el VPA cambia los requests de cada Pod; el Cluster Autoscaler cambia el número de nodos cuando hay Pods pendientes o nodos infrautilizados. Normalmente se combinan HPA y autoescalado de nodos, y VPA en modo recomendación para ajustar los requests.

**«¿Se pueden usar HPA y VPA juntos?»**
No sobre la misma métrica de CPU o memoria, porque el VPA cambia los requests sobre los que el HPA calcula los porcentajes. Sí con el VPA en modo recomendación, o con el HPA usando métricas personalizadas.

## Resumen

- **VPA**: ajusta los **requests**; se instala aparte; modo **`Off`** para recomendaciones; aplica cambios **recreando Pods**.
- **No mezcles** VPA y HPA sobre CPU/memoria.
- **Autoescalado de nodos** (Cluster Autoscaler, Karpenter): añade nodos para Pods **Pending** y consolida los infrautilizados.
- Todo se basa en los **requests**.
- **KEDA**: escala por eventos, incluso **a cero**.
