---
title: Principals, roles y políticas
minutes: 11
---

## Qué problema resuelve

En un proyecto trabajan desarrolladores, analistas, auditores y aplicaciones. No todos deben poder hacerlo todo: el analista necesita **leer** datos, pero no **borrar** la base de datos; la aplicación necesita **escribir** en un bucket, pero no **crear máquinas**. **IAM** (*Identity and Access Management*) responde a la pregunta: **¿quién puede hacer qué sobre qué recurso?**

## Analogía

IAM funciona como las **tarjetas de acceso de un edificio**:

- La **persona** que lleva la tarjeta es el *principal*.
- El **perfil** de la tarjeta («limpieza», «mantenimiento», «dirección») es el *rol*: un conjunto de puertas que abre.
- La **lista de la recepción** que dice qué perfil tiene cada persona en cada planta es la *política*.

## Concepto

### Principal: ¿quién?

| Tipo | Formato en una política |
|---|---|
| Cuenta de Google (una persona) | `user:ana@ejemplo.com` |
| Grupo de Google | `group:devs@ejemplo.com` |
| Cuenta de servicio (una aplicación) | `serviceAccount:api@tienda-pro.iam.gserviceaccount.com` |
| Todo un dominio de Workspace/Cloud Identity | `domain:ejemplo.com` |
| Cualquiera en internet | `allUsers` |
| Cualquiera con cuenta de Google | `allAuthenticatedUsers` |

`allUsers` y `allAuthenticatedUsers` hacen **público** un recurso: úsalos solo cuando sea intencionado (por ejemplo, un bucket con una web estática).

### Rol: ¿qué puede hacer?

Un **permiso** tiene la forma **`servicio.recurso.verbo`**, por ejemplo `storage.objects.get`. Los permisos **no se conceden sueltos**: se agrupan en **roles**.

| Tipo de rol | Ejemplo | Cuándo |
|---|---|---|
| **Básicos** | `roles/owner`, `roles/editor`, `roles/viewer` | Muy amplios (miles de permisos). **Evitar en producción.** |
| **Predefinidos** | `roles/storage.objectViewer`, `roles/compute.instanceAdmin.v1` | Mantenidos por Google para tareas concretas. **La opción habitual.** |
| **Personalizados** | `projects/tienda-pro/roles/lectorInformes` | Cuando ningún predefinido encaja; los mantienes tú. |

### Política: ¿dónde?

Una **allow policy** se adjunta a un recurso (organización, carpeta, proyecto o un recurso concreto como un bucket) y contiene **bindings**: «este rol para estos principals».

```yaml
bindings:
  - role: roles/storage.objectViewer
    members:
      - group:analistas@ejemplo.com
      - serviceAccount:informes@tienda-pro.iam.gserviceaccount.com
```

Recuerda la **herencia**: lo concedido en un nivel vale para todo lo que hay debajo.

### Mínimo privilegio

El principio de **mínimo privilegio**: da a cada principal **solo los permisos que necesita**, **en el nivel más bajo** posible y, si puede ser, **por tiempo limitado**.

- Roles **predefinidos específicos**, no básicos.
- Conceder a **grupos**, no a personas sueltas: cuando alguien cambia de equipo, basta con moverlo de grupo.
- Conceder en el **proyecto o recurso**, no en la organización, salvo que de verdad haga falta en todo.

## Ejemplo

Dar a los analistas permiso para leer objetos de los buckets del proyecto de datos:

```bash
gcloud projects add-iam-policy-binding analitica-pro-4h1c \
  --member="group:analistas@ejemplo.com" \
  --role="roles/storage.objectViewer"

# Ver quién tiene qué en el proyecto
gcloud projects get-iam-policy analitica-pro-4h1c
```

(Si solo deben leer **un** bucket, mejor conceder el rol **en ese bucket**, no en todo el proyecto.)

## Errores comunes

- **Dar `roles/editor` u `owner`** «para que funcione». Es la causa típica de incidentes y fugas.
- **Conceder permisos a personas** en lugar de a grupos: con el tiempo nadie sabe por qué alguien tiene acceso.
- **Conceder en la organización o en una carpeta** lo que solo hacía falta en un proyecto: se hereda en todos.
- **Hacer público un bucket** con `allUsers` sin querer.
- **Pensar que se puede «quitar» en un proyecto un permiso heredado** de una carpeta. La herencia es aditiva; hay que quitarlo arriba (o usar una deny policy).

## En la entrevista

**«Explica cómo funciona IAM en Google Cloud.»**
Una política (allow policy) adjunta a un recurso asocia principals (usuarios, grupos, cuentas de servicio…) con roles, que son conjuntos de permisos del tipo `servicio.recurso.verbo`. Las políticas se heredan hacia abajo en la jerarquía y el acceso efectivo es la unión de lo concedido en cada nivel.

**«¿Qué es el principio de mínimo privilegio y cómo lo aplicas?»**
Dar solo los permisos necesarios, en el nivel más bajo posible: roles predefinidos específicos en lugar de básicos, concedidos a grupos y sobre el recurso o proyecto concreto, revisándolos periódicamente.

## Resumen

- IAM = **quién** (principal) puede hacer **qué** (rol) sobre **qué recurso** (dónde se adjunta la política).
- Permisos `servicio.recurso.verbo`, agrupados en **roles básicos, predefinidos o personalizados**.
- **Evita los roles básicos** en producción; usa **predefinidos**.
- **Mínimo privilegio**: a **grupos**, en el **nivel más bajo** posible.
- `allUsers` / `allAuthenticatedUsers` = **público**.
