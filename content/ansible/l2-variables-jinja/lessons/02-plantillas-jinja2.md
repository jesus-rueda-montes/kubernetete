---
title: Plantillas con Jinja2
minutes: 10
---

## Qué problema resuelve

Los archivos de configuración (la de nginx, la de una aplicación, `/etc/hosts`…) casi nunca son idénticos en todos los servidores: cambian el nombre del servidor, los puertos, la lista de backends, la memoria. Copiar un archivo distinto por máquina no escala. Una **plantilla** es un archivo con **huecos y lógica** que Ansible rellena para cada host con el módulo **`template`**.

## Analogía

Es como una **carta modelo con campos de combinación**: «Estimado/a {{nombre}}, su pedido nº {{pedido}}…». Una sola plantilla genera una carta personalizada para cada destinatario.

## Concepto

Una plantilla es un archivo (por convención con extensión **`.j2`**) en lenguaje **Jinja2**:

| Sintaxis | Para qué | Ejemplo |
|---|---|---|
| `{{ expresión }}` | Insertar un valor | `listen {{ puerto_web }};` |
| `{% for x in lista %} … {% endfor %}` | Repetir | Una línea por cada backend |
| `{% if condición %} … {% endif %}` | Condicional | Activar TLS solo en producción |
| `{# comentario #}` | Comentario que no aparece en el resultado | |
| `{{ valor \| filtro }}` | **Filtros** que transforman un valor | `{{ nombre \| upper }}` |

Filtros muy usados: **`default`** (valor si no está definida: `{{ puerto \| default(80) }}`), `upper`/`lower`, `join` (`{{ lista \| join(',') }}`), `length`, `to_nice_yaml` / `to_json`.

El módulo:

```yaml
- name: Configuración de nginx
  ansible.builtin.template:
    src: tienda.conf.j2                          # en templates/ (junto al playbook o en el rol)
    dest: /etc/nginx/conf.d/tienda.conf
    mode: "0644"
```

Y un caso donde conviene validar antes de sustituir:

```yaml
- name: Permisos de sudo del equipo
  ansible.builtin.template:
    src: equipo.sudoers.j2
    dest: /etc/sudoers.d/equipo
    mode: "0440"
    validate: visudo -cf %s                      # si la sintaxis es incorrecta, no se instala
```

- Se **renderiza en el nodo de control** con las variables del host y se copia al host.
- Es **idempotente**: si el resultado es igual al archivo que ya hay, `ok`; si cambia, `changed` (y con `--diff` ves exactamente qué cambia).
- `validate` comprueba el archivo nuevo (con `%s` como su ruta) **antes** de colocarlo: si la validación falla, no se sustituye el que funciona.

## Ejemplo

`templates/tienda.conf.j2`:

```
{# Generado por Ansible: no editar a mano #}
upstream backend {
{% for host in groups['app'] %}
    server {{ hostvars[host]['ansible_facts']['default_ipv4']['address'] }}:8080;
{% endfor %}
}

server {
    listen {{ puerto_web | default(80) }};
    server_name {{ dominio }};
{% if entorno == 'pro' %}
    # En producción, forzamos HTTPS
    return 301 https://$host$request_uri;
{% endif %}
    location / {
        proxy_pass http://backend;
    }
}
```

Con dos hosts en el grupo `app` y `entorno: dev`, el resultado en el servidor web sería algo como:

```
upstream backend {
    server 10.0.1.11:8080;
    server 10.0.1.12:8080;
}

server {
    listen 80;
    server_name dev.tienda.example.com;
    location / {
        proxy_pass http://backend;
    }
}
```

(Para leer los facts de los hosts de `app`, el play tiene que haberlos recogido: por ejemplo, incluyendo antes esos hosts en algún play con `gather_facts`.)

## Errores comunes

- **Editar a mano el archivo generado** en el servidor: la siguiente ejecución lo sobrescribe. Pon un comentario «generado por Ansible».
- **Variable no definida** en la plantilla: la tarea falla. Usa `default` para valores opcionales.
- **Confundir `{{ }}` con `{% %}`**: el primero imprime; el segundo es lógica (bucles, condiciones).
- **Plantillas con demasiada lógica**: difíciles de leer y probar. Prepara los datos en variables y deja la plantilla sencilla.
- **No usar `validate`** en archivos críticos como sudoers: un error de sintaxis puede dejarte sin poder usar sudo. (El comando de validación tiene que poder comprobar el archivo suelto; no todos los programas lo permiten con un fragmento de configuración.)

## En la entrevista

**«¿Diferencia entre los módulos `copy` y `template`?»**
`copy` copia un archivo tal cual; `template` procesa antes una plantilla Jinja2 con las variables y facts de cada host, así que el mismo archivo fuente genera configuraciones distintas.

**«¿Cómo evitas romper un servicio con una configuración mal generada?»**
Con el parámetro `validate` del módulo `template` (por ejemplo, `visudo -cf %s` para un archivo de sudoers), probando antes con `--check --diff` y recargando el servicio mediante un handler solo si la plantilla cambió.

## Resumen

- **`template`** genera archivos a partir de plantillas **Jinja2** (`.j2`) con las variables de cada host.
- **`{{ }}`** inserta valores; **`{% %}`** para `for` e `if`; **`{# #}`** comentarios.
- **Filtros** con `|`: `default`, `join`, `upper`, `to_nice_yaml`…
- Es **idempotente** y muestra diferencias con `--diff`.
- **`validate`** comprueba el archivo antes de sustituirlo.
