---
title: Redes e identidad en GKE
minutes: 12
---

## Qué problema resuelve

Un clúster de GKE vive dentro de tu VPC y usa servicios de Google Cloud. Surgen varias preguntas:

- ¿Qué **IPs** reciben los Pods y los Services, y cómo se integran con la VPC?
- ¿Cómo evito que los **nodos** estén expuestos a internet?
- ¿Cómo sale tráfico de un Service `LoadBalancer` o de un Ingress?
- Y la más importante: ¿cómo lee un Pod un bucket o una base de datos **sin meter una clave JSON** en un Secret?

## Analogía

**Workload Identity Federation** es como el **pase de empleado** de una empresa: en vez de dar a cada trabajador una copia de la llave maestra (la clave JSON), cada uno lleva un pase a su nombre que abre solo las puertas que le corresponden, y que se puede retirar en cualquier momento.

## Concepto

### Clústeres VPC-native

En GKE los Pods y los Services reciben IPs de **rangos secundarios** de la subred (*alias IP*):

- La subred tiene su **rango principal** para los **nodos**.
- Un **rango secundario** para los **Pods**.
- Otro **rango secundario** para los **Services**.

Así los Pods tienen IPs **de la VPC**: otras VMs y Cloud SQL pueden hablar con ellos directamente, y las reglas de firewall los entienden. Planifica bien los rangos: si el de Pods se queda pequeño, **no caben más nodos**.

### Nodos privados

Con **`--enable-private-nodes`** los nodos **no tienen IP pública**. Para que puedan descargar imágenes de registros externos necesitan **Cloud NAT** en la región. Es la configuración recomendada.

El **endpoint del control plane** (la API de Kubernetes) también se puede restringir a redes autorizadas o a acceso interno.

### Exponer aplicaciones

GKE conecta los objetos de Kubernetes con los balanceadores de Google Cloud:

| Objeto de Kubernetes | Qué crea GKE |
|---|---|
| Service `type: LoadBalancer` | Un **Network Load Balancer** (capa 4) con IP externa. |
| Ingress (clase `gce`) o Gateway | Un **Application Load Balancer** (capa 7, HTTP/S). |

Con el **balanceo nativo de contenedores** (NEG), el balanceador envía el tráfico **directamente a los Pods**, sin pasar por el nodo y kube-proxy.

### Almacenamiento

Un **PersistentVolumeClaim** en GKE crea un **Persistent Disk** mediante el driver CSI de Compute Engine. Un Persistent Disk normal es **zonal**: el Pod que lo usa tiene que estar en esa zona. Para `ReadWriteMany` se usa **Filestore**.

### Workload Identity Federation for GKE

Es la forma recomendada de que los Pods usen **APIs de Google Cloud**.

En Kubernetes, cada Pod se ejecuta con una **ServiceAccount**: la identidad del Pod dentro del clúster (si no indicas ninguna, la `default` de su namespace). Con Workload Identity Federation, cada **ServiceAccount de Kubernetes** obtiene una identidad de IAM, y le das roles como a cualquier principal:

```text
principal://iam.googleapis.com/projects/NÚMERO_PROYECTO/locations/global/
  workloadIdentityPools/ID_PROYECTO.svc.id.goog/subject/ns/NAMESPACE/sa/KSA
```

- **Sin claves JSON**: nada que robar ni que rotar.
- **Permisos por aplicación**: cada ServiceAccount tiene solo lo suyo, en vez de usar la cuenta de servicio del nodo, que comparten todos los Pods de ese nodo.
- En **Autopilot** está siempre activado; en Standard se activa con `--workload-pool=ID_PROYECTO.svc.id.goog`.

También existe la forma anterior: vincular la ServiceAccount de Kubernetes con una **cuenta de servicio de IAM**, anotándola con `iam.gke.io/gcp-service-account` y dando a la ServiceAccount de Kubernetes el rol `roles/iam.workloadIdentityUser` sobre la cuenta de IAM.

## Ejemplo

El Deployment `facturas`, en el namespace `pro`, necesita leer objetos del bucket `tienda-facturas`:

```bash
# 1. ServiceAccount de Kubernetes para la app
kubectl create serviceaccount facturas -n pro

# 2. Rol de IAM sobre el bucket, directamente para esa ServiceAccount
gcloud storage buckets add-iam-policy-binding gs://tienda-facturas \
  --role=roles/storage.objectViewer \
  --member=principal://iam.googleapis.com/projects/123456789012/locations/global/workloadIdentityPools/tienda.svc.id.goog/subject/ns/pro/sa/facturas
```

```yaml
# 3. El Deployment usa esa ServiceAccount
spec:
  template:
    spec:
      serviceAccountName: facturas
      containers:
        - name: facturas
          image: europe-west1-docker.pkg.dev/tienda/apps/facturas:1.0.0
```

Las librerías de Google Cloud dentro del Pod obtienen credenciales automáticamente, sin configurar nada.

## Errores comunes

- **Guardar una clave JSON de una cuenta de servicio en un Secret**: si se filtra, da acceso hasta que alguien la revoque. Usa Workload Identity Federation.
- **Dar permisos a la cuenta de servicio de los nodos**: todos los Pods de esos nodos los heredan.
- **Rango de Pods demasiado pequeño**: el clúster no puede crecer aunque haya presupuesto.
- **Nodos privados sin Cloud NAT**: no pueden descargar imágenes de Docker Hub u otros registros externos.
- **Olvidar `serviceAccountName`** en el Pod: usa la ServiceAccount `default` del namespace, sin los permisos esperados.

## En la entrevista

**«¿Cómo accede un Pod de GKE a Cloud Storage de forma segura?»**
Con Workload Identity Federation for GKE: creo una ServiceAccount de Kubernetes para la aplicación, le doy en IAM solo el rol que necesita sobre el bucket y el Pod la usa con `serviceAccountName`. Sin claves JSON y sin dar permisos a la cuenta de servicio de los nodos.

**«¿Qué es un clúster VPC-native?»**
Uno en el que los Pods y los Services reciben IPs de rangos secundarios de la subred (alias IP). Los Pods son direccionables dentro de la VPC, se integran con el firewall y con el balanceo nativo de contenedores.

## Resumen

- **VPC-native**: nodos en el rango principal; **Pods** y **Services** en **rangos secundarios**.
- **Nodos privados** + **Cloud NAT** para salir a internet.
- `LoadBalancer` → **Network LB**; Ingress/Gateway → **Application LB**; NEG = tráfico directo a los Pods.
- PVC → **Persistent Disk** (zonal); `ReadWriteMany` → **Filestore**.
- **Workload Identity Federation**: ServiceAccount de Kubernetes con roles de IAM, **sin claves JSON**.
