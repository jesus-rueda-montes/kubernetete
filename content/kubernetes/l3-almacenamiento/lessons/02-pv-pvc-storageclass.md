---
title: PersistentVolumes, PVCs y StorageClasses
minutes: 12
---

## Qué problema resuelve

Una base de datos en Kubernetes necesita un disco que **sobreviva** al Pod: si el Pod se recrea en otro Node, debe volver a encontrar sus datos. Además, el desarrollador que escribe el manifest no debería saber **qué disco concreto** de qué proveedor se usa: solo «necesito 20 GiB rápidos».

Kubernetes separa **pedir almacenamiento** (PVC) de **proporcionarlo** (PV), y automatiza la creación de discos con las **StorageClasses**.

## Analogía

Es como **alquilar un trastero**:

- El **PersistentVolumeClaim** es tu **solicitud**: «quiero un trastero de 20 m² con acceso de día».
- El **PersistentVolume** es un **trastero concreto** que existe en el edificio.
- La **StorageClass** es la **empresa de trasteros** que, si no hay uno libre que encaje, **construye uno nuevo** a tu medida (aprovisionamiento dinámico).

## Concepto

| Objeto | Qué es | Ámbito |
|---|---|---|
| **PersistentVolume (PV)** | Un trozo de almacenamiento real (un Persistent Disk, un volumen NFS…) | **Clúster** (sin namespace) |
| **PersistentVolumeClaim (PVC)** | Una **petición** de almacenamiento: tamaño, access mode, clase | **Namespace** |
| **StorageClass** | Un **tipo** de almacenamiento y quién lo crea (su *provisioner*, normalmente un driver CSI) | Clúster |

### Cómo se unen

1. Creas un **PVC**.
2. Kubernetes busca un PV compatible y los **vincula** (*bind*): la relación es **1 a 1** y exclusiva.
3. Si no hay ninguno y el PVC indica una **StorageClass**, esta **crea el disco y su PV automáticamente** (aprovisionamiento **dinámico**, lo habitual en la nube).
4. El Pod monta el **PVC** por su nombre (`persistentVolumeClaim.claimName`).

Si un PVC no indica `storageClassName`, se usa la StorageClass **por defecto** del clúster (la marcada con la annotation `storageclass.kubernetes.io/is-default-class: "true"`). En GKE, EKS y AKS ya viene una.

### Access modes

| Modo | Abreviatura | Significado |
|---|---|---|
| ReadWriteOnce | **RWO** | Lectura y escritura desde **un solo Node** (pueden ser varios Pods de ese Node). |
| ReadOnlyMany | **ROX** | Solo lectura desde **varios Nodes**. |
| ReadWriteMany | **RWX** | Lectura y escritura desde **varios Nodes**. |
| ReadWriteOncePod | **RWOP** | Lectura y escritura desde **un solo Pod**. |

Un disco de bloque (Persistent Disk, EBS) normalmente solo admite **RWO**. Para **RWX** hace falta almacenamiento de ficheros (Filestore, EFS, NFS).

### Qué pasa al borrar el PVC: `reclaimPolicy`

| Política | Al borrar el PVC… |
|---|---|
| **Delete** (por defecto en aprovisionamiento dinámico) | Se borran el PV **y el disco real**. |
| **Retain** | El PV y el disco se conservan; un administrador decide qué hacer. |

Además, Kubernetes **protege** los PVC en uso: si borras uno que un Pod está usando, queda en `Terminating` hasta que el Pod lo suelta.

### Otros ajustes de la StorageClass

- **`volumeBindingMode: WaitForFirstConsumer`**: el disco no se crea hasta que hay un Pod que lo usa, para crearlo **en la zona** donde se programa ese Pod (con `Immediate` podría crearse en otra zona y el Pod no podría montarlo).
- **`allowVolumeExpansion: true`**: permite **ampliar** el volumen editando el tamaño del PVC.

## Ejemplo

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: datos-postgres
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: standard-rwo      # una clase de GKE (se puede omitir para usar la de por defecto)
  resources:
    requests:
      storage: 20Gi
---
apiVersion: v1
kind: Pod
metadata:
  name: postgres
spec:
  containers:
    - name: postgres
      image: postgres:17
      env:
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
      volumeMounts:
        - name: datos
          mountPath: /var/lib/postgresql/data
  volumes:
    - name: datos
      persistentVolumeClaim:
        claimName: datos-postgres     # monta el PVC por su nombre
```

```bash
kubectl get pvc          # STATUS Bound, VOLUME pvc-3f1c..., CAPACITY 20Gi
kubectl get pv           # el PV creado automáticamente (sin namespace)
kubectl get storageclass # clases disponibles; "(default)" marca la predeterminada
```

(Para bases de datos con varias réplicas se usan **StatefulSets**, en el siguiente módulo.)

## Errores comunes

- **PVC en `Pending` para siempre**: no hay StorageClass por defecto, la clase no existe, o se pide un access mode que el driver no soporta (p. ej. RWX con Persistent Disk).
- **Borrar el PVC creyendo que el disco se queda**: con `Delete` (el valor por defecto), **se borran los datos**. Para datos críticos, `Retain` y copias de seguridad.
- **Pedir RWX a un disco de bloque**: no está soportado; usa almacenamiento de ficheros.
- **Pod que no arranca por la zona**: el disco está en una zona y el Pod se programó en otra. `WaitForFirstConsumer` lo evita.
- **Confundir RWO con «un solo Pod»**: RWO es un solo **Node**; para un solo Pod existe RWOP.

## En la entrevista

**«Explica PV, PVC y StorageClass.»**
El PVC es la petición de almacenamiento de una aplicación (tamaño, access mode, clase), en su namespace. El PV es el almacenamiento real, a nivel de clúster. La StorageClass define un tipo de almacenamiento y un provisioner que crea discos y PVs automáticamente cuando llega un PVC. El Pod monta el PVC por su nombre.

**«¿Qué significa ReadWriteOnce?»**
Que el volumen se puede montar en lectura y escritura desde un único Node a la vez (varios Pods de ese mismo Node sí pueden usarlo). Para varios Nodes escribiendo hace falta RWX, con almacenamiento de ficheros.

## Resumen

- **PVC** (petición, con namespace) → se vincula 1 a 1 con un **PV** (almacenamiento real, de clúster).
- La **StorageClass** crea discos y PVs **dinámicamente**; sin `storageClassName` se usa la **por defecto**.
- Access modes: **RWO** (un Node), **ROX**, **RWX** (varios Nodes, ficheros), **RWOP** (un Pod).
- `reclaimPolicy`: **Delete** (por defecto, borra el disco) o **Retain**.
- **`WaitForFirstConsumer`** crea el disco en la zona del Pod; `allowVolumeExpansion` permite ampliarlo.
