---
title: CustomResourceDefinitions
minutes: 10
---

## Qué problema resuelve

Kubernetes trae objetos para cosas genéricas: Pods, Deployments, Services… Pero muchas herramientas necesitan describir **conceptos propios**:

- cert-manager necesita un objeto **`Certificate`** («quiero un certificado TLS para `tienda.example.com`»).
- El Prometheus Operator usa **`ServiceMonitor`** («recoge métricas de estos Services»).
- Un operator de PostgreSQL usa **`Cluster`** («quiero una base de datos con 3 réplicas»).

Una **CustomResourceDefinition** (CRD) **añade un tipo nuevo a la API** de Kubernetes. Después puedes crear objetos de ese tipo con `kubectl apply`, como cualquier otro.

## Analogía

La API de Kubernetes es como un **formulario oficial** con casillas fijas. Una CRD es **añadir un modelo de formulario nuevo** al registro: a partir de ese momento, la oficina acepta y archiva formularios de ese tipo, y comprueba que estén bien rellenados.

## Concepto

### CRD y custom resource

- La **CRD** define el tipo: nombre, grupo de API, versiones y **esquema** (qué campos tiene y de qué tipo).
- Un **custom resource** (CR) es un objeto de ese tipo, igual que un Pod es un objeto del tipo Pod.

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: backups.tienda.example.com        # <plural>.<grupo>
spec:
  group: tienda.example.com
  scope: Namespaced                       # o Cluster
  names:
    plural: backups
    singular: backup
    kind: Backup
    shortNames: [bk]
  versions:
    - name: v1
      served: true                        # la API sirve esta versión
      storage: true                       # se guarda en etcd con esta versión (solo una)
      schema:
        openAPIV3Schema:                  # validación de los campos
          type: object
          properties:
            spec:
              type: object
              properties:
                schedule:
                  type: string
                retentionDays:
                  type: integer
                  minimum: 1
```

Y un objeto de ese tipo:

```yaml
apiVersion: tienda.example.com/v1
kind: Backup
metadata:
  name: pedidos-diario
spec:
  schedule: "0 3 * * *"
  retentionDays: 7
```

### Qué hace (y qué no) una CRD

- La API **valida** los objetos con el esquema y los **guarda** en etcd.
- Funcionan `kubectl get backups`, `kubectl get bk`, `kubectl describe`, RBAC sobre el recurso `backups`…
- Pero una CRD **por sí sola no hace nada**: crear un `Backup` no hace ninguna copia de seguridad. Hace falta un **controlador** que vigile esos objetos y actúe (siguiente lección).

### Cuidado al borrar

Si **borras una CRD**, Kubernetes **borra todos los objetos** de ese tipo en todo el clúster. Desinstalar una herramienta sin cuidado puede borrar, por ejemplo, todos tus `Certificate` o la definición de tus bases de datos.

## Ejemplo

```bash
kubectl get crds                                   # todas las CRDs del clúster
kubectl api-resources --api-group=cert-manager.io  # los tipos que añade un grupo
kubectl get certificates -A                        # custom resources de cert-manager
kubectl describe certificate web-tls -n tienda
```

```text
NAME                                  CREATED AT
certificates.cert-manager.io          2026-06-02T09:14:11Z
issuers.cert-manager.io               2026-06-02T09:14:11Z
servicemonitors.monitoring.coreos.com 2026-06-10T16:40:03Z
```

## Errores comunes

- **Esperar que una CRD haga algo por sí sola**: sin su controlador, los objetos se guardan pero nadie actúa.
- **Aplicar un custom resource antes que su CRD**: error «no matches for kind». Instala primero las CRDs.
- **Borrar una CRD** para «reinstalar» una herramienta: borra todos sus objetos.
- **Esquema demasiado abierto**: sin validación, se aceptan objetos con errores que el controlador no sabrá tratar.

## En la entrevista

**«¿Qué es una CRD?»**
Una forma de ampliar la API de Kubernetes con un tipo nuevo, con su grupo, versiones y esquema de validación. Los objetos de ese tipo (custom resources) se gestionan con kubectl y RBAC como cualquier otro. Por sí sola solo guarda datos: la lógica la pone un controlador.

**«¿Qué pasa si borras una CRD?»**
Se eliminan el endpoint de la API y todos los objetos de ese tipo en el clúster. Por eso hay que tener cuidado al desinstalar operators.

## Resumen

- **CRD** = tipo nuevo en la API (grupo, `names`, versiones, **esquema**). **Custom resource** = un objeto de ese tipo.
- Se usan con kubectl y RBAC como cualquier recurso.
- Una CRD **solo guarda y valida**: hace falta un **controlador** para que pase algo.
- **Borrar la CRD borra todos sus objetos**.
- `kubectl get crds`, `kubectl api-resources`.
