---
title: Los módulos de todos los días
minutes: 11
---

## Qué problema resuelve

Configurar un servidor casi siempre consiste en lo mismo: **instalar paquetes**, **crear usuarios y carpetas**, **copiar o generar archivos de configuración** y **arrancar servicios**. Ansible tiene un módulo específico para cada una de esas tareas, y usarlos (en lugar de comandos sueltos) es lo que hace que tus playbooks sean **idempotentes**, legibles y seguros.

## Analogía

Los módulos son las **herramientas especializadas de una caja**: podrías apretar un tornillo con un cuchillo (`shell`), pero el destornillador (`service`, `apt`…) lo hace mejor, sin romper nada y te dice si ya estaba apretado.

## Concepto

Los módulos de `ansible.builtin` más usados, con sus parámetros clave:

### Paquetes

```yaml
- name: Instalar nginx
  ansible.builtin.apt:          # Debian/Ubuntu (dnf en RHEL/Fedora; package elige solo)
    name: nginx                 # también admite una lista
    state: present              # present | absent | latest
    update_cache: true          # apt-get update antes (en apt)
```

`state: latest` **actualiza** cada vez que hay versión nueva: cómodo, pero puede cambiar versiones sin que lo decidas. En producción suele preferirse `present` (o fijar la versión).

### Archivos y carpetas

| Módulo | Para qué | Parámetros clave |
|---|---|---|
| `copy` | Copiar un archivo del nodo de control (o un texto con `content`) | `src` o `content`, `dest`, `owner`, `group`, `mode` |
| `template` | Generar un archivo a partir de una plantilla Jinja2 | `src`, `dest`, `mode` (siguiente módulo) |
| `file` | Carpetas, enlaces, permisos, borrar | `path`, `state` (`directory`, `absent`, `link`, `touch`…), `mode` |
| `lineinfile` | Asegurar **una línea** en un archivo | `path`, `regexp`, `line` |

Pon los permisos **entre comillas**: `mode: "0644"`. Sin comillas, YAML puede interpretar el número de otra forma.

Para gestionar **archivos completos**, mejor `template` o `copy` que muchos `lineinfile`.

### Servicios

```yaml
- name: Nginx arrancado y habilitado al iniciar
  ansible.builtin.service:
    name: nginx
    state: started              # started | stopped | restarted | reloaded
    enabled: true               # que arranque con el sistema
```

`started` y `stopped` son **estados** (idempotentes). `restarted` y `reloaded` son **acciones**: se ejecutan siempre. Para reiniciar solo cuando cambie la configuración se usan **handlers** (nivel 3).

### Usuarios

```yaml
- name: Usuario de despliegue
  ansible.builtin.user:
    name: deploy
    groups: [www-data]
    append: true                # añade a esos grupos sin quitar los que ya tiene
    shell: /bin/bash
    state: present
```

### Depurar

`ansible.builtin.debug` muestra un mensaje o el valor de una variable: `msg: "Hola {{ inventory_hostname }}"` o `var: resultado`.

### Documentación en la terminal

`ansible-doc ansible.builtin.file` muestra los parámetros y ejemplos de cualquier módulo, sin salir de la terminal.

## Ejemplo

Preparar un servidor web:

```yaml
- name: Servidor web
  hosts: web
  become: true
  tasks:
    - name: Instalar nginx
      ansible.builtin.apt:
        name: nginx
        state: present
        update_cache: true

    - name: Carpeta de la web
      ansible.builtin.file:
        path: /var/www/tienda
        state: directory
        owner: www-data
        mode: "0755"

    - name: Página de inicio
      ansible.builtin.copy:
        content: "<h1>Tienda</h1>\n"
        dest: /var/www/tienda/index.html
        mode: "0644"

    - name: Nginx arrancado y habilitado
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true
```

## Errores comunes

- **`mode: 644` sin comillas ni cero**: el permiso resultante no es el que esperas. Usa `"0644"`.
- **Olvidar `append: true`** en `user` con `groups`: el usuario **sale** de sus otros grupos secundarios.
- **`state: restarted` en cada ejecución**: reinicia el servicio siempre, aunque no haya cambios (y marca `changed`).
- **`state: latest` en producción** sin control: actualizaciones no planificadas.
- **Usar `apt` en un servidor Red Hat** (o `dnf` en Ubuntu): usa el módulo de su familia, o `package` si te basta lo genérico.

## En la entrevista

**«¿Qué módulos usarías para instalar y configurar nginx?»**
`apt`/`dnf` (o `package`) para instalarlo, `template` para su configuración, `file` para carpetas y permisos, `service` para dejarlo arrancado y habilitado, y un handler para recargarlo solo cuando cambie la configuración.

**«¿Diferencia entre `state: present` y `state: latest`?»**
`present` asegura que el paquete está instalado y no lo toca si ya lo está; `latest` además lo actualiza a la última versión disponible en cada ejecución, lo que puede introducir cambios no planificados.

## Resumen

- **Paquetes**: `apt` / `dnf` / `package` con `state: present | absent | latest`.
- **Archivos**: `copy`, `template`, `file` (`state: directory`, `absent`…), `lineinfile` para líneas sueltas.
- **Servicios**: `service` con `state: started` y `enabled: true`; `restarted` se ejecuta siempre.
- **Usuarios**: `user`, con `append: true` al añadir grupos.
- Permisos **entre comillas** (`"0644"`) y `ansible-doc` para consultar cualquier módulo.
