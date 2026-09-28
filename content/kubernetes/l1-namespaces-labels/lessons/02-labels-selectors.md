---
title: Labels, selectors y annotations
minutes: 10
---

## Qué problema resuelve

Kubernetes necesita una forma de **agrupar** objetos sin depender de su nombre. Por ejemplo:

- «Todos los Pods de la web», para que un Service les envíe tráfico.
- «Todos los Pods que gestiona este Deployment», para saber cuántas réplicas hay.
- «Todo lo del equipo de pagos en producción», para listarlo o borrarlo.

Los nombres no sirven para esto: los Pods de un Deployment tienen nombres aleatorios que cambian. La solución son las **labels** (etiquetas) y los **selectors** (selectores).

## Analogía

Las labels son como las **etiquetas de colores en el correo**: un mismo email puede llevar «trabajo», «urgente» y «proyecto-x». Luego filtras: «enséñame lo urgente del proyecto-x». No importa cómo se llame cada email.

## Concepto

### Labels

Una **label** es un par **clave/valor** que se pone en `metadata.labels` de cualquier objeto:

```yaml
metadata:
  labels:
    app: web
    tier: frontend
    env: production
```

Reglas de formato:

- La **clave** puede llevar un **prefijo** opcional con forma de dominio y una barra: `app.kubernetes.io/name`. Los prefijos `kubernetes.io/` y `k8s.io/` están reservados para Kubernetes.
- El nombre de la clave y el valor: **máximo 63 caracteres**, letras, números, `-`, `_` y `.`, empezando y terminando por letra o número. El valor puede estar vacío.
- Las labels **no son únicas**: muchos objetos pueden compartir la misma.

### Selectors

Un **selector** elige objetos por sus labels. Hay dos estilos:

| Tipo | Operadores | Ejemplo |
|---|---|---|
| Igualdad | `=`, `==`, `!=` | `env=production`, `tier!=frontend` |
| Conjuntos | `in`, `notin`, existe (`clave`), no existe (`!clave`) | `env in (production,qa)` |

- Varias condiciones separadas por **comas** se combinan con **Y** (todas deben cumplirse).
- **No hay operador O** entre condiciones (sí dentro de un `in`).

Los selectors se usan en `kubectl` (`-l`) y dentro de los propios objetos: un **Service** envía tráfico a los Pods que cumplen su selector, y un **Deployment** gestiona los Pods que cumplen el suyo. Es el «pegamento» de Kubernetes.

### Annotations

Las **annotations** también son pares clave/valor en `metadata`, pero **no sirven para seleccionar**. Guardan información para personas o herramientas: el autor, el enlace al repositorio, una configuración para un Ingress controller… Pueden ser mucho más largas que una label.

| | Labels | Annotations |
|---|---|---|
| Para seleccionar objetos | Sí | No |
| Tamaño del valor | Hasta 63 caracteres | Grande (texto libre) |
| Uso típico | `app`, `env`, `tier`, `version` | Descripciones, URLs, configuración de herramientas |

## Ejemplo

```bash
kubectl get pods --show-labels                 # Muestra las labels de cada Pod
kubectl get pods -l app=web                    # Solo los Pods con app=web
kubectl get pods -l 'env in (production,qa)'   # Con env=production o env=qa
kubectl get pods -l app=web,env!=dev           # app=web Y env distinto de dev

kubectl label pods web env=dev                 # Añade la label env=dev al Pod web
kubectl label pods web env=prod --overwrite    # Cambia su valor (sin --overwrite falla)
kubectl label pods web env-                    # Quita la label env (guion al final)
```

Un Pod con labels y una annotation:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web
  labels:                      # para seleccionar
    app: web
    env: dev
  annotations:                 # información, no se puede seleccionar por ella
    equipo.example.com/contacto: "tienda@example.com"
spec:
  containers:
    - name: nginx
      image: nginx:1.27
```

## Errores comunes

- **Selector que no coincide con las labels** por un error tonto (`app: Web` frente a `app: web`). Las labels distinguen mayúsculas; un Service con un selector así no envía tráfico a nadie.
- **Usar annotations para agrupar.** No se puede filtrar por ellas; usa labels.
- **Intentar cambiar una label existente sin `--overwrite`.** kubectl se niega para evitar sobrescribir por accidente.
- **Olvidar las comillas** en selectors con espacios o paréntesis: `-l 'env in (a,b)'`. Sin ellas, la shell rompe el comando.

## En la entrevista

**«¿Diferencia entre labels y annotations?»**
Las labels identifican y agrupan objetos y se pueden usar en selectors (Services, Deployments, `kubectl -l`). Las annotations guardan metadatos no identificativos para personas o herramientas y no sirven para seleccionar.

**«¿Cómo sabe un Service a qué Pods enviar tráfico?»**
Por su selector: envía tráfico a los Pods (listos) cuyas labels cumplen el selector del Service, sin importar cómo se llamen ni cuántos haya.

## Resumen

- Las **labels** son pares clave/valor en `metadata.labels` para **clasificar** objetos.
- Los **selectors** eligen objetos por sus labels: igualdad (`=`, `!=`) o conjuntos (`in`, `notin`, existe).
- Varias condiciones con comas = **Y**.
- Services y Deployments **encuentran sus Pods por labels**, no por nombre.
- Las **annotations** guardan información, pero **no** sirven para seleccionar.
