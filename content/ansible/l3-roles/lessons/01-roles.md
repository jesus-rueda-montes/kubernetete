---
title: Roles
minutes: 12
---

## Qué problema resuelve

Tu playbook de servidores web tiene 40 tareas, 3 handlers, 5 plantillas y un montón de variables, todo en un solo archivo. Ahora otro proyecto necesita **lo mismo**. Copiar y pegar crea dos versiones que se van separando con el tiempo.

Un **rol** empaqueta tareas, handlers, plantillas, archivos y variables en una **estructura de carpetas estándar**, reutilizable en cualquier playbook.

## Analogía

Un rol es como un **kit de montaje de un mueble**: dentro vienen las instrucciones (tasks), las piezas (files y templates), los ajustes recomendados (defaults) y qué otros kits necesitas antes (meta). Cualquiera puede montarlo sin saber cómo se diseñó.

## Concepto

### Estructura de un rol

```text
roles/
└── nginx/
    ├── tasks/main.yml       # las tareas (obligatorio en la práctica)
    ├── handlers/main.yml    # los handlers
    ├── templates/           # plantillas .j2 (las busca el módulo template)
    ├── files/               # archivos estáticos (los busca el módulo copy)
    ├── defaults/main.yml    # variables por defecto: precedencia MUY BAJA
    ├── vars/main.yml        # variables internas: precedencia alta
    └── meta/main.yml        # metadatos y dependencias de otros roles
```

- Solo hace falta crear las carpetas que uses.
- Dentro de un rol, `template: src: nginx.conf.j2` busca automáticamente en `templates/`, y `copy: src: logo.png` en `files/`.

### `defaults` frente a `vars`

| | `defaults/main.yml` | `vars/main.yml` |
|---|---|---|
| Precedencia | La **más baja** de todas | Alta: gana a las del inventario |
| Para qué | Lo que **el usuario del rol puede cambiar** (puerto, versión) | Valores **internos** que no deberían cambiarse (rutas según el SO) |

Regla práctica: casi todo va en **`defaults`**, así quien usa el rol puede ajustarlo desde `group_vars` o desde el playbook.

### Usar un rol en un playbook

**1. `roles:`** a nivel de play (la forma clásica):

```yaml
- name: Servidores web
  hosts: web
  become: true
  roles:
    - common
    - role: nginx
      vars:
        nginx_puerto: 8080
```

Los roles de `roles:` se ejecutan **antes** que las `tasks:` del play.

**2. `import_role`** (estático) o **`include_role`** (dinámico), como una tarea más:

```yaml
  tasks:
    - name: Preparar el sistema
      ansible.builtin.import_role:
        name: common

    - name: Instalar la base de datos solo en los servidores de datos
      ansible.builtin.include_role:
        name: postgres
      when: "'db' in group_names"   # group_names: los grupos del host actual
```

- **`import_role`** se procesa **al leer el playbook** (como si copiaras sus tareas ahí).
- **`include_role`** se procesa **al llegar a esa tarea**: permite decidir en tiempo de ejecución qué rol usar, con bucles o condiciones.

### Dependencias

En `meta/main.yml`, un rol puede declarar que necesita otros:

```yaml
dependencies:
  - role: common
```

Ansible ejecuta las dependencias **antes** que el rol. Un rol se ejecuta **una sola vez por play** aunque aparezca varias veces con los mismos parámetros.

### Crear el esqueleto

```bash
ansible-galaxy role init --init-path roles nginx
```

Crea `roles/nginx/` con todas las carpetas con su `main.yml` y un `README.md`.

## Ejemplo

`roles/nginx/defaults/main.yml`:

```yaml
nginx_puerto: 80
nginx_workers: auto
```

`roles/nginx/tasks/main.yml`:

```yaml
- name: Instalar nginx
  ansible.builtin.package:
    name: nginx
    state: present

- name: Configuración
  ansible.builtin.template:
    src: nginx.conf.j2              # roles/nginx/templates/nginx.conf.j2
    dest: /etc/nginx/nginx.conf
  notify: Recargar nginx

- name: Nginx arrancado
  ansible.builtin.service:
    name: nginx
    state: started
    enabled: true
```

`roles/nginx/handlers/main.yml`:

```yaml
- name: Recargar nginx
  ansible.builtin.service:
    name: nginx
    state: reloaded
```

`site.yml`:

```yaml
- name: Servidores web
  hosts: web
  become: true
  roles:
    - nginx
```

Y en `group_vars/web.yml`, `nginx_puerto: 8080` cambia el puerto sin tocar el rol.

## Errores comunes

- **Poner en `vars/` lo que el usuario debería poder cambiar**: su precedencia es alta y el inventario no lo sobrescribe. Usa `defaults/`.
- **Variables sin prefijo** (`puerto`, `version`): chocan entre roles. Usa el nombre del rol como prefijo: `nginx_puerto`.
- **Rutas completas a plantillas** dentro del rol: basta con el nombre; el rol las busca en `templates/`.
- **Usar `import_role` con un `when` esperando que se evalúe una sola vez**: con import, la condición se aplica a **cada tarea** del rol.
- **Roles gigantes** que lo hacen todo: mejor roles pequeños con una responsabilidad (`common`, `nginx`, `postgres`).

## En la entrevista

**«¿Qué es un rol y cómo se estructura?»**
Una forma estándar de empaquetar automatización reutilizable: `tasks`, `handlers`, `templates`, `files`, `defaults`, `vars` y `meta` (dependencias). Se usa desde un playbook con `roles:`, `import_role` o `include_role`.

**«¿Diferencia entre `defaults` y `vars` en un rol?»**
`defaults` tiene la precedencia más baja: son los valores que el usuario del rol puede sobrescribir fácilmente. `vars` tiene precedencia alta, para valores internos que no deberían cambiarse desde el inventario.

**«¿`import_role` o `include_role`?»**
`import_role` es estático: se resuelve al leer el playbook. `include_role` es dinámico: se resuelve al ejecutar, así que sirve con bucles o condiciones que dependen de datos de la ejecución.

## Resumen

- **Rol** = carpetas estándar: `tasks`, `handlers`, `templates`, `files`, `defaults`, `vars`, `meta`.
- **`defaults`**: precedencia mínima (ajustables). **`vars`**: precedencia alta (internas).
- Uso: **`roles:`** (antes que `tasks:`), **`import_role`** (estático), **`include_role`** (dinámico).
- Dependencias en **`meta/main.yml`**. Esqueleto con **`ansible-galaxy role init`**.
- Prefija las variables con el nombre del rol.
