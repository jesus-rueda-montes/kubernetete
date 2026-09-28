---
title: Las piezas de un clúster
minutes: 12
---

## Qué problema resuelve

Cuando algo falla en Kubernetes («mi Pod se queda en `Pending`», «el clúster no responde»), necesitas saber **qué pieza hace qué** para saber dónde mirar. Además, es una de las preguntas más habituales en cualquier entrevista: «explícame la arquitectura de Kubernetes».

## Analogía

Un clúster es como un **restaurante**:

- La **recepción** (API server) es el único punto de entrada: todos los pedidos pasan por ahí.
- El **libro de reservas** (etcd) guarda todo lo que se ha pedido y lo que hay.
- El **jefe de sala** (scheduler) decide en qué mesa (Node) se sienta cada grupo (Pod).
- Los **encargados** (controllers) revisan que todo coincida con lo pedido.
- En cada zona, un **camarero** (kubelet) se asegura de que su mesa tiene exactamente lo que se le asignó, y avisa si algo va mal.

## Concepto

Un **clúster** de Kubernetes tiene dos partes: el **control plane** (el cerebro) y los **nodes** (las máquinas que ejecutan tus Pods).

```
            kubectl ──HTTPS──▶ ┌───────────── Control plane ─────────────┐
                               │  kube-apiserver ◀──▶ etcd               │
                               │     ▲        ▲                          │
                               │  scheduler  controller-manager          │
                               └─────┼───────────────────────────────────┘
                                     │ (todos hablan con el API server)
              ┌──────── Node ────────┴───┐     ┌──────── Node ────────────┐
              │ kubelet  kube-proxy      │     │ kubelet  kube-proxy      │
              │ container runtime        │     │ container runtime        │
              │ [Pod] [Pod]              │     │ [Pod]                    │
              └──────────────────────────┘     └──────────────────────────┘
```

### Control plane

| Componente | Qué hace |
|---|---|
| **kube-apiserver** | Expone la API HTTP de Kubernetes. Es la **puerta de entrada**: `kubectl`, los nodes y el resto de componentes hablan con él. Comprueba quién eres (autenticación), si puedes hacerlo (autorización) y valida los objetos antes de guardarlos. |
| **etcd** | Base de datos **clave-valor**, consistente y de alta disponibilidad, donde se guarda **todo el estado del clúster**. Solo el API server habla con ella. Perder etcd sin copia de seguridad es perder el clúster. |
| **kube-scheduler** | Busca Pods que aún no tienen Node asignado y elige el más adecuado (según los recursos que piden, restricciones, afinidades…). Solo **decide**; no arranca nada. |
| **kube-controller-manager** | Ejecuta los **controllers** (de Deployments, de ReplicaSets, de Nodes, de Jobs…), cada uno con su bucle de reconciliación. |
| **cloud-controller-manager** | *Opcional.* Conecta el clúster con el proveedor de nube: crea sus load balancers, detecta máquinas borradas, etc. |

### Nodes

| Componente | Qué hace |
|---|---|
| **kubelet** | Agente que corre en **cada Node**. Mira qué Pods tiene asignados su Node, pide al container runtime que arranque sus contenedores y **informa de su estado** al API server. |
| **kube-proxy** | *Opcional.* Mantiene reglas de red en el Node para que funcionen los **Services** (una IP estable delante de varios Pods). Algunos plugins de red lo sustituyen. |
| **Container runtime** | El software que realmente ejecuta los contenedores, por ejemplo **containerd** o **CRI-O**. El kubelet le habla mediante una interfaz estándar llamada **CRI**. |

Además hay **addons** que casi todos los clústeres instalan, como el **DNS del clúster** (para encontrar Services por su nombre).

### Qué ocurre al hacer `kubectl apply`

1. `kubectl` envía el manifest al **API server**.
2. El API server lo valida y lo guarda en **etcd**.
3. Un **controller** ve el objeto nuevo y crea los Pods que hacen falta (también a través del API server).
4. El **scheduler** ve Pods sin Node y asigna a cada uno un Node.
5. El **kubelet** de ese Node ve que tiene un Pod nuevo y pide al **container runtime** que arranque sus contenedores.
6. El kubelet informa del estado (`Running`), que queda guardado en etcd.

Fíjate: **ningún componente da órdenes directamente a otro**. Todos observan el API server y reaccionan a los cambios.

### Clústeres gestionados

En GKE (Google), EKS (AWS) o AKS (Azure), el proveedor gestiona el control plane por ti: tú solo ves los nodes (o ni siquiera eso, en modos como GKE Autopilot).

## Ejemplo

Comandos para asomarte a la arquitectura de un clúster:

```bash
kubectl cluster-info                  # Dirección del control plane
kubectl get nodes                     # Máquinas del clúster y si están Ready
kubectl get nodes -o wide             # Además: IPs, sistema operativo y container runtime
kubectl get pods -n kube-system       # Pods de sistema (DNS, kube-proxy... según el clúster)
```

Salida típica de `kubectl get nodes`:

```
NAME       STATUS   ROLES           AGE   VERSION
nodo-1     Ready    control-plane   12d   v1.34.1
nodo-2     Ready    <none>          12d   v1.34.1
```

`STATUS Ready` significa que el kubelet de ese Node está informando de que todo va bien. Un Node `NotReady` es la primera pista de que una máquina tiene problemas.

## Errores comunes

- **Creer que el scheduler arranca los Pods.** Solo elige el Node; quien los arranca es el **kubelet** de ese Node.
- **Pensar que los componentes se hablan entre sí.** Todo pasa por el **API server**; solo él toca etcd.
- **Olvidar etcd en las copias de seguridad.** En un clúster que gestionas tú, sin copia de etcd no puedes recuperar el estado.
- **Decir que Kubernetes necesita Docker.** Necesita un container runtime compatible con CRI (containerd, CRI-O…). Las imágenes creadas con Docker funcionan igual.

## En la entrevista

**«¿Qué pasa, paso a paso, cuando creas un Deployment?»**
kubectl lo envía al API server, que lo valida y lo guarda en etcd. El controller de Deployments crea un ReplicaSet, y el de ReplicaSets crea los Pods. El scheduler asigna un Node a cada Pod y el kubelet de ese Node los arranca mediante el container runtime y va informando de su estado.

**«¿Dónde se guarda el estado del clúster y por qué es crítico?»**
En etcd. Es la única fuente de verdad: si se pierde sin copia de seguridad, se pierde la definición de todo lo que hay en el clúster.

## Resumen

- **Control plane**: API server (entrada), etcd (estado), scheduler (elige Node) y controller-manager (reconciliación).
- **Nodes**: kubelet (arranca y vigila Pods), kube-proxy (Services) y container runtime (ejecuta contenedores).
- **Todo pasa por el API server**; solo él habla con etcd.
- El scheduler **decide**; el kubelet **ejecuta**.
- En GKE, EKS o AKS el control plane lo gestiona el proveedor.
