---
title: Ansible Galaxy y collections
minutes: 10
---

## Qué problema resuelve

No hace falta escribir desde cero un rol para instalar Docker o un módulo para gestionar recursos de Google Cloud: la comunidad ya los ha escrito y probado. Además, los propios módulos de Ansible que no son básicos (Docker, Kubernetes, nubes, bases de datos) **no vienen en el núcleo**: se distribuyen en **collections**.

Necesitas saber **qué es una collection**, **dónde encontrarlas** e **instalarlas de forma reproducible** para todo el equipo y el pipeline.

## Analogía

- **Ansible Galaxy** es la **tienda de aplicaciones** de Ansible.
- Una **collection** es una **app** con varias herramientas dentro (módulos, roles, plugins).
- El **`requirements.yml`** es la **lista de la compra**: cualquiera del equipo instala exactamente lo mismo con un comando.

## Concepto

### Collections

Una **collection** es un paquete con **módulos, plugins, roles y playbooks**. Tiene un nombre con dos partes: **`namespace.collection`**.

| Collection | Qué trae |
|---|---|
| `ansible.builtin` | Los módulos básicos (`copy`, `template`, `service`…). Viene siempre. |
| `community.general` | Cientos de módulos de la comunidad. |
| `community.docker` | Contenedores e imágenes de Docker. |
| `kubernetes.core` | Objetos de Kubernetes y Helm. |
| `google.cloud` | Recursos de Google Cloud. |

Por eso se recomienda escribir el **nombre completo** del módulo (*FQCN*, *fully qualified collection name*): `ansible.builtin.copy`, `community.docker.docker_container`. Así no hay ambigüedad si dos collections tienen un módulo con el mismo nombre.

### `ansible-core` frente a `ansible`

- **`ansible-core`**: el motor y la collection `ansible.builtin`. Nada más.
- **`ansible`** (el paquete de la comunidad): `ansible-core` **más** una selección grande de collections.

Si instalas solo `ansible-core`, tendrás que instalar las collections que uses.

### Ansible Galaxy

**galaxy.ansible.com** es el repositorio público de **collections** y **roles**. Se usa con el comando **`ansible-galaxy`**:

```bash
ansible-galaxy collection install community.docker
ansible-galaxy collection list
ansible-galaxy role install geerlingguy.docker
```

Antes de usar algo de Galaxy, revisa quién lo mantiene, cuándo se actualizó y qué hace: vas a ejecutarlo con privilegios en tus servidores.

### `requirements.yml`

Para que todos (y el pipeline de CI) usen lo mismo, las dependencias se declaran en un archivo, **con versiones**:

```yaml
# requirements.yml
collections:
  - name: community.docker
    version: ">=5.0.0,<6.0.0"
  - name: google.cloud
    version: "1.14.0"

roles:
  - name: geerlingguy.docker
    version: "8.0.0"
```

```bash
ansible-galaxy collection install -r requirements.yml   # solo las collections
ansible-galaxy role install -r requirements.yml         # solo los roles
ansible-galaxy install -r requirements.yml              # ambos
```

## Ejemplo

Un proyecto real queda así:

```text
proyecto/
├── ansible.cfg
├── requirements.yml           # collections y roles externos, con versiones
├── inventario/
│   ├── pro.ini
│   └── group_vars/
├── roles/                     # tus roles propios
│   ├── common/
│   └── nginx/
└── site.yml                   # el playbook principal
```

Y un playbook que usa un módulo de una collection:

```yaml
- name: Contenedor de la web
  hosts: docker
  become: true
  tasks:
    - name: Ejecutar la web
      community.docker.docker_container:
        name: web
        image: nginx:1.27
        ports:
          - "80:80"
        restart_policy: always
```

## Errores comunes

- **«couldn't resolve module/action»**: el módulo es de una collection que no está instalada. Instálala (y añádela al `requirements.yml`).
- **No fijar versiones** en `requirements.yml`: una actualización de la collection puede romper el playbook en el pipeline.
- **Escribir `docker_container` sin FQCN**: puede ser ambiguo o depender del orden de búsqueda. Usa `community.docker.docker_container`.
- **Instalar roles de Galaxy sin revisarlos**: se ejecutan con permisos de administrador en tus servidores.
- **Instalar las collections a mano en tu equipo** y olvidar el `requirements.yml`: el pipeline no tendrá lo mismo.

## En la entrevista

**«¿Qué es una collection de Ansible?»**
Un paquete de contenido (módulos, plugins, roles) con nombre `namespace.collection`, distribuido por Ansible Galaxy o Automation Hub. Desde la separación de `ansible-core`, los módulos que no son básicos viven en collections, y se referencian por su nombre completo, como `community.docker.docker_container`.

**«¿Cómo te aseguras de que todo el equipo usa las mismas dependencias?»**
Con un `requirements.yml` en el repositorio, con las versiones de collections y roles fijadas, y un paso en el pipeline que ejecuta `ansible-galaxy install -r requirements.yml` antes del playbook.

## Resumen

- **Collection** = módulos, plugins y roles con nombre **`namespace.collection`**.
- Usa el **FQCN**: `ansible.builtin.copy`, `community.docker.docker_container`.
- **`ansible-core`** solo trae `ansible.builtin`; el paquete **`ansible`** incluye muchas collections.
- **Galaxy**: `ansible-galaxy collection install`, `role install`, `collection list`.
- **`requirements.yml`** con versiones + `ansible-galaxy install -r requirements.yml`.
