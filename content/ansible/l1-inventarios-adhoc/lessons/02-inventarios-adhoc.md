---
title: Inventarios y comandos ad-hoc
minutes: 10
---

## Qué problema resuelve

Antes de automatizar nada, Ansible necesita saber **qué máquinas existen**, **cómo conectarse** a ellas y **cómo están agrupadas** («los servidores web», «los de producción»). Eso es el **inventario**.

Y a veces no quieres escribir un playbook: solo necesitas una acción rápida, como «¿cuánto disco libre tienen todos los servidores?». Para eso están los **comandos ad-hoc**.

## Analogía

El inventario es la **agenda de contactos** de Ansible: nombres, cómo localizarlos y grupos («familia», «trabajo»). Un comando ad-hoc es **un mensaje rápido a un grupo**; un playbook sería un **plan detallado** que se guarda y se repite.

## Concepto

### Inventario en formato INI

```ini
[web]
web1.example.com
web2.example.com

[db]
db1 ansible_host=10.0.0.21 ansible_user=admin

[produccion:children]
web
db
```

- `[web]` y `[db]` son **grupos**.
- `db1` es un **alias**; `ansible_host` indica la IP real y `ansible_user` el usuario SSH.
- `[produccion:children]` crea un **grupo de grupos**.

El mismo inventario en **YAML**:

```yaml
all:
  children:
    web:
      hosts:
        web1.example.com:
        web2.example.com:
    db:
      hosts:
        db1:
          ansible_host: 10.0.0.21
          ansible_user: admin
    produccion:
      children:
        web:
        db:
```

Conceptos clave:

- Siempre existen dos grupos: **`all`** (todos los hosts) y **`ungrouped`** (los que no están en ningún otro grupo).
- **Rangos**: `web[01:20].example.com` equivale a 20 hosts.
- **Variables de conexión** habituales: `ansible_host`, `ansible_port` (22 por defecto), `ansible_user` y `ansible_connection` (`ssh` por defecto).
- El inventario se indica con `-i`. Si no lo indicas, se usa el que marque la configuración (por defecto, `/etc/ansible/hosts`).

### Patrones: a quién afecta un comando

| Patrón | Significa |
|---|---|
| `all` o `*` | Todos los hosts |
| `web` | El grupo web |
| `web:db` | web **o** db (unión) |
| `web:&produccion` | Los que están en web **y** en produccion (intersección) |
| `web:!web2.example.com` | web **excepto** ese host (exclusión) |

En la shell, pon el patrón entre **comillas simples** si lleva `!` o `&`.

### Comandos ad-hoc

```
ansible <patrón> -i <inventario> -m <módulo> -a "<argumentos del módulo>"
```

- Si no indicas `-m`, se usa el módulo **`command`**, que ejecuta un comando **sin shell**: no admite tuberías (`|`) ni redirecciones (`>`). Para eso está el módulo `shell`.
- **`-b`** (`--become`) ejecuta con privilegios (sudo).
- **`-C`** (`--check`) simula sin cambiar nada.
- Por defecto actúa sobre **5 hosts en paralelo**; se cambia con `-f`.

Son útiles para tareas **puntuales**. Si lo vas a repetir, escríbelo en un playbook.

## Ejemplo

```bash
# ¿Llego a todos?
ansible all -i inventario.ini -m ping

# Espacio en disco de los servidores web (módulo command por defecto)
ansible web -i inventario.ini -a "df -h /"

# Instalar nginx en los web, con sudo (idempotente: si ya está, "ok")
ansible web -i inventario.ini -m ansible.builtin.apt -a "name=nginx state=present" -b

# Qué hosts incluye un patrón, sin ejecutar nada
ansible 'web:&produccion' -i inventario.ini --list-hosts
```

`ansible.builtin.apt` es el **nombre completo** (FQCN) del módulo `apt`: *colección* `ansible.builtin` + módulo `apt`. Se recomienda usarlo en playbooks para evitar ambigüedades.

## Errores comunes

- **Olvidar `-i`** y que Ansible use otro inventario (o ninguno): «provided hosts list is empty».
- **Usar tuberías con el módulo por defecto.** `-a "ps aux | grep nginx"` no funciona con `command`; usa `-m shell`.
- **Olvidar `-b`** en tareas que necesitan root (instalar paquetes): error de permisos.
- **No entrecomillar patrones** con `!`: la shell lo interpreta antes que Ansible.
- **Guardar contraseñas en el inventario** en texto plano. Se usan claves SSH y, para secretos, Ansible Vault (nivel avanzado).

## En la entrevista

**«¿Qué es un inventario y qué grupos existen siempre?»**
La lista de hosts gestionados, con sus grupos y variables de conexión, en INI o YAML (o generada dinámicamente desde la nube). Siempre existen `all` y `ungrouped`.

**«¿Diferencia entre los módulos `command` y `shell`?»**
`command` ejecuta el programa directamente, sin pasar por una shell: es más seguro, pero no admite tuberías, redirecciones ni variables de entorno de la shell. `shell` ejecuta a través de `/bin/sh` y sí las admite.

## Resumen

- El **inventario** lista hosts y grupos (INI o YAML); `all` y `ungrouped` existen siempre.
- Variables de conexión: **`ansible_host`**, **`ansible_user`**, `ansible_port`…
- Patrones: `web:db` (unión), `web:&prod` (intersección), `web:!web2` (exclusión).
- Ad-hoc: `ansible <patrón> -m <módulo> -a "<args>"`; el módulo por defecto es **`command`**.
- **`-b`** para sudo, **`-C`** para simular, **`--list-hosts`** para ver a quién afecta.
