---
title: Escribir tareas idempotentes
minutes: 9
---

## Qué problema resuelve

Un playbook se ejecuta **muchas veces**: al crear servidores, al cambiar la configuración, para corregir desviaciones. Si cada ejecución **repite acciones** (vuelve a descargar un archivo, reinicia servicios, añade la misma línea dos veces), aparecen cortes, duplicados y resultados distintos en cada servidor. Y un playbook que siempre dice `changed` **no te informa** de nada.

## Analogía

Una tarea idempotente es como un **interruptor con posiciones «encendido/apagado»**; una que no lo es, como un **pulsador que cambia de estado cada vez**. Si pides «encendido» diez veces con el interruptor, la luz sigue encendida; con el pulsador, depende de cuántas veces lo pulses.

## Concepto

Una tarea es **idempotente** si ejecutarla una vez o diez deja el sistema **igual**, y en las siguientes ejecuciones informa **`ok`** en lugar de `changed`.

### Módulos con estado frente a comandos

| Tarea | ¿Idempotente? |
|---|---|
| `apt: name=nginx state=present` | Sí: comprueba antes de instalar. |
| `service: name=nginx state=started` | Sí. |
| `shell: apt-get install -y nginx` | No sabe si ya estaba: **siempre `changed`**. |
| `command: /opt/instalar.sh` | Se ejecuta siempre. |
| `service: state=restarted` | Siempre reinicia. |

### Cuando no hay más remedio que usar `command` o `shell`

A veces no existe un módulo para lo que necesitas. Entonces, **haz tú la tarea idempotente**:

- **`creates: RUTA`**: no ejecuta el comando si esa ruta ya existe (y `removes`, al revés: solo lo ejecuta si existe).
- **`changed_when`**: decide cuándo cuenta como cambio (por ejemplo, `changed_when: false` para comandos que solo consultan).
- **`register`** + una condición: ejecuta algo solo si una consulta previa lo indica (nivel 3).

```yaml
- name: Inicializar la aplicación (solo la primera vez)
  ansible.builtin.command:
    cmd: /opt/tienda/bin/init
    creates: /opt/tienda/.inicializado   # si existe, no se ejecuta

- name: Consultar la versión (no cambia nada)
  ansible.builtin.command: /opt/tienda/bin/version
  register: version
  changed_when: false
```

### Cómo comprobarlo

1. Ejecuta el playbook.
2. **Ejecútalo otra vez**: el PLAY RECAP debería mostrar **`changed=0`**.
3. `--check --diff` también te dice qué cambiaría sin tocar nada.

Esta «segunda ejecución sin cambios» es exactamente lo que comprueban herramientas de pruebas de roles como Molecule (nivel 4).

## Ejemplo

Versión **no** idempotente:

```yaml
- name: Añadir el DNS interno
  ansible.builtin.shell: echo "nameserver 10.0.0.2" >> /etc/resolv.conf
```

Cada ejecución añade otra línea igual. Versión idempotente:

```yaml
- name: Añadir el DNS interno
  ansible.builtin.lineinfile:
    path: /etc/resolv.conf
    line: "nameserver 10.0.0.2"     # si ya está, no hace nada
```

## Errores comunes

- **Recurrir a `shell` por comodidad** cuando existe un módulo.
- **Comandos de consulta que marcan `changed`**: añade `changed_when: false`.
- **Descargar o compilar en cada ejecución**: usa `creates` (o el módulo adecuado, como `get_url` con `dest`).
- **No relanzar el playbook** para comprobar que la segunda vez da `changed=0`.

## En la entrevista

**«¿Cómo harías idempotente una tarea que necesita el módulo `command`?»**
Con `creates` o `removes` para que solo se ejecute cuando haga falta, con `changed_when` para que informe correctamente, o comprobando antes el estado con otra tarea (`register` y `when`). Y verificando que una segunda ejecución da `changed=0`.

**«¿Por qué importa que un playbook sea idempotente?»**
Porque permite relanzarlo con seguridad para aplicar cambios o corregir desviaciones, sin efectos secundarios; y porque `changed` pasa a ser información útil: indica que algo no estaba como debía.

## Resumen

- **Idempotente** = una o diez ejecuciones dejan el mismo resultado; la segunda informa **`ok`**.
- Usa **módulos con estado** (`present`, `started`, `directory`) antes que `shell`/`command`.
- Si necesitas `command`/`shell`: **`creates`/`removes`**, **`changed_when`**.
- `lineinfile` en vez de `echo >>`.
- Comprueba con una **segunda ejecución**: **`changed=0`**.
