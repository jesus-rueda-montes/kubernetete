---
title: nodeSelector y afinidad
minutes: 11
---

## Qué problema resuelve

Por defecto el scheduler coloca cada Pod en **cualquier Node** con recursos suficientes. Pero a veces necesitas decidir más:

- Un trabajo de ML debe ir a **Nodes con GPU**.
- Las 3 réplicas de tu web **no deben caer en el mismo Node** (ni en la misma zona): si ese Node falla, pierdes todas.
- Una caché debe ir **junto a** la aplicación que la usa, para reducir latencia.

Para esto están **`nodeSelector`**, la **afinidad de Node** y la **afinidad / antiafinidad entre Pods**.

## Analogía

Es como **asignar mesas en una boda**:

- `nodeSelector`: «los niños, en la mesa infantil» (una regla simple por etiqueta).
- Afinidad de Node: «los abuelos, **obligatoriamente** cerca del baño; **preferiblemente** lejos de los altavoces».
- Afinidad entre Pods: «los novios, en la misma mesa que los padrinos»; antiafinidad: «los dos exnovios, **en mesas distintas**».

## Concepto

Todo se basa en las **labels de los Nodes**. Kubernetes pone algunas automáticamente: `kubernetes.io/hostname`, `topology.kubernetes.io/zone`, `topology.kubernetes.io/region`. Otras las añades tú: `kubectl label nodes nodo-3 gpu=true`.

### nodeSelector

La forma más simple: el Pod solo va a Nodes que tengan **todas** esas labels.

```yaml
spec:
  nodeSelector:
    gpu: "true"
```

### Afinidad de Node

Más expresiva: operadores (`In`, `NotIn`, `Exists`, `DoesNotExist`, `Gt`, `Lt`) y reglas **obligatorias** o **preferidas**:

| Tipo | Significado |
|---|---|
| `requiredDuringSchedulingIgnoredDuringExecution` | **Obligatoria**: si ningún Node cumple, el Pod se queda `Pending`. |
| `preferredDuringSchedulingIgnoredDuringExecution` | **Preferencia** con un peso (`weight` 1–100): si no se puede, se coloca igualmente. |

*IgnoredDuringExecution* significa que la regla solo se aplica **al programar**: si después cambian las labels del Node, el Pod **no** se mueve.

### Afinidad y antiafinidad entre Pods

Deciden la colocación según **qué otros Pods** hay ya, dentro de un **dominio** indicado con **`topologyKey`**:

- `topologyKey: kubernetes.io/hostname` → «mismo Node» / «distinto Node».
- `topologyKey: topology.kubernetes.io/zone` → «misma zona» / «distinta zona».

**`podAntiAffinity`** es la forma clásica de **repartir réplicas** para alta disponibilidad. Una alternativa más moderna y flexible para repartir de forma equilibrada son las **`topologySpreadConstraints`** (`maxSkew`: diferencia máxima de Pods entre dominios).

### nodeName

Asigna el Pod **directamente** a un Node y **se salta el scheduler**. Casi nunca es buena idea en aplicaciones: úsalo solo para pruebas o depuración.

## Ejemplo

Un Deployment con 3 réplicas que **debe** ir a Nodes de tipo `general` y cuyas réplicas **prefieren** estar en zonas distintas:

```yaml
spec:
  replicas: 3
  template:
    metadata:
      labels:
        app: web
    spec:
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
              - matchExpressions:
                  - key: tipo
                    operator: In
                    values: [general]
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: web                              # "no quiero estar con otros app=web..."
                topologyKey: topology.kubernetes.io/zone  # "...en la misma zona"
      containers:
        - name: web
          image: nginx:1.27
```

```bash
kubectl label nodes nodo-1 tipo=general
kubectl get nodes --show-labels
kubectl get pods -o wide        # columna NODE: dónde ha caído cada Pod
```

## Errores comunes

- **Antiafinidad obligatoria (`required`) con más réplicas que Nodes o zonas**: las réplicas sobrantes se quedan `Pending` para siempre. Usa `preferred` o topology spread.
- **Olvidar etiquetar los Nodes** que exige un `nodeSelector`: el Pod se queda `Pending` («didn't match Pod's node affinity/selector»).
- **Esperar que el Pod se mueva** al cambiar las labels del Node: *IgnoredDuringExecution*.
- **Usar `nodeName`** en producción: se salta el scheduler y sus comprobaciones.
- **Confundir afinidad de Node con la de Pods**: la primera mira labels de **Nodes**; la segunda, labels de **otros Pods**.

## En la entrevista

**«¿Cómo te aseguras de que las réplicas de un Deployment no acaben en el mismo Node o zona?»**
Con `podAntiAffinity` sobre las propias labels de la aplicación y `topologyKey: kubernetes.io/hostname` (Nodes) o `topology.kubernetes.io/zone` (zonas), normalmente como preferencia; o con `topologySpreadConstraints` para un reparto equilibrado.

**«¿Diferencia entre `nodeSelector` y node affinity?»**
`nodeSelector` exige que el Node tenga ciertas labels exactas. La node affinity permite operadores (`In`, `NotIn`, `Exists`…) y distinguir entre reglas obligatorias y preferencias con peso.

## Resumen

- **`nodeSelector`**: labels exactas del Node, obligatorias.
- **Node affinity**: operadores y reglas **required** (obligatorias) o **preferred** (con peso).
- **Pod (anti)affinity** con **`topologyKey`**: juntar o separar Pods por Node, zona…
- **Antiafinidad / topology spread** para repartir réplicas y ganar disponibilidad.
- *IgnoredDuringExecution*: solo cuenta al programar; **`nodeName`** se salta el scheduler.
