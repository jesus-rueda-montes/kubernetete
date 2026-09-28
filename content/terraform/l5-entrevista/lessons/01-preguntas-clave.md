---
title: Las preguntas que siempre salen
minutes: 14
---

## Qué problema resuelve

Las entrevistas de Terraform repiten un núcleo de preguntas: el state, el ciclo plan/apply, `count` frente a `for_each`, los módulos, los entornos… Si llevas preparada una respuesta clara y breve para cada una, demuestras dominio y te queda margen para los escenarios prácticos.

Esta lección reúne esas preguntas con una **respuesta modelo** de 30-60 segundos, conectando todo el itinerario.

## Analogía

Es un **ensayo general** antes del estreno: ya conoces el guion (lo has estudiado módulo a módulo); ahora practicas **decirlo** con fluidez, en orden y sin leer.

## Concepto

Estructura de cada respuesta: **definición → para qué → cómo funciona → matiz práctico**.

### Fundamentos

**«¿Qué es Terraform y en qué se diferencia de Ansible?»**
Una herramienta de **infraestructura como código declarativa**: describes el estado final y Terraform calcula qué crear, cambiar o destruir, guardando lo que gestiona en el **state**. Ansible es sobre todo de **gestión de configuración**, procedimental por tareas y sin state. Se complementan: Terraform crea la infraestructura, Ansible configura lo que corre dentro.

**«¿Qué es el state y por qué es tan importante?»**
El archivo que **relaciona cada recurso del código con el objeto real** (su ID) y guarda sus atributos. Sin él, Terraform no sabe qué gestiona. En equipo va en un **backend remoto** (por ejemplo, un bucket de GCS) con **bloqueo** para que dos `apply` no choquen, y con **versionado** para recuperarlo. Contiene **valores sensibles en claro**, así que se protege el acceso.

**«¿Qué hacen `init`, `plan` y `apply`?»**
`init` descarga providers y módulos y configura el backend. `plan` compara código, state y realidad y muestra los cambios. `apply` los ejecuta. En CI se guarda el plan (`-out`) y se aplica **exactamente ese** plan tras revisarlo.

### Lenguaje

**«¿`count` o `for_each`?»**
`count` crea N copias **numeradas**; si quitas una del medio, se **renumeran** y Terraform destruye y recrea las siguientes. `for_each` usa **claves estables** (un mapa o un set), así que quitar una solo afecta a esa. Regla: `count` para «0 o 1» (activar o desactivar) y `for_each` para colecciones.

**«¿Qué es un módulo y cómo lo versionas?»**
Un directorio con recursos reutilizables, con variables de entrada y outputs. Los módulos remotos se fijan por **versión** (`version = "~> 18.0"` en el registro, o `?ref=v1.2.0` en git) para que un cambio en el módulo no llegue sin querer.

**«¿Cómo fijas las versiones de los providers?»**
Con `required_providers` y una restricción (`~> 8.0`), y el archivo **`.terraform.lock.hcl`**, que se **sube a git**, fija la versión exacta y los hashes.

### Ciclo de vida

**«¿Cómo evitas borrar una base de datos por error?»**
`lifecycle { prevent_destroy = true }`, además de la protección propia del recurso (por ejemplo, `deletion_protection` en Cloud SQL), revisión del plan en CI y permisos limitados.

**«¿Qué es el drift y cómo lo detectas?»**
Cambios hechos **fuera de Terraform** (a mano en la consola). Se detecta con `terraform plan` (o `plan -refresh-only`, que solo muestra lo que cambió fuera), idealmente en un job programado. Se corrige volviendo al código o incorporando el cambio al código.

**«¿Cómo traes a Terraform un recurso que ya existe?»**
Con un bloque **`import`** (`to` + `id`); `plan -generate-config-out` puede generar un borrador del código. Tras el apply, el recurso queda gestionado.

### Contexto del sector

**«¿Terraform u OpenTofu?»**
Desde la versión 1.6, Terraform usa la licencia **BUSL 1.1** (antes era **MPL 2.0**). **OpenTofu** es un fork abierto con licencia MPL 2.0 bajo la Linux Foundation, compatible en su mayor parte. Para el día a día el lenguaje es casi el mismo; la elección suele depender de la política de licencias de la empresa.

## Ejemplo

Respuesta en cuatro pasos a «¿Qué harías si alguien borra el state?»:

```text
1. Definición:  sin state, Terraform cree que no gestiona nada y querría
                crear todo de nuevo (fallaría o duplicaría recursos).
2. Prevención:  backend remoto con versionado de objetos (GCS) y acceso limitado.
3. Solución:    restaurar la versión anterior del objeto del state; si no hay,
                reimportar los recursos con bloques import.
4. Matiz:       nunca hacer apply antes de recuperar el state; revisar el plan:
                debería salir "No changes".
```

## Errores comunes

- **Decir que el state es solo una caché**: es la única fuente de la relación código-recurso.
- **Recomendar `count` para colecciones con nombre**: los renumerados provocan recreaciones.
- **Olvidar el bloqueo del state** al hablar de trabajo en equipo.
- **Proponer editar el state a mano** (el JSON) como solución habitual: existen `moved`, `removed`, `import` y `terraform state`.
- **No saber qué hace `.terraform.lock.hcl`** o decir que se ignora en git.

## En la entrevista

**«¿Cómo organizas Terraform para dev, staging y prod?»**
Un directorio (y un state) por entorno que llama a los mismos módulos versionados con valores distintos. Workspaces solo si los entornos son casi idénticos, porque comparten backend y es fácil equivocarse de workspace. Cada entorno con su proyecto, su cuenta de servicio y su pipeline con aprobación para prod.

**«¿Qué es lo primero que revisas en un plan antes de aprobarlo?»**
Las líneas de **destroy** y de **replace** (`-/+`): qué se va a destruir y por qué. Un cambio en un atributo que fuerza sustitución puede recrear una base de datos.

## Resumen

- **State**: relación código-realidad; backend remoto con **bloqueo**, **versionado** y acceso restringido; contiene secretos.
- **init/plan/apply**; en CI se aplica el **plan guardado**.
- **`for_each`** para colecciones (claves estables); **`count`** para activar o desactivar.
- Versiones fijadas: módulos con `version`/`ref`, providers con restricción y **`.terraform.lock.hcl` en git**.
- Drift con `plan`/`-refresh-only`; `import` para lo existente; Terraform (BUSL) vs **OpenTofu** (MPL).
