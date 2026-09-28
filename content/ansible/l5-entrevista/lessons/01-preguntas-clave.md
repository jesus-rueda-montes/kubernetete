---
title: Las preguntas que siempre salen
minutes: 14
---

## Qué problema resuelve

En las entrevistas de Ansible se repite un núcleo de preguntas: qué es y cómo funciona, la idempotencia, los módulos frente a `shell`, los handlers, la precedencia de variables, los roles, Vault… Y casi siempre: **«¿En qué se diferencia de Terraform?»**.

Tener preparadas respuestas cortas y ordenadas te deja energía para los escenarios prácticos.

## Analogía

Es preparar la **defensa de un proyecto**: ya sabes hacerlo; ahora ensayas **contarlo** en un minuto, con la estructura clara y un detalle que demuestre que lo has usado de verdad.

## Concepto

Estructura de cada respuesta: **definición → para qué → cómo funciona → matiz práctico**.

### Fundamentos

**«¿Qué es Ansible y cómo funciona?»**
Una herramienta de **automatización y gestión de configuración**. Es **sin agente**: desde un **nodo de control** se conecta por **SSH** (WinRM en Windows) a los hosts del **inventario**, copia pequeños programas (los módulos), los ejecuta y los borra. Modelo **push**: el nodo de control empuja los cambios. Los playbooks se escriben en **YAML**.

**«¿Qué es la idempotencia y por qué importa?»**
Ejecutar el mismo playbook varias veces deja el sistema **igual** que ejecutarlo una: la segunda vez no cambia nada (`changed=0`). Así se puede relanzar sin miedo y detectar desviaciones. Los módulos (`apt`, `copy`, `service`…) son idempotentes porque comprueban el estado antes de actuar.

**«¿Por qué no usar siempre `shell` o `command`?»**
Porque **no son idempotentes**: ejecutan siempre y siempre informan `changed`. Si no hay módulo, se usan con `creates`/`removes` o con `changed_when` para que informen bien. Además, un módulo valida parámetros y funciona en `--check`.

### Estructura

**«¿Qué es un handler?»**
Una tarea que solo se ejecuta **si otra la notifica** con `notify` y esa otra ha producido un cambio. Se ejecuta **una vez al final** del play, aunque la notifiquen varias tareas. Típico: reiniciar nginx solo si cambió su configuración.

**«¿Rol o collection?»**
Un **rol** agrupa tareas, handlers, plantillas, variables y defaults con una estructura fija, para reutilizar una función (configurar nginx). Una **collection** es el formato de distribución que empaqueta **roles, módulos y plugins** (por ejemplo, `google.cloud`), y se instala con `ansible-galaxy collection install`.

**«¿Cómo funciona la precedencia de variables?»**
Hay muchos niveles, pero la regla práctica: **lo más específico gana** (host_vars > group_vars del grupo > group_vars/all), los **defaults de un rol** son lo más débil y **`--extra-vars` (`-e`) gana siempre**.

### Seguridad y operación

**«¿Cómo gestionas secretos?»**
Con **Ansible Vault**: archivos o variables cifrados que se versionan en git y se descifran al ejecutar (`--ask-vault-password`, `--vault-password-file` o `--vault-id`). En CI, la contraseña viene del gestor de secretos del pipeline. Alternativa: leerlos en ejecución de un gestor externo con un lookup. Y `no_log: true` en las tareas que los manejan.

**«¿Cómo pruebas un playbook antes de aplicarlo?»**
`--syntax-check`, **`ansible-lint`**, y `--check --diff` para ver qué cambiaría sin cambiarlo. Luego en un entorno de pruebas (o con Molecule para roles) y con `--limit` en un subconjunto de hosts.

### Ansible frente a Terraform

| | Terraform | Ansible |
|---|---|---|
| Uso principal | **Crear infraestructura** (redes, VMs, bases de datos) | **Configurar** lo que hay dentro (paquetes, archivos, servicios) |
| Estilo | **Declarativo**: describes el resultado | Declarativo por tarea, pero **ejecutado en orden** (procedimental) |
| Estado | **State** que recuerda lo que gestiona | **Sin state**: consulta el estado real en cada ejecución |
| Borrar | Quitar del código = destruir | Quitar una tarea **no deshace** lo que hizo; hay que escribir `state: absent` |
| Agente | No (APIs del proveedor) | No (SSH) |

Se **combinan**: Terraform crea las VMs y Ansible las configura (con un inventario dinámico o generado por Terraform). En Kubernetes o con imágenes inmutables, Ansible se usa más para construir imágenes o para sistemas tradicionales.

## Ejemplo

Respuesta en cuatro pasos a «¿Cuándo usarías Ansible y cuándo Terraform?»:

```text
1. Definición:  Terraform crea y destruye infraestructura con un state;
                Ansible configura sistemas conectándose por SSH, sin state.
2. Para qué:    Terraform para redes, VMs, bases de datos, IAM;
                Ansible para paquetes, archivos, servicios y despliegues en VMs.
3. Cómo:        en la práctica, Terraform crea las VMs y Ansible las configura,
                con un inventario dinámico que las descubre por etiquetas.
4. Matiz:       en Ansible, quitar una tarea no deshace su efecto; en Terraform,
                quitar un recurso lo destruye. Por eso no uso Ansible para el
                ciclo de vida de la infraestructura.
```

## Errores comunes

- **Decir que Ansible necesita un agente**: es agentless (SSH).
- **Usar `shell` para todo**: pierdes idempotencia, `--check` y claridad.
- **Creer que quitar una tarea deshace su efecto**: hay que declarar `state: absent`.
- **Confundir handlers con tareas normales**: solo corren si se les notifica y hubo cambio, y al final.
- **Guardar contraseñas en claro** en `group_vars`: usa Vault.

## En la entrevista

**«Un playbook marca `changed` en cada ejecución aunque no cambie nada. ¿Qué pasa?»**
Casi siempre es una tarea `shell` o `command` sin `changed_when` ni `creates`, o una plantilla con contenido que varía (una fecha). Lo corregiría con el módulo adecuado o con `changed_when` para que la idempotencia sea real y el informe sea fiable.

**«¿Qué pasa si la conexión SSH falla en uno de 50 hosts?»**
Ese host queda como `unreachable` y Ansible sigue con los demás (con la estrategia por defecto). Al final, el resumen lo indica. Puedo relanzar solo sobre él con `--limit`. Si necesito que todo pare, `any_errors_fatal` o `max_fail_percentage`.

## Resumen

- Ansible: **sin agente**, **SSH**, **push**, YAML, inventario; módulos **idempotentes**.
- `shell`/`command` no son idempotentes: `creates`, `removes` o `changed_when`.
- Handlers: por `notify`, una vez, al final. **Roles** reutilizan; **collections** distribuyen.
- Precedencia: lo específico gana; defaults de rol lo más débil; **`-e` gana siempre**. Secretos con **Vault**.
- Terraform **crea** infraestructura (con state); Ansible la **configura** (sin state). Se combinan.
