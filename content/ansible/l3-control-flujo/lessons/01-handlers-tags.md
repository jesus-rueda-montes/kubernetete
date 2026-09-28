---
title: Handlers y tags
minutes: 10
---

## Qué problema resuelve

Cambias la plantilla de configuración de nginx. Para que se aplique, hay que **recargar nginx**. Pero si pones una tarea `state: reloaded`, se ejecuta **siempre**, aunque la configuración no haya cambiado: el playbook deja de ser idempotente y recarga servicios sin motivo.

Los **handlers** son tareas que **solo se ejecutan cuando otra tarea les avisa** de que ha cambiado algo.

Además, en un playbook largo a veces solo quieres ejecutar **una parte** (solo la configuración, sin reinstalar paquetes). Para eso están los **tags**.

## Analogía

- Un **handler** es como el **aviso al fontanero**: no viene cada día; solo cuando alguien toca las tuberías le llaman, y aunque le llamen tres personas, viene **una sola vez**, al final de la jornada.
- Los **tags** son las **pestañas de colores** de un archivador: sacas solo las carpetas de un color.

## Concepto

### Handlers

```yaml
- name: Servidor web
  hosts: web
  become: true
  tasks:
    - name: Configuración de nginx
      ansible.builtin.template:
        src: nginx.conf.j2
        dest: /etc/nginx/nginx.conf
      notify: Recargar nginx        # avisa al handler SOLO si la tarea da "changed"

  handlers:
    - name: Recargar nginx          # el nombre debe coincidir con el de notify
      ansible.builtin.service:
        name: nginx
        state: reloaded
```

Cómo se comportan:

- Solo se ejecutan si la tarea que notifica termina en **`changed`**. Con `ok`, no.
- Se ejecutan **al final** del bloque de tareas del play, no justo después de la tarea que avisa.
- Aunque varias tareas los notifiquen, se ejecutan **una sola vez**.
- Se ejecutan en el **orden en que están definidos** en `handlers`, no en el orden de los `notify`.
- Varios handlers pueden escuchar el mismo aviso con **`listen`**: `notify: reiniciar web` despierta a todos los que tengan `listen: reiniciar web`.
- Si necesitas que se ejecuten **antes** de seguir (por ejemplo, reiniciar un servicio antes de comprobar que responde), usa la tarea **`ansible.builtin.meta: flush_handlers`**.

Ojo: si una tarea **falla** después de notificar, el play se detiene en ese host y el handler **no llega a ejecutarse**. La configuración queda cambiada sin recargar. Se puede forzar con `--force-handlers`.

### Tags

Los tags se ponen en tareas, bloques o plays:

```yaml
tasks:
  - name: Instalar nginx
    ansible.builtin.apt:
      name: nginx
      state: present
    tags: paquetes

  - name: Configuración de nginx
    ansible.builtin.template:
      src: nginx.conf.j2
      dest: /etc/nginx/nginx.conf
    tags: [config, nginx]
```

Y se eligen al ejecutar:

| Opción | Qué hace |
|---|---|
| `--tags config` (o `-t config`) | Solo las tareas con ese tag. |
| `--skip-tags paquetes` | Todas menos esas. |
| `--list-tags` | Muestra los tags que hay, sin ejecutar nada. |
| `--list-tasks` | Muestra las tareas que se ejecutarían. |

Tags especiales:

- **`always`**: la tarea se ejecuta siempre, salvo que la saltes explícitamente con `--skip-tags always`.
- **`never`**: la tarea **no** se ejecuta salvo que pidas uno de sus tags (útil para tareas peligrosas o de depuración).

## Ejemplo

```bash
# Ver qué tags tiene el playbook
ansible-playbook -i inventario.ini web.yml --list-tags

# Solo aplicar la configuración (y sus handlers, si algo cambia)
ansible-playbook -i inventario.ini web.yml --tags config
```

Salida típica cuando la plantilla cambia:

```text
TASK [Configuración de nginx] ******************************
changed: [web1]

RUNNING HANDLER [Recargar nginx] ***************************
changed: [web1]
```

Si vuelves a ejecutarlo sin cambios, la tarea da `ok` y el handler **no** aparece.

## Errores comunes

- **El nombre de `notify` no coincide** con el del handler (mayúsculas, espacios): Ansible da error porque no encuentra el handler.
- **Esperar que el handler se ejecute justo después** de la tarea: se ejecuta al final. Usa `meta: flush_handlers` si lo necesitas antes.
- **Usar `state: restarted` en una tarea normal** en vez de un handler: reinicia en cada ejecución.
- **Olvidar que un fallo posterior** impide que el handler se ejecute.
- **Filtrar por tags y saltarse una tarea necesaria** de la que dependen las demás: marca esas tareas con `always`.

## En la entrevista

**«¿Qué es un handler y cuándo se ejecuta?»**
Una tarea que solo se ejecuta cuando otra la notifica y esa otra termina en `changed`. Se ejecuta una sola vez al final del bloque de tareas, aunque la notifiquen varias, y en el orden en que está definida. Se usa para reiniciar o recargar servicios solo cuando cambia su configuración.

**«¿Para qué sirven los tags?»**
Para ejecutar o saltar partes de un playbook: `--tags config` solo aplica las tareas de configuración. Los tags especiales `always` y `never` fuerzan o impiden la ejecución por defecto.

## Resumen

- **Handler**: se ejecuta solo si una tarea con **`notify`** da **`changed`**; **una vez**, **al final**, en el orden en que está definido.
- **`listen`** agrupa handlers; **`meta: flush_handlers`** los ejecuta antes.
- Un fallo posterior impide los handlers (salvo con `--force-handlers`).
- **Tags**: `--tags`, `--skip-tags`, `--list-tags`; especiales **`always`** y **`never`**.
