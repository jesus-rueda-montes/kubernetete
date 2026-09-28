---
title: ServiceAccounts y comprobar permisos
minutes: 10
---

## Qué problema resuelve

Las personas no son las únicas que hablan con la API de Kubernetes:

- Un **pipeline de CI** despliega con `kubectl apply`.
- Un **controlador** (como un Ingress controller) vigila Services e Ingress.
- Una **aplicación** lee ConfigMaps o crea Jobs.

Todos necesitan una **identidad** con los permisos justos. Esa identidad es una **ServiceAccount**. Y cuando algo falla con un `Forbidden`, necesitas **comprobar** qué permisos tiene cada uno.

## Analogía

Una ServiceAccount es la **tarjeta de un robot** del almacén: no es una persona, pero necesita su propio pase para abrir solo las puertas que su trabajo requiere.

`kubectl auth can-i` es **probar la tarjeta en el lector** antes de mandar al robot: «¿esta tarjeta abre esta puerta?».

## Concepto

### ServiceAccounts

- Es un objeto **con namespace**: `pro/facturas` y `dev/facturas` son identidades distintas.
- Cada namespace tiene una ServiceAccount **`default`**. Si un Pod no indica ninguna, usa esa.
- Un Pod elige la suya con **`spec.serviceAccountName`**.
- Kubernetes monta en el Pod un **token de corta duración** que se renueva solo, y que la aplicación usa para hablar con la API.
- Si la aplicación **no necesita** hablar con la API, desactiva el montaje: **`automountServiceAccountToken: false`**. Un token que no está no se puede robar.

En RBAC, una ServiceAccount se nombra así:

```yaml
subjects:
  - kind: ServiceAccount
    name: despliegue-ci
    namespace: pro
```

Y para `--as` o en logs aparece como **`system:serviceaccount:NAMESPACE:NOMBRE`**.

### Comprobar permisos

```bash
kubectl auth can-i create deployments -n pro                  # ¿puedo yo?
kubectl auth can-i list secrets -n pro \
  --as=system:serviceaccount:pro:despliegue-ci                # ¿puede esta ServiceAccount?
kubectl auth can-i --list -n pro                              # todo lo que puedo hacer aquí
kubectl auth whoami                                           # ¿quién soy para el clúster?
```

`can-i` responde **`yes`** o **`no`**. Suplantar a otro con `--as` requiere a su vez el permiso `impersonate`, así que normalmente lo hacen los administradores.

### Buenas prácticas

- **Una ServiceAccount por aplicación**, nunca la `default` con permisos añadidos.
- **Mínimo privilegio**: solo los verbos y recursos necesarios, en su namespace (Role + RoleBinding).
- **No dar acceso a Secrets** sin necesidad: quien lee Secrets puede leer credenciales y escalar privilegios.
- **Cuidado con `pods/exec`, `create pods` y `escalate`/`bind`**: permiten, de forma indirecta, conseguir más permisos.
- **Revisar los ClusterRoleBindings** de vez en cuando: son los que más poder dan.

## Ejemplo

Un pipeline que solo puede desplegar en `pro`:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: despliegue-ci
  namespace: pro
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: desplegador
  namespace: pro
rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "create", "update", "patch"]
  - apiGroups: [""]
    resources: ["services", "configmaps"]
    verbs: ["get", "list", "create", "update", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: despliegue-ci
  namespace: pro
subjects:
  - kind: ServiceAccount
    name: despliegue-ci
    namespace: pro
roleRef:
  kind: Role
  name: desplegador
  apiGroup: rbac.authorization.k8s.io
```

```bash
kubectl auth can-i update deployments -n pro --as=system:serviceaccount:pro:despliegue-ci   # yes
kubectl auth can-i delete deployments -n pro --as=system:serviceaccount:pro:despliegue-ci   # no
kubectl auth can-i get secrets -n pro --as=system:serviceaccount:pro:despliegue-ci         # no
```

## Errores comunes

- **Dar permisos a la ServiceAccount `default`**: todos los Pods del namespace que no indiquen otra los heredan.
- **Error `Forbidden` y dar más permisos a ciegas**: el mensaje dice **quién**, **qué verbo** y **qué recurso** faltan. Da exactamente eso.
- **Olvidar el `namespace` del sujeto** en un binding de ServiceAccount: apunta a otra identidad.
- **Montar el token en Pods que no hablan con la API**: superficie de ataque innecesaria.
- **Guardar tokens de larga duración** en Secrets a mano: Kubernetes ya da tokens de corta duración y rotados.

## En la entrevista

**«Tu aplicación recibe `Forbidden` al listar ConfigMaps. ¿Cómo lo resuelves?»**
Miro qué ServiceAccount usa el Pod (`spec.serviceAccountName`, o `default`). Compruebo con `kubectl auth can-i list configmaps -n NS --as=system:serviceaccount:NS:SA`. Si falta, creo un Role con `get` y `list` sobre `configmaps` y un RoleBinding para esa ServiceAccount, sin dar nada más.

**«¿Qué es una ServiceAccount y en qué se diferencia de un usuario?»**
Es una identidad para procesos (aplicaciones, pipelines, controladores), gestionada por Kubernetes y con namespace. Los usuarios son personas y Kubernetes no los almacena: los autentica un proveedor externo o un certificado.

## Resumen

- **ServiceAccount**: identidad de una aplicación, con namespace; cada namespace tiene `default`.
- El Pod la elige con **`serviceAccountName`**; tokens de **corta duración** montados automáticamente.
- **`automountServiceAccountToken: false`** si no habla con la API.
- **`kubectl auth can-i VERBO RECURSO`**, con **`--as=system:serviceaccount:NS:NOMBRE`** y **`--list`**.
- **Mínimo privilegio**: una ServiceAccount por aplicación y solo lo necesario.
