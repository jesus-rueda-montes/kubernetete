---
title: Escenarios prácticos
minutes: 13
---

## Qué problema resuelve

Las preguntas de nivel avanzado son escenarios: «Actualiza 100 servidores web **sin cortar el servicio**», «Las VMs se crean y destruyen solas: ¿cómo las encuentra Ansible?», «El playbook tarda una hora: ¿cómo lo aceleras?».

Para responderlas hacen falta piezas que controlan **cómo** se ejecuta un playbook: lotes, delegación, inventarios dinámicos y ajustes de rendimiento.

## Analogía

Es **renovar los vagones de un tren en marcha**: no paras el tren entero. Sacas unos pocos de servicio (**`serial`**), avisas a la estación para que no los use (**delegación** al balanceador), los arreglas, los vuelves a enganchar y sigues con los siguientes. Si demasiados salen mal, **paras la obra** (`max_fail_percentage`).

## Concepto

### Cómo se ejecuta un playbook por defecto

- Estrategia **`linear`**: cada tarea se ejecuta en **todos** los hosts antes de pasar a la siguiente.
- En paralelo en **5 hosts a la vez** (`forks`, 5 por defecto). Se sube con `-f`/`--forks` o en `ansible.cfg`.
- Estrategia **`free`**: cada host avanza a su ritmo hasta el final, sin esperar a los demás.

### Actualizaciones por lotes: `serial`

- `serial: 5` (o `serial: "20%"`, o una lista como `[1, 5, "25%"]`) ejecuta **el play completo** en un lote de hosts antes de pasar al siguiente.
- Con **`max_fail_percentage`**, si en un lote fallan más hosts de los permitidos, **se detiene** el resto: no se rompe todo el parque.
- Empezar con un lote de 1 es un **canary**: si el primer servidor falla, no se toca ninguno más.

### Delegación

- **`delegate_to: HOST`** ejecuta una tarea **en otro host**, pero en el contexto del host actual (sus variables). Típico: sacar el servidor del balanceador antes de actualizarlo.
- **`delegate_to: localhost`** (o `local_action`) la ejecuta en el nodo de control: llamar a una API, esperar a que responda una URL.
- **`run_once: true`**: la tarea se ejecuta en **un solo host** del lote (una migración de base de datos, un aviso).

### Inventarios dinámicos

- En la nube, las VMs cambian: un inventario estático se queda viejo.
- Un **plugin de inventario** consulta la API del proveedor en cada ejecución. En GCP: **`google.cloud.gcp_compute`**, configurado en un archivo que termina en `gcp.yml` o `gcp_compute.yml`, con filtros y **`keyed_groups`** para crear grupos a partir de etiquetas (por ejemplo, con `key: labels.rol` y `prefix: rol`, la etiqueta `rol=web` da el grupo `rol_web`).
- Hay equivalentes para AWS (`amazon.aws.aws_ec2`) y Azure (`azure.azcollection.azure_rm`).

### Rendimiento

- Subir **`forks`** (con cuidado con la CPU del nodo de control).
- **`pipelining`** en `ansible.cfg`: reduce las operaciones SSH por tarea (está desactivado por defecto; con `become` y `sudo` requiere quitar `requiretty` en los hosts).
- **`gather_facts: false`** si no usas facts, o cachearlos.
- **`strategy: free`** si los hosts no dependen unos de otros.
- Tareas largas con **`async`** y `poll` para no bloquear.

## Ejemplo

Actualización sin corte de un grupo de servidores web detrás de un balanceador:

```yaml
- name: Actualizar la web sin corte
  hosts: web
  become: true
  serial: [1, "25%"]           # primero 1 (canary), luego lotes del 25 %
  max_fail_percentage: 10      # si falla más del 10 % de un lote, parar
  tasks:
    - name: Sacar el servidor del balanceador
      ansible.builtin.command: /usr/local/bin/lb-remove {{ inventory_hostname }}
      delegate_to: lb1.tienda.internal

    - name: Instalar la nueva versión
      ansible.builtin.apt:
        name: tienda-web=2.3.1
        state: present
      notify: Reiniciar tienda-web

    - name: Aplicar los handlers ahora (no al final del play)
      ansible.builtin.meta: flush_handlers

    - name: Esperar a que responda
      ansible.builtin.uri:
        url: "http://{{ inventory_hostname }}:8080/healthz"
      delegate_to: localhost
      register: salud
      retries: 10
      delay: 3
      until: salud.status == 200

    - name: Devolver el servidor al balanceador
      ansible.builtin.command: /usr/local/bin/lb-add {{ inventory_hostname }}
      delegate_to: lb1.tienda.internal

  handlers:
    - name: Reiniciar tienda-web
      ansible.builtin.service:
        name: tienda-web
        state: restarted
```

## Errores comunes

- **Actualizar todos los hosts a la vez** (sin `serial`): un error deja todo el servicio caído.
- **Olvidar `flush_handlers`**: el reinicio se haría al final del play, después de devolver el servidor al balanceador.
- **Usar `run_once` sin `serial` pensando que es «una vez por lote»**: sin lotes, es una vez en todo el play; con `serial`, una vez por lote.
- **Inventario estático en la nube**: apunta a VMs que ya no existen y no ve las nuevas.
- **Subir `forks` a cientos** en un nodo de control pequeño: lo saturas.

## En la entrevista

**«¿Cómo actualizas 100 servidores sin cortar el servicio?»**
Con `serial` para ir por lotes (empezando por 1 como canary), `max_fail_percentage` para parar si algo va mal, delegación al balanceador para sacar y devolver cada servidor, `flush_handlers` para reiniciar dentro del lote y una comprobación de salud antes de devolverlo al balanceador.

**«¿Cómo sabe Ansible qué VMs hay si se crean y destruyen con autoescalado?»**
Con un inventario dinámico: el plugin `google.cloud.gcp_compute` consulta la API de Compute Engine en cada ejecución y agrupa las VMs por etiquetas con `keyed_groups`. Así el playbook apunta a grupos como `rol_web` y siempre ve el parque real.

## Resumen

- Por defecto: estrategia **`linear`** y **5 forks**; `free` para que cada host vaya a su ritmo.
- **`serial`** (número, % o lista) actualiza por lotes; **`max_fail_percentage`** para la obra si falla demasiado.
- **`delegate_to`** ejecuta en otro host (balanceador, localhost); **`run_once`** una sola vez.
- **Inventario dinámico** (`google.cloud.gcp_compute`, `keyed_groups`) para la nube.
- Rendimiento: `forks`, **`pipelining`**, sin facts innecesarios, `strategy: free`, `async`.
