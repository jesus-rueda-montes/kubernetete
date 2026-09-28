---
title: Anatomía de un playbook
minutes: 12
---

## Qué problema resuelve

Los comandos ad-hoc sirven para una acción suelta, pero configurar un servidor de verdad requiere **muchos pasos en orden**: instalar paquetes, copiar la configuración, arrancar el servicio… Y quieres poder **repetirlo** mañana, en otros servidores, y guardarlo en git para revisarlo.

Un **playbook** es ese procedimiento escrito en YAML: reproducible, revisable y versionado.

## Analogía

Un playbook es como el **guion de una obra de teatro**. Tiene varios **actos** (plays), cada uno con su **reparto** (hosts) y su lista de **escenas** (tasks) que se representan en orden. Todos los actores de un acto hacen la escena 1 antes de pasar juntos a la escena 2.

## Concepto

### Estructura

```
playbook (archivo .yml)
└── play 1: hosts + opciones + tasks
│   ├── task 1: nombre + módulo con sus parámetros
│   └── task 2: ...
└── play 2: ...
```

- Un **playbook** es una **lista** de plays (por eso empieza con `- `).
- Un **play** dice **a qué hosts** (un patrón del inventario) y **qué tareas** aplicar.
- Una **task** llama a **un módulo** con sus parámetros. Siempre debe llevar `name`: aparece en la salida y documenta el paso.

Palabras clave habituales de un play:

| Clave | Para qué |
|---|---|
| `name` | Descripción del play. |
| `hosts` | Patrón de hosts: `web`, `all`, `web:&produccion`… |
| `become: true` | Ejecuta las tareas con privilegios (sudo). |
| `vars` | Variables del play. |
| `tasks` | La lista de tareas. |

### Cómo se ejecuta

1. Antes de las tareas, Ansible recopila información de cada host (**Gathering Facts**): sistema operativo, IPs, memoria… Se puede desactivar con `gather_facts: false`.
2. Las tareas se ejecutan **en orden**. Cada tarea se lanza en **todos los hosts** del play (en paralelo) **antes** de pasar a la siguiente.
3. Si una tarea **falla en un host**, ese host **sale** del resto del playbook; los demás continúan.
4. Al final aparece el **PLAY RECAP**: por host, cuántas tareas quedaron `ok`, `changed`, `unreachable`, `failed`, `skipped`…

### Probar antes de cambiar nada

| Comando | Qué hace |
|---|---|
| `ansible-playbook site.yml --syntax-check` | Solo comprueba la sintaxis. |
| `ansible-playbook site.yml --list-hosts` | Lista los hosts a los que afectaría. |
| `ansible-playbook site.yml --list-tasks` | Lista las tareas. |
| `ansible-playbook site.yml --check` (`-C`) | **Simula**: informa de lo que cambiaría, sin cambiarlo. |
| `ansible-playbook site.yml --check --diff` | Además, muestra **las diferencias** en archivos. |
| `ansible-playbook site.yml -l web1` | Ejecuta solo en `web1` (`--limit`). |

## Ejemplo

`web.yml`: instala y arranca nginx y publica una página de inicio.

```yaml
---
- name: Configurar servidores web      # play
  hosts: web                            # grupo del inventario
  become: true                          # sudo para todas las tareas

  tasks:
    - name: Instalar nginx
      ansible.builtin.apt:              # módulo (con su nombre completo)
        name: nginx
        state: present                  # estado deseado, no una acción
        update_cache: true

    - name: Publicar la página de inicio
      ansible.builtin.copy:
        content: "<h1>Hola desde {{ inventory_hostname }}</h1>\n"
        dest: /var/www/html/index.html
        mode: "0644"

    - name: Asegurar que nginx está arrancado y arranca al iniciar
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true
```

```bash
ansible-playbook -i inventario.ini web.yml --check --diff   # ensayo
ansible-playbook -i inventario.ini web.yml                  # de verdad
```

Salida resumida de la primera ejecución:

```
PLAY [Configurar servidores web] ********************************
TASK [Gathering Facts] ****************************************** ok: [web1]
TASK [Instalar nginx] ******************************************* changed: [web1]
TASK [Publicar la página de inicio] ***************************** changed: [web1]
TASK [Asegurar que nginx está arrancado...] ********************* ok: [web1]

PLAY RECAP ******************************************************
web1 : ok=4  changed=2  unreachable=0  failed=0  skipped=0
```

Si la ejecutas **otra vez**, verás `changed=0`: todo ya está como se pide. Es la idempotencia en acción.

`{{ inventory_hostname }}` es una variable con el nombre del host en el inventario. Las dobles llaves son sintaxis **Jinja2**, que verás a fondo en el nivel 2.

## Errores comunes

- **Indentación incorrecta.** Los parámetros del módulo van **dentro** del módulo (más indentados que `ansible.builtin.apt:`), no al mismo nivel.
- **Olvidar el guion** de cada tarea o del play: `tasks` es una lista.
- **Tareas sin `name`.** La salida se vuelve ilegible y cuesta saber qué ha fallado.
- **Usar `command`/`shell` para todo** (`shell: apt install -y nginx`). Pierdes la idempotencia: siempre sale `changed`. Busca el módulo específico.
- **Olvidar `become`** para tareas que necesitan root.
- **Confiar ciegamente en `--check`.** Algunas tareas dependen de otras que no se han ejecutado de verdad y el ensayo no puede ser exacto.

## En la entrevista

**«¿En qué orden ejecuta Ansible las tareas cuando hay varios hosts?»**
Tarea a tarea: cada tarea se ejecuta en todos los hosts del play (en paralelo, según `forks`) antes de pasar a la siguiente. Si un host falla en una tarea, se retira del resto del playbook.

**«¿Cómo pruebas un playbook antes de lanzarlo en producción?»**
`--syntax-check` para la sintaxis, `--check --diff` para ver qué cambiaría, `--limit` para probar primero en un host o en un entorno de pruebas, y relanzarlo para confirmar que es idempotente (`changed=0`).

## Resumen

- **Playbook** = lista de **plays**; **play** = hosts + tareas; **task** = un módulo con parámetros.
- Las tareas se ejecutan **en orden**, cada una en **todos los hosts** antes de la siguiente.
- Un host que falla **sale** del resto del playbook; el **PLAY RECAP** resume el resultado.
- Ensaya con **`--check --diff`** y limita con **`-l`**.
- Usa módulos específicos (`apt`, `copy`, `service`) y no `shell` para mantener la **idempotencia**.
