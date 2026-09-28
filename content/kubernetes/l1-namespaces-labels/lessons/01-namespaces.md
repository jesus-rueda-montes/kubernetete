---
title: Namespaces
minutes: 8
---

## Qué problema resuelve

En un clúster compartido conviven muchos equipos y aplicaciones. Sin ningún tipo de separación:

- dos equipos no podrían tener cada uno un objeto llamado `web`, porque los nombres chocarían,
- listar recursos mostraría cientos de objetos mezclados,
- sería difícil dar permisos o poner límites de consumo «solo a este equipo».

Los **namespaces** dividen un clúster en espacios con nombre, como carpetas.

## Analogía

Un namespace es como una **carpeta** en tu ordenador: puedes tener un `informe.pdf` en la carpeta `ventas` y otro en `marketing` sin conflicto. Pero ojo: las carpetas **ordenan**, no **aíslan** por sí solas. Si alguien tiene acceso a todo el disco, puede abrir ambas.

## Concepto

- Un **namespace** es un espacio de nombres dentro del clúster. El nombre de un objeto debe ser **único dentro de su namespace** (para un mismo tipo de recurso), pero puede repetirse en namespaces distintos.
- La mayoría de objetos viven dentro de un namespace (**namespaced**): Pods, Deployments, Services, ConfigMaps, Secrets…
- Algunos son de **todo el clúster** (no tienen namespace): los **Nodes**, los **PersistentVolumes**, las **StorageClasses** y los propios **Namespaces**.
- Si no indicas namespace, se usa el del contexto actual de kubectl; normalmente, `default`.

Namespaces que trae todo clúster:

| Namespace | Para qué |
|---|---|
| `default` | Donde van los objetos si no indicas otro. |
| `kube-system` | Objetos creados por el propio Kubernetes (componentes de sistema). |
| `kube-public` | Legible por todos los clientes; reservado para uso del clúster. |
| `kube-node-lease` | Objetos *Lease* con los latidos de cada Node, para detectar Nodes caídos. |

Qué se suele hacer con los namespaces:

- **Separar equipos o aplicaciones** (`pagos`, `tienda`, `monitoring`).
- **Separar entornos** en clústeres pequeños (`dev`, `staging`). En producción seria es habitual usar **clústeres distintos**.
- **Aplicar permisos (RBAC) y cuotas** por namespace. Lo verás en niveles posteriores.

Importante: **un namespace no aísla la red**. Por defecto, un Pod de un namespace puede hablar con los Pods de cualquier otro. Para restringirlo existen las *NetworkPolicies* (nivel avanzado).

## Ejemplo

```bash
kubectl get namespaces                    # Lista los namespaces (alias: ns)
kubectl create namespace tienda           # Crea el namespace "tienda"
kubectl get pods -n tienda                # Pods de "tienda"
kubectl get pods -A                       # Pods de TODOS los namespaces (--all-namespaces)

# Cambiar el namespace por defecto de tu contexto actual
kubectl config set-context --current --namespace=tienda
```

Un manifest indica su namespace en `metadata`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web
  namespace: tienda    # si lo omites, se usa el del contexto (normalmente "default")
spec:
  containers:
    - name: nginx
      image: nginx:1.27
```

Y para saber qué tipos de recurso tienen namespace y cuáles no:

```bash
kubectl api-resources --namespaced=false  # Recursos de todo el clúster
```

## Errores comunes

- **«No encuentro mi Pod».** Casi siempre está en otro namespace. Prueba con `-A`.
- **Creer que un namespace aísla la red o la seguridad.** Solo separa nombres; el aislamiento real necesita RBAC y NetworkPolicies.
- **Borrar un namespace sin pensarlo.** `kubectl delete namespace X` **borra todo lo que contiene**.
- **Olvidar que cambiaste el namespace del contexto** con `set-context`, y crear cosas donde no querías. Revisa con `kubectl config view --minify`.

## En la entrevista

**«¿Para qué sirven los namespaces? ¿Aíslan las aplicaciones?»**
Dividen el clúster en espacios con nombre: evitan choques de nombres y permiten aplicar RBAC y cuotas por equipo o aplicación. Por sí solos no aíslan la red: para eso hacen falta NetworkPolicies.

**«¿Todos los objetos tienen namespace?»**
No. Nodes, PersistentVolumes, StorageClasses o los propios Namespaces son de ámbito de clúster. Se puede comprobar con `kubectl api-resources --namespaced=false`.

## Resumen

- Un **namespace** separa nombres dentro de un clúster: `web` puede existir en `tienda` y en `pagos`.
- Por defecto se trabaja en **`default`**; los componentes de sistema están en **`kube-system`**.
- `-n <namespace>` elige namespace; `-A` mira en todos.
- Algunos recursos (Nodes, PersistentVolumes…) **no tienen namespace**.
- Un namespace **no aísla la red** por sí solo.
