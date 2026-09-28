---
title: become, ansible-lint y estructura de un proyecto
minutes: 12
---

## Qué problema resuelve

Un proyecto de Ansible que crece sin normas acaba así: todos los playbooks con `become: true` en todas partes, un único archivo gigante, variables repetidas en cinco sitios, tareas con `shell` que no son idempotentes… y nadie se atreve a ejecutarlo en producción.

Esta lección reúne las prácticas que separan un playbook de prueba de un proyecto **mantenible**: **privilegios** bien usados, **revisión automática** del código y una **estructura** estándar.

## Analogía

Es la diferencia entre un **taller casero** y un **taller profesional**: en el profesional cada herramienta tiene su sitio, solo los técnicos autorizados usan la maquinaria peligrosa (privilegios) y un inspector revisa el trabajo antes de entregarlo (el linter).

## Concepto

### `become`: privilegios justos

- **`become: true`** ejecuta con otro usuario, por defecto **root** mediante **sudo**.
- **`become_user`**: con qué usuario (por ejemplo, `postgres`). Ojo: poner `become_user` **no activa** `become`; hace falta también `become: true`.
- **`become_method`**: `sudo` por defecto; también `su` y otros.
- Si sudo pide contraseña: `--ask-become-pass` (`-K`).

Buena práctica: activar `become` **solo en las tareas o plays que lo necesitan**, no en todo por costumbre.

```yaml
- name: Crear la base de datos como el usuario postgres
  community.postgresql.postgresql_db:
    name: pedidos
  become: true
  become_user: postgres
```

### ansible-lint

**ansible-lint** revisa playbooks y roles y avisa de errores y malas prácticas:

- Módulos sin **FQCN** (`copy` en vez de `ansible.builtin.copy`).
- Tareas **sin `name`**.
- `command`/`shell` donde existe un módulo, o sin `changed_when`.
- **Permisos** de archivo sin indicar (`mode`).
- Uso de `latest` al instalar paquetes, que rompe la reproducibilidad.

```bash
ansible-lint                          # revisa el proyecto
ansible-lint --profile production     # el perfil más exigente
```

Para silenciar un falso positivo en una línea concreta: `# noqa: nombre-de-la-regla`. Se ejecuta en el **pipeline**, igual que `ansible-playbook --syntax-check`.

### Estructura de un proyecto real

```text
proyecto/
├── ansible.cfg                # configuración del proyecto
├── requirements.yml           # collections y roles externos, con versiones
├── inventories/
│   ├── dev/
│   │   ├── hosts.yml
│   │   └── group_vars/
│   └── pro/
│       ├── hosts.yml
│       └── group_vars/
│           └── all/
│               ├── vars.yml
│               └── vault.yml  # cifrado
├── roles/                     # roles propios, pequeños y con una responsabilidad
├── playbooks/
│   ├── site.yml               # todo
│   ├── web.yml
│   └── db.yml
└── .ansible-lint              # configuración del linter
```

- **Un inventario por entorno**: `-i inventories/pro` deja claro dónde actúas.
- **`ansible.cfg` en el proyecto**: Ansible lo usa si ejecutas desde ese directorio (salvo que `ANSIBLE_CONFIG` indique otro).
- **Playbooks finos** que solo aplican roles; la lógica vive en los roles.

### Cómo probar antes de producción

1. `ansible-playbook --syntax-check` y `ansible-lint`.
2. `--check --diff` contra el entorno para ver qué cambiaría.
3. Aplicar en dev o staging.
4. **Segunda ejecución** con `changed=0` para comprobar la idempotencia.
5. Para roles, **Molecule** crea máquinas o contenedores de prueba, aplica el rol y verifica el resultado.

## Ejemplo

`ansible.cfg`:

```ini
[defaults]
inventory = inventories/dev
roles_path = roles
forks = 20
```

Pipeline típico:

```bash
ansible-galaxy install -r requirements.yml
ansible-lint
ansible-playbook -i inventories/pro playbooks/site.yml --syntax-check
ansible-playbook -i inventories/pro playbooks/site.yml --check --diff --vault-password-file ./vault-pass.sh
ansible-playbook -i inventories/pro playbooks/site.yml --vault-password-file ./vault-pass.sh
```

## Errores comunes

- **`become: true` en todo el play** cuando solo dos tareas lo necesitan.
- **`become_user` sin `become: true`**: no cambia de usuario.
- **Inventario por defecto apuntando a producción** en `ansible.cfg`: un despiste y aplicas en pro. Mejor que el defecto sea dev.
- **Silenciar ansible-lint entero** en vez de corregir o justificar cada caso con `noqa`.
- **No probar la idempotencia**: el playbook «funciona», pero cambia cosas en cada ejecución.

## En la entrevista

**«¿Cómo estructurarías un proyecto de Ansible para varios entornos?»**
Un inventario por entorno con sus `group_vars` (y un `vault.yml` cifrado por entorno), roles propios pequeños en `roles/`, dependencias externas en `requirements.yml` con versiones, playbooks finos que aplican roles y un `ansible.cfg` en el proyecto. En el pipeline: ansible-lint, syntax-check, `--check --diff` y después la ejecución real.

**«¿Qué hace `become` y cómo lo usarías?»**
Escala privilegios, por defecto a root con sudo, o a otro usuario con `become_user`. Lo activo solo en las tareas o plays que lo necesitan, siguiendo el mínimo privilegio.

## Resumen

- **`become`** (+ `become_user`, `become_method`), solo donde haga falta; `-K` para la contraseña de sudo.
- **ansible-lint** en el pipeline (FQCN, `name`, idempotencia, `mode`…); `# noqa` para excepciones justificadas.
- Estructura: **inventario por entorno**, `group_vars` con **vault**, **roles**, `requirements.yml`, **`ansible.cfg`**.
- Probar: **syntax-check**, **lint**, **`--check --diff`**, segunda ejecución con **`changed=0`**, **Molecule** para roles.
