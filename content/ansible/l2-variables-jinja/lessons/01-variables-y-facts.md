---
title: Variables y facts
minutes: 11
---

## Qué problema resuelve

Un mismo playbook tiene que configurar servidores **distintos**: el puerto de la web en producción no es el de desarrollo, cada base de datos tiene su tamaño de memoria, un servidor usa Ubuntu y otro Rocky Linux. Las **variables** separan **qué hacer** (el playbook) de **con qué valores** (por entorno, por grupo, por host), y los **facts** te cuentan cómo es cada máquina.

## Analogía

El playbook es una **receta** y las variables, los **ajustes por comensal**: «sin sal para la mesa 3», «ración doble para la mesa 5». Los facts son lo que el camarero **observa** de cada mesa antes de servir: cuántos son, si hay niños…

## Concepto

### Usar una variable

Se usan con **Jinja2**: `{{ nombre_variable }}`.

```yaml
- name: Puerto de la web
  ansible.builtin.debug:
    msg: "La web escucha en el puerto {{ puerto_web }}"
```

Si el valor **empieza** por `{{`, hay que poner **todo entre comillas** para que sea YAML válido: `ruta: "{{ base }}/logs"`.

Nombres válidos: letras, números y guiones bajos, sin empezar por número. **Sin guiones** (`puerto-web` no vale).

### Dónde se definen

| Lugar | Para qué |
|---|---|
| `group_vars/<grupo>.yml` (o `group_vars/all.yml`) | Valores de todo un grupo del inventario. |
| `host_vars/<host>.yml` | Valores de un host concreto. |
| `vars:` en el play | Valores del playbook. |
| `defaults/main.yml` de un rol | Valores por defecto, pensados para sobrescribirse (nivel 3). |
| `-e` (`--extra-vars`) | Desde la línea de comandos. |

Las carpetas `group_vars/` y `host_vars/` se colocan **junto al inventario** (o junto al playbook).

### Precedencia: ¿quién gana?

Ansible tiene **22 niveles** de precedencia, pero la idea práctica es: **lo más específico gana a lo más general**, y **`-e` gana siempre**. De menos a más, lo esencial:

1. `defaults` de los roles (lo más débil: «valor por defecto»).
2. `group_vars/all` → `group_vars/<grupo>` → `host_vars/<host>` (de general a concreto).
3. Facts del host.
4. `vars` del play → `vars` de roles, bloques y tareas.
5. Variables registradas (`register`) y `set_fact`.
6. **`-e` / `--extra-vars`**: gana a todo.

(Los valores de conexión de la línea de comandos, como `-u usuario`, están en el nivel **más bajo**; no confundir con `-e`.)

### Facts

Al empezar cada play, Ansible recoge **facts** de cada host (la tarea «Gathering Facts», módulo `setup`). Están en **`ansible_facts`**:

| Fact | Ejemplo |
|---|---|
| `ansible_facts['distribution']` | `Ubuntu` |
| `ansible_facts['os_family']` | `Debian`, `RedHat`… |
| `ansible_facts['hostname']` | `web1` |
| `ansible_facts['default_ipv4']['address']` | `10.0.0.11` |
| `ansible_facts['memtotal_mb']` | `3936` |

Para verlos todos: `ansible web1 -m ansible.builtin.setup`. Si no los necesitas, `gather_facts: false` acelera el playbook.

### Variables mágicas

Las define Ansible siempre: **`inventory_hostname`** (nombre del host en el inventario), **`groups`** (todos los grupos y sus hosts), **`group_names`** (grupos del host actual) y **`hostvars`** (variables de cualquier otro host).

## Ejemplo

```
inventario/
├── hosts.ini
├── group_vars/
│   ├── all.yml          # puerto_web: 80
│   └── produccion.yml   # puerto_web: 443
└── host_vars/
    └── web2.yml         # puerto_web: 8443
```

Con `web1` en `produccion` y `web2` también:

- `web1` → **443** (group_vars/produccion gana a all).
- `web2` → **8443** (host_vars gana a group_vars).
- `ansible-playbook site.yml -e puerto_web=9000` → **9000** en todos (extra vars gana siempre).

```yaml
- name: Instalar el paquete según la familia del sistema
  ansible.builtin.package:
    name: "{{ 'apache2' if ansible_facts['os_family'] == 'Debian' else 'httpd' }}"
    state: present
```

## Errores comunes

- **Olvidar las comillas** cuando el valor empieza por `{{`: error de sintaxis YAML.
- **Guiones en los nombres** (`puerto-web`): no es un nombre válido de variable.
- **Definir la misma variable en muchos sitios** y no saber cuál gana. Decide un lugar por tipo de dato (grupo, host, rol).
- **Contraseñas en `group_vars` en texto plano**: se cifran con Ansible Vault (nivel 4).
- **Usar facts con `gather_facts: false`**: la variable no existe.

## En la entrevista

**«¿Dónde definirías una variable que cambia por entorno?»**
En `group_vars/<entorno>.yml`, con cada host en el grupo de su entorno. Los valores específicos de una máquina en `host_vars/`, los valores por defecto de un rol en su `defaults/`, y `-e` solo para casos puntuales, porque gana a todo.

**«¿Qué son los facts?»**
Información que Ansible recoge de cada host al empezar el play (sistema operativo, IPs, memoria, discos…), accesible en `ansible_facts`. Permite adaptar las tareas a cada máquina.

## Resumen

- Variables con **Jinja2**: `{{ var }}`; si el valor empieza por `{{`, **entre comillas**.
- Se definen en **`group_vars/`**, **`host_vars/`**, `vars:`, `defaults/` de roles o **`-e`**.
- Precedencia: **lo específico gana a lo general**; **`-e` gana siempre**.
- **Facts** en `ansible_facts` (`os_family`, `default_ipv4`…); se ven con el módulo `setup`.
- Variables mágicas: **`inventory_hostname`**, `groups`, `group_names`, `hostvars`.
