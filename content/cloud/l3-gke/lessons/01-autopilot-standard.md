---
title: Autopilot, Standard y node pools
minutes: 12
---

## Qué problema resuelve

Montar Kubernetes a mano significa instalar y mantener el **control plane** (API server, etcd, scheduler…), los nodos, las actualizaciones de versión y la alta disponibilidad. Es mucho trabajo y muy delicado.

**GKE** (*Google Kubernetes Engine*) es Kubernetes **gestionado**: Google opera el control plane, lo actualiza y lo mantiene disponible. Tú decides cuánto quieres gestionar de los **nodos**, y ahí está la gran elección: **Autopilot** o **Standard**.

## Analogía

- **Standard** es alquilar una **nave industrial vacía**: Google pone el edificio y la seguridad, pero tú eliges y colocas las máquinas (nodos) y pagas por ellas aunque estén paradas.
- **Autopilot** es un **coworking**: solo dices cuántos puestos necesitas (los *requests* de tus Pods) y pagas por esos puestos; del mobiliario se ocupan ellos.

## Concepto

### Autopilot frente a Standard

| | Autopilot | Standard |
|---|---|---|
| Nodos | Los gestiona Google: crea, escala y actualiza los que hagan falta | Los gestionas tú con **node pools** |
| Pago | Por los recursos que **piden los Pods** (en general) | Por los **nodos** (VMs), se usen o no |
| Seguridad | Configuración endurecida por defecto (sin Pods privilegiados, sin SSH a los nodos) | La configuras tú |
| Flexibilidad | Menos: algunas cosas no se permiten | Total: tipos de máquina, SO del nodo, DaemonSets privilegiados… |
| Cuándo | **Recomendado** para la mayoría de cargas | Necesitas un control del nodo que Autopilot no permite |

En Autopilot los **requests** de CPU y memoria de tus Pods importan todavía más: son lo que pagas.

### Clúster regional o zonal

- **Zonal**: una sola réplica del control plane, en una zona. Si esa zona cae, o durante una actualización del control plane, **no puedes usar la API** del clúster (los Pods siguen funcionando).
- **Regional**: el control plane se replica en **varias zonas** de la región y los nodos se reparten por ellas. Es lo recomendado en **producción**. Los clústeres Autopilot son siempre regionales.

Cuidado con `--num-nodes` en un clúster regional: es el número de nodos **por zona**. Con el valor por defecto (3) y 3 zonas, tendrás **9 nodos**.

### Node pools (Standard)

Un **node pool** es un grupo de nodos con la **misma configuración**: tipo de máquina, disco, labels, taints, VMs Spot o no. Un clúster puede tener varios:

- Uno **general** para la mayoría de Pods.
- Uno con **GPU**, con un taint para que solo vayan los Pods que lo toleren.
- Uno con **VMs Spot**, más barato, para trabajos que soportan interrupciones.

Cada node pool puede tener **autoescalado** (*cluster autoscaler*): añade nodos cuando hay Pods en `Pending` por falta de sitio y los quita cuando sobran.

### Canales de versiones

GKE actualiza el clúster automáticamente según su **canal** (*release channel*):

| Canal | Para qué |
|---|---|
| **Rapid** | Probar versiones nuevas cuanto antes (no para producción). |
| **Regular** | Por defecto. Equilibrio entre novedades y estabilidad. |
| **Stable** | Prioriza la estabilidad: las versiones llegan las últimas. |
| **Extended** | Permite quedarse más tiempo en una versión menor. |

Las **ventanas y exclusiones de mantenimiento** controlan **cuándo** se actualiza. Las actualizaciones de nodos drenan los nodos uno a uno, así que tus Deployments necesitan **varias réplicas** y, mejor, un **PodDisruptionBudget**.

### Conectarte con kubectl

```bash
gcloud container clusters get-credentials NOMBRE --region=REGIÓN
```

Escribe en tu kubeconfig el endpoint y las credenciales del clúster. Desde ahí, `kubectl` funciona como en cualquier Kubernetes.

## Ejemplo

```bash
# Autopilot: la opción recomendada
gcloud container clusters create-auto tienda-pro \
  --region=europe-west1 --release-channel=regular

# Standard regional con autoescalado (1 a 3 nodos por zona)
gcloud container clusters create tienda-std \
  --region=europe-west1 --num-nodes=1 \
  --enable-autoscaling --min-nodes=1 --max-nodes=3 \
  --workload-pool=tienda.svc.id.goog

# Un node pool Spot para trabajos por lotes
gcloud container node-pools create lotes-spot \
  --cluster=tienda-std --region=europe-west1 --spot \
  --node-taints=spot=true:NoSchedule

gcloud container clusters get-credentials tienda-pro --region=europe-west1
kubectl get nodes
```

## Errores comunes

- **Clúster zonal en producción**: una caída de zona o una actualización deja sin API al clúster.
- **Olvidar que `--num-nodes` es por zona** en clústeres regionales: el triple de nodos (y de coste) de lo esperado.
- **Pods sin requests en Autopilot**: GKE aplica valores por defecto que quizá no encajan con tu aplicación, y pagas por ellos.
- **Deployments con una sola réplica**: cada actualización automática de nodos provoca una caída.
- **Un único node pool para todo**: mezclar GPU, Spot y cargas normales complica el scheduling y los costes.

## En la entrevista

**«¿Autopilot o Standard?»**
Por defecto, Autopilot: Google gestiona los nodos, la seguridad viene endurecida y pago por los recursos que piden mis Pods. Elijo Standard cuando necesito control del nodo: tipos de máquina o configuración especial, cargas privilegiadas o un aprovechamiento de nodos que me salga más barato.

**«¿Cómo harías un clúster de GKE altamente disponible?»**
Regional, para tener el control plane y los nodos en varias zonas; aplicaciones con varias réplicas repartidas entre zonas y PodDisruptionBudgets; un canal de versiones y ventanas de mantenimiento para controlar las actualizaciones.

## Resumen

- **GKE**: Google gestiona el control plane.
- **Autopilot** (recomendado): Google gestiona los nodos; pagas por los **requests** de los Pods. **Standard**: gestionas **node pools** y pagas por nodo.
- **Regional** (control plane en varias zonas) para producción; `--num-nodes` es **por zona**.
- **Node pools** para separar tipos de nodo (general, GPU, Spot), con autoescalado.
- **Canales de versiones** (Rapid, Regular, Stable, Extended) y ventanas de mantenimiento.
- `gcloud container clusters get-credentials` configura `kubectl`.
