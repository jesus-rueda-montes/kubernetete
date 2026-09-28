---
title: Taints, tolerations y mantenimiento de Nodes
minutes: 10
---

## Qué problema resuelve

La afinidad sirve para que un Pod **busque** ciertos Nodes. A veces necesitas lo contrario: que un Node **rechace** Pods. Por ejemplo:

- Nodes con **GPU** caras que solo deben usar los trabajos que las necesitan.
- Nodes **dedicados** a un equipo o a cargas especiales.
- El **control plane**, donde no deben ir tus aplicaciones.
- Un Node que vas a **reiniciar para mantenimiento**.

Los **taints** («manchas») hacen que un Node repela Pods, y las **tolerations** permiten a ciertos Pods ignorar esa repulsión.

## Analogía

Un taint es un cartel de **«Solo personal autorizado»** en una puerta. La toleration es la **acreditación** que te deja pasar. Ojo: tener la acreditación **no te obliga** a entrar en esa sala; solo te lo **permite**.

## Concepto

### Taints

Un taint tiene **clave**, **valor** (opcional) y **efecto**:

```bash
kubectl taint nodes nodo-gpu-1 gpu=true:NoSchedule     # añadir
kubectl taint nodes nodo-gpu-1 gpu=true:NoSchedule-    # quitar (guion al final)
```

| Efecto | Qué hace con los Pods que **no** lo toleran |
|---|---|
| **NoSchedule** | No se programan Pods nuevos. Los que ya están, **se quedan**. |
| **PreferNoSchedule** | El scheduler **intenta evitar** el Node, sin garantía. |
| **NoExecute** | No se programan nuevos **y se desalojan** los que ya están. |

### Tolerations

Van en el Pod:

```yaml
tolerations:
  - key: gpu
    operator: Equal       # (por defecto) la clave y el valor deben coincidir
    value: "true"
    effect: NoSchedule
```

Con `operator: Exists` basta con que exista la clave (sin valor). Con `NoExecute`, `tolerationSeconds` indica cuánto tiempo puede seguir el Pod en el Node tras aparecer el taint.

### Toleration no es afinidad

Una toleration **permite** ir al Node con taint, **no obliga**. Para **Nodes dedicados** se combinan las dos:

1. **Taint** en los Nodes GPU → los demás Pods no van allí.
2. **Toleration + afinidad (o `nodeSelector`)** en los Pods de GPU → pueden ir y además **solo** van allí.

Kubernetes también usa taints automáticamente: el control plane suele tener `node-role.kubernetes.io/control-plane:NoSchedule`, y un Node que deja de responder recibe taints `NoExecute` para que sus Pods se reprogramen en otro sitio.

### Mantenimiento de un Node

| Comando | Qué hace |
|---|---|
| `kubectl cordon NODE` | Marca el Node como **no programable**: no llegan Pods nuevos; los actuales siguen. |
| `kubectl drain NODE --ignore-daemonsets` | **Cordon + desaloja** los Pods (respetando los PodDisruptionBudgets) para que se reprogramen en otros Nodes. |
| `kubectl uncordon NODE` | Vuelve a admitir Pods tras el mantenimiento. |

`drain` necesita `--ignore-daemonsets` si hay Pods de DaemonSets (que no se desalojan), `--delete-emptydir-data` si algún Pod usa `emptyDir`, y `--force` para Pods sin controlador (que **no** se recrearán).

## Ejemplo

Dedicar Nodes con GPU a los trabajos de ML:

```bash
kubectl taint nodes nodo-gpu-1 gpu=true:NoSchedule
kubectl label nodes nodo-gpu-1 gpu=true
```

```yaml
spec:
  tolerations:
    - key: gpu
      operator: Equal
      value: "true"
      effect: NoSchedule
  nodeSelector:
    gpu: "true"                 # y además SOLO en Nodes con GPU
  containers:
    - name: entrenamiento
      image: ghcr.io/tienda/ml:0.4.0
```

Mantenimiento de un Node:

```bash
kubectl drain nodo-2 --ignore-daemonsets --delete-emptydir-data
# ... actualizar, reiniciar ...
kubectl uncordon nodo-2
```

## Errores comunes

- **Pensar que la toleration hace que el Pod vaya a ese Node**: solo lo permite. Añade afinidad o `nodeSelector`.
- **Olvidar el guion final** al quitar un taint (o escribirlo con otro valor/efecto).
- **Usar `NoExecute` sin pensarlo**: desaloja al momento los Pods en marcha que no lo toleran.
- **`drain` que no termina**: Pods de DaemonSets (falta `--ignore-daemonsets`), un PodDisruptionBudget que no permite desalojar más Pods, o Pods sin controlador (falta `--force`).
- **Olvidar el `uncordon`** tras el mantenimiento: el Node sigue sin recibir Pods.

## En la entrevista

**«¿Diferencia entre taints/tolerations y node affinity?»**
Los taints hacen que un Node repela Pods y las tolerations permiten a ciertos Pods ignorarlo; la afinidad hace que un Pod busque ciertos Nodes. Para Nodes dedicados se combinan: taint en el Node, y toleration más afinidad en los Pods.

**«¿Cómo sacas un Node del clúster para mantenimiento sin cortar el servicio?»**
`kubectl drain` (que hace cordon y desaloja los Pods respetando los PodDisruptionBudgets, para que se reprogramen en otros Nodes), el mantenimiento, y después `kubectl uncordon`. Las aplicaciones deben tener varias réplicas para no quedarse sin servicio.

## Resumen

- **Taint** = el Node repele Pods; **toleration** = el Pod puede ignorarlo.
- Efectos: **NoSchedule**, **PreferNoSchedule**, **NoExecute** (desaloja los que ya están).
- La toleration **permite, no obliga**: para Nodes dedicados, **taint + toleration + afinidad**.
- `kubectl taint nodes N clave=valor:Efecto` (y con `-` al final para quitarlo).
- Mantenimiento: **`cordon`**, **`drain --ignore-daemonsets`**, **`uncordon`**.
