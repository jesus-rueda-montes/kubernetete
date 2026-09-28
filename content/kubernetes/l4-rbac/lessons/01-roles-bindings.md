---
title: Roles, ClusterRoles y bindings
minutes: 12
---

## Qué problema resuelve

En un clúster compartido trabajan varios equipos, pipelines de CI y aplicaciones. Si todos tienen permisos de administrador:

- Un desarrollador puede **borrar por error** el namespace de producción de otro equipo.
- Un pipeline comprometido puede **leer todos los Secrets** del clúster.
- Una aplicación con un fallo de seguridad puede **crear Pods** donde quiera.

**RBAC** (*Role-Based Access Control*) decide **quién** puede hacer **qué acción** sobre **qué recursos** y **dónde**.

## Analogía

En un hotel:

- Un **Role** es la **descripción de un puesto**: «el personal de limpieza puede abrir habitaciones y armarios de toallas».
- Un **RoleBinding** es **dar la tarjeta** de ese puesto a una persona concreta, **en una planta** (un namespace).
- Un **ClusterRole** + **ClusterRoleBinding** es la tarjeta del **director**, que abre todas las plantas.

## Concepto

### Las cuatro piezas

| Objeto | Qué define | Alcance |
|---|---|---|
| **Role** | Permisos (reglas) | Un namespace |
| **ClusterRole** | Permisos (reglas) | Todo el clúster, o reutilizable en cualquier namespace |
| **RoleBinding** | Quién recibe un Role o ClusterRole | Un namespace |
| **ClusterRoleBinding** | Quién recibe un ClusterRole | Todo el clúster |

Separar **permisos** (roles) de **asignaciones** (bindings) permite reutilizar: defines «lector de Pods» una vez y lo asignas a quien haga falta.

### Reglas

Cada regla de un Role dice **qué verbos** sobre **qué recursos** de **qué grupo de API**:

```yaml
rules:
  - apiGroups: [""]              # "" = el grupo core (pods, services, configmaps, secrets…)
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]          # deployments, statefulsets… están en el grupo apps
    resources: ["deployments"]
    verbs: ["get", "list", "update", "patch"]
```

- **Verbos** habituales: `get`, `list`, `watch` (lectura); `create`, `update`, `patch`, `delete` (escritura).
- **Subrecursos** como `pods/log` o `pods/exec` se autorizan aparte: poder ver Pods no te deja hacer `exec` en ellos.
- `kubectl api-resources` te dice el grupo de cada recurso (columna `APIVERSION`).

### Solo se suma

RBAC es **solo aditivo**: **no existen reglas de denegar**. Si alguien tiene varios bindings, sus permisos son la **suma**. Por defecto, sin ningún binding, **no se puede hacer nada**.

### Sujetos

Un binding asigna el rol a uno o varios **sujetos** (*subjects*):

- **`User`**: un usuario. Kubernetes no guarda usuarios: los reconoce por su certificado o por el proveedor de identidad (en GKE, tu cuenta de Google).
- **`Group`**: un grupo de usuarios.
- **`ServiceAccount`**: la identidad de una aplicación o un pipeline, dentro de un namespace.

### ClusterRole en un RoleBinding

Un **RoleBinding** puede apuntar a un **ClusterRole**: da esos permisos **solo en el namespace del binding**. Así defines los permisos una vez (como ClusterRole) y los das por namespace.

Kubernetes trae ClusterRoles predefinidos:

| ClusterRole | Permite |
|---|---|
| `view` | Leer casi todo (no los Secrets). |
| `edit` | Leer y modificar la mayoría de recursos (no roles ni bindings). |
| `admin` | Todo dentro de un namespace, incluidos roles y bindings. |
| `cluster-admin` | Todo en todo el clúster. |

### El binding no se puede cambiar de rol

El `roleRef` de un binding (a qué rol apunta) **no se puede modificar**. Para cambiarlo, borras el binding y lo creas de nuevo.

## Ejemplo

El equipo de pagos puede desplegar en su namespace; el equipo de soporte solo puede mirar:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: pagos-edit
  namespace: pagos
subjects:
  - kind: Group
    name: equipo-pagos@tienda.com
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole          # ClusterRole predefinido...
  name: edit                 # ...aplicado solo en el namespace "pagos"
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: soporte-view
  namespace: pagos
subjects:
  - kind: Group
    name: soporte@tienda.com
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: view
  apiGroup: rbac.authorization.k8s.io
```

Lo mismo con comandos:

```bash
kubectl create role lector-pods --verb=get,list,watch --resource=pods -n pagos
kubectl create rolebinding ana-lector --role=lector-pods --user=ana@tienda.com -n pagos
```

## Errores comunes

- **Dar `cluster-admin` «para que funcione»**: cualquier fallo o credencial robada compromete todo el clúster.
- **Olvidar el `apiGroups`**: los Deployments están en `apps`, no en `""`. La regla no se aplica y el permiso «no funciona».
- **Buscar una regla de «denegar»**: no existe. Quita el binding que da el permiso.
- **ClusterRoleBinding cuando bastaba un RoleBinding**: da el permiso en **todos** los namespaces.
- **Dar `list` sobre Secrets** pensando que solo lista nombres: `list` devuelve también el contenido.
- **Intentar editar el `roleRef`** de un binding: hay que borrarlo y crearlo de nuevo.

## En la entrevista

**«¿Diferencia entre Role y ClusterRole, y entre RoleBinding y ClusterRoleBinding?»**
Role y RoleBinding viven en un namespace; ClusterRole y ClusterRoleBinding, en todo el clúster. Un RoleBinding puede apuntar a un ClusterRole para dar esos permisos solo en su namespace, que es la forma habitual de reutilizar roles como `view` o `edit`.

**«¿Se puede denegar un permiso concreto con RBAC?»**
No: RBAC es solo aditivo. Se parte de no poder hacer nada y se suman permisos. Para quitar algo, se quita el binding o se crea un rol más limitado.

## Resumen

- **Role/ClusterRole** = permisos (verbos + recursos + apiGroups). **RoleBinding/ClusterRoleBinding** = a quién se dan.
- Role y RoleBinding → **namespace**; Cluster* → **clúster**.
- Un **RoleBinding + ClusterRole** da esos permisos **solo en ese namespace**.
- RBAC es **solo aditivo**: sin reglas de denegar.
- Predefinidos: **`view`**, **`edit`**, **`admin`**, **`cluster-admin`**.
