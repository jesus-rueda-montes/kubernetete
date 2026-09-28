---
title: ¿Qué es Ansible?
minutes: 8
---

## Qué problema resuelve

Tienes 30 servidores y hay que instalar un paquete, cambiar un archivo de configuración y reiniciar un servicio **en todos**. Hacerlo a mano por SSH, uno a uno:

- lleva horas,
- es fácil equivocarse en alguno y que queden **distintos entre sí**,
- no queda registro de qué se hizo ni se puede repetir igual la próxima vez.

**Ansible** automatiza la **configuración** de máquinas: describes cómo deben quedar en archivos YAML y Ansible se conecta a todas y lo aplica.

## Analogía

Ansible es como un **director de orquesta con una partitura**. La partitura (el playbook) dice qué debe sonar; el director (el nodo de control) indica a cada músico (cada servidor) qué tocar. Los músicos no necesitan ningún aparato especial: basta con que oigan al director (SSH).

## Concepto

### Piezas

| Pieza | Qué es |
|---|---|
| **Nodo de control** (*control node*) | La máquina donde instalas Ansible y desde la que lo ejecutas (tu portátil o un servidor de CI). Debe ser Linux o similar (macOS, WSL en Windows). |
| **Nodos gestionados** (*managed nodes*) | Las máquinas que configuras. |
| **Inventario** (*inventory*) | La lista de nodos gestionados, organizados en grupos. |
| **Módulo** | Una unidad de trabajo: instalar un paquete, copiar un archivo, gestionar un servicio… Ansible trae cientos. |
| **Tarea** (*task*) | Una llamada a un módulo con sus parámetros. |
| **Playbook** | Un archivo YAML con una lista ordenada de tareas para unos hosts. |

### Cómo funciona

- **Sin agente** (*agentless*): no instalas nada especial en los nodos gestionados. Ansible se conecta por **SSH** (o WinRM en Windows).
- **Push**: el nodo de control **empuja** los cambios cuando tú lo ejecutas. No hay un demonio consultando periódicamente.
- Para la mayoría de módulos, el nodo gestionado necesita **Python**: Ansible copia allí un pequeño programa, lo ejecuta y lo borra.

### Idempotencia

La idea clave de Ansible: los módulos describen un **estado final**, no una acción. «El paquete nginx debe estar **instalado**» en lugar de «instala nginx».

- Si ya está instalado, el módulo **no hace nada** y responde `ok`.
- Si no lo está, lo instala y responde `changed`.

Así puedes ejecutar el mismo playbook **100 veces** y el resultado es el mismo que tras la primera. A esto se le llama **idempotencia**.

### Ansible frente a Terraform

| | Terraform | Ansible |
|---|---|---|
| Para qué sobre todo | **Crear** infraestructura (redes, VMs, buckets) | **Configurar** lo que hay dentro de las máquinas (paquetes, archivos, servicios) |
| Estado | Guarda un **state** | No guarda estado: consulta la máquina en cada ejecución |
| Estilo | Declarativo | Declarativo por tarea, pero ejecutado **en orden** |

Se usan mucho **juntos**: Terraform crea las VMs y Ansible las configura.

## Ejemplo

Comprobar que Ansible llega a todas las máquinas de un inventario:

```bash
ansible all -i inventario.ini -m ping
```

```
web1 | SUCCESS => {
    "changed": false,
    "ping": "pong"
}
db1 | UNREACHABLE! => {
    "msg": "Failed to connect to the host via ssh: ...",
    "unreachable": true
}
```

El módulo `ping` **no es el ping de red** (ICMP): comprueba que Ansible puede conectarse por SSH y ejecutar Python. `web1` responde bien; con `db1` falla la conexión SSH.

## Errores comunes

- **Pensar que hay que instalar un agente** en cada servidor. Basta con SSH y Python.
- **Confundir el módulo `ping` con el comando `ping`.** Uno comprueba SSH y Python; el otro, conectividad de red.
- **Escribir tareas que «hacen cosas»** (ejecutar comandos sueltos) en lugar de describir estados. Se pierde la idempotencia: cada ejecución vuelve a hacerlo.
- **Usar Ansible para todo el ciclo de vida de la infraestructura en la nube.** Puede crear recursos, pero para eso Terraform es más adecuado porque lleva la cuenta del estado.

## En la entrevista

**«¿Qué significa que Ansible es agentless? ¿Qué necesita en los nodos gestionados?»**
Que no requiere instalar un servicio propio en los nodos: el nodo de control se conecta por SSH (o WinRM) y ejecuta los módulos, que en Linux necesitan Python en el nodo gestionado.

**«¿Qué es la idempotencia y por qué importa?»**
Que ejecutar la misma tarea varias veces deja el sistema igual que ejecutarla una vez. Los módulos comprueban el estado actual y solo cambian lo necesario, así que puedes relanzar un playbook sin miedo y detectar desviaciones.

## Resumen

- Ansible **configura máquinas** a partir de archivos YAML.
- Es **agentless** y **push**: se conecta por **SSH** desde el nodo de control.
- **Inventario** = qué máquinas; **módulo** = qué trabajo; **playbook** = lista ordenada de tareas.
- Los módulos son **idempotentes**: responden `ok` si no hay nada que hacer y `changed` si cambian algo.
- Terraform **crea** infraestructura; Ansible la **configura**. Se complementan.
