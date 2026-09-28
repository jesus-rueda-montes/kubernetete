---
title: Condiciones, bucles, register y bloques
minutes: 12
---

## Qué problema resuelve

Los playbooks reales no son una lista fija de pasos:

- En los servidores **Debian** se instala con `apt`; en los **Red Hat**, con `dnf`.
- Hay que crear **diez usuarios**, no uno.
- Solo hay que ejecutar la migración de la base de datos **si** la versión instalada es antigua.
- Si el despliegue **falla**, hay que volver a la versión anterior.

Para eso Ansible tiene **`when`** (condiciones), **`loop`** (bucles), **`register`** (guardar el resultado de una tarea) y **`block`/`rescue`/`always`** (manejo de errores).

## Analogía

Es una **receta de cocina** con instrucciones reales:

- `when`: «**si** el horno es de gas, precaliéntalo 5 minutos más».
- `loop`: «**repite** con cada huevo: cascar y batir».
- `register`: «**prueba** la salsa y, según cómo esté, añade sal».
- `block`/`rescue`: «si se quema, **haz el plan B**; y **en cualquier caso**, apaga el fuego».

## Concepto

### `when`

```yaml
- name: Instalar nginx en Debian/Ubuntu
  ansible.builtin.apt:
    name: nginx
    state: present
  when: ansible_facts['os_family'] == "Debian"
```

- Es una expresión **Jinja2 sin llaves**: `when: version == "2"`, **no** `when: "{{ version }} == 2"`.
- Una **lista** de condiciones equivale a **todas a la vez** (AND):

```yaml
  when:
    - ansible_facts['os_family'] == "Debian"
    - entorno == "pro"
```

- También: `or`, `not`, `x is defined`, `x in lista`.

### `loop`

```yaml
- name: Crear usuarios
  ansible.builtin.user:
    name: "{{ item }}"
    state: present
  loop:
    - ana
    - luis
    - marta
```

- Cada elemento está en la variable **`item`**. Puede ser un diccionario: `item.name`, `item.groups`.
- **`loop_control`** permite cambiar el nombre de la variable (`loop_var`) o mostrar una etiqueta más corta en la salida (`label`).
- Verás también **`with_items`** en playbooks antiguos: es la sintaxis anterior. Hoy se recomienda `loop`.
- Muchos módulos aceptan **una lista directamente**, que es más rápido que un bucle: `apt: name: [nginx, git, curl]`.

### `register`

Guarda el resultado de una tarea en una variable:

```yaml
- name: Consultar la versión instalada
  ansible.builtin.command: /opt/tienda/bin/tienda --version
  register: version_actual
  changed_when: false

- name: Migrar la base de datos si la versión es la 1.x
  ansible.builtin.command: /opt/tienda/bin/migrar
  when: version_actual.stdout.startswith("1.")
```

El resultado tiene campos como **`stdout`**, **`stderr`**, **`rc`** (código de salida), **`changed`** y **`failed`**. Con un bucle, el registro tiene una lista **`results`** con el resultado de cada elemento.

### Controlar los fallos

- **`failed_when`**: decide cuándo cuenta como fallo (por ejemplo, `failed_when: "'ERROR' in resultado.stdout"`).
- **`ignore_errors: true`**: sigue aunque la tarea falle. Úsalo con cuidado: esconde errores.

### `block`, `rescue` y `always`

```yaml
- name: Desplegar con plan B
  block:
    - name: Instalar la versión nueva
      ansible.builtin.unarchive:
        src: tienda-2.0.tar.gz
        dest: /opt/tienda
  rescue:
    - name: Volver a la versión anterior
      ansible.builtin.command: /opt/tienda/bin/rollback
  always:
    - name: Avisar del resultado
      ansible.builtin.debug:
        msg: "Despliegue terminado en {{ inventory_hostname }}"
```

- **`block`**: agrupa tareas. Lo que pongas en el bloque (`when`, `become`, `tags`) se aplica a todas.
- **`rescue`**: se ejecuta **solo si** falla alguna tarea del bloque.
- **`always`**: se ejecuta **siempre**, falle o no.

Ojo: un host **inalcanzable** o una tarea **mal escrita** no activan `rescue` ni `always`.

## Ejemplo

Crear usuarios con sus grupos, solo en producción:

```yaml
- name: Usuarios del equipo
  hosts: all
  become: true
  vars:
    usuarios:
      - { nombre: ana, grupos: sudo }
      - { nombre: luis, grupos: www-data }
  tasks:
    - name: Crear usuarios
      ansible.builtin.user:
        name: "{{ item.nombre }}"
        groups: "{{ item.grupos }}"
        append: true
      loop: "{{ usuarios }}"
      loop_control:
        label: "{{ item.nombre }}"     # la salida muestra solo el nombre
      when: entorno == "pro"
```

Con `when` y `loop` juntos, la condición se evalúa **para cada elemento**.

## Errores comunes

- **Poner llaves en `when`**: `when: "{{ x }} == 1"` da un aviso o un error, según la versión de Ansible. Escribe `when: x == 1`.
- **Comparar un booleano con un texto**: `when: activo == "true"` falla si `activo` es `true` (booleano). Escribe `when: activo`.
- **Bucle donde el módulo acepta una lista**: instalar paquetes uno a uno es mucho más lento.
- **`ignore_errors: true` por costumbre**: esconde fallos reales. Mejor `failed_when` con la condición exacta.
- **Leer `registro.stdout` tras un bucle**: con `loop`, los resultados están en `registro.results`.

## En la entrevista

**«¿Cómo harías un playbook que funcione en Debian y en Red Hat?»**
Con `when` sobre el fact `ansible_facts['os_family']`, o mejor usando el módulo genérico `ansible.builtin.package` y variables por familia de sistema. Las diferencias (nombres de paquetes, rutas) van en variables, no duplicando tareas.

**«¿Cómo gestionas un fallo en mitad de un despliegue?»**
Con `block`, `rescue` y `always`: las tareas del despliegue en el bloque, la vuelta atrás en `rescue` y la limpieza o el aviso en `always`. Para decidir qué es un fallo, `failed_when`; y evito `ignore_errors` salvo casos justificados.

## Resumen

- **`when`**: Jinja2 **sin llaves**; una lista = AND.
- **`loop`** con **`item`**; `loop_control` (`label`, `loop_var`); `with_items` es la sintaxis antigua.
- **`register`**: `stdout`, `rc`, `changed`, `failed`; con bucle, **`results`**.
- **`failed_when`** define el fallo; **`ignore_errors`**, con cuidado.
- **`block`/`rescue`/`always`**: agrupar, plan B si falla y limpieza siempre.
