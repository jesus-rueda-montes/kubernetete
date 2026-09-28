---
title: Procesos, variables de entorno y tuberías
minutes: 9
---

## Qué problema resuelve

Un servidor ejecuta muchos programas a la vez. Cuando algo va mal necesitas saber **qué se está ejecutando**, **pararlo** si hace falta, entender **cómo se configura** (muchas aplicaciones leen su configuración de **variables de entorno**, justo como hacen los contenedores) y **combinar comandos** para filtrar la información que importa.

## Analogía

Las **tuberías** (`|`) son como una **cadena de montaje**: lo que sale de una máquina entra en la siguiente. `cat log | grep error | wc -l` es: «saca el log → quédate con las líneas de error → cuéntalas».

## Concepto

### Procesos

Cada programa en ejecución es un **proceso** con un número identificador, el **PID**.

| Comando | Qué hace |
|---|---|
| `ps aux` | Lista todos los procesos. |
| `top` (o `htop`) | Procesos en tiempo real, ordenados por consumo de CPU y memoria. |
| `kill PID` | Pide al proceso que termine (señal **SIGTERM**, la «educada»). |
| `kill -9 PID` | Lo mata sin contemplaciones (señal **SIGKILL**, no se puede ignorar). |

Primero se intenta `kill` (SIGTERM) para que el programa cierre ordenadamente; `-9` es el último recurso. Kubernetes hace lo mismo al parar un contenedor: envía SIGTERM, espera un margen y, si sigue vivo, SIGKILL.

Los servicios del sistema (nginx, ssh…) los gestiona normalmente **systemd**: `systemctl status nginx`, `systemctl restart nginx`.

### Variables de entorno

Son pares **NOMBRE=valor** que un proceso hereda de quien lo lanzó.

```bash
echo $HOME               # leer una variable
export ENTORNO=pro       # crearla (y que la hereden los programas que lances)
env                      # ver todas
```

Variables conocidas: `HOME` (tu carpeta), `PATH` (dónde se buscan los programas), `USER`. Muchas aplicaciones leen de aquí su configuración (`DATABASE_URL`, `PORT`…). Es la forma estándar de configurar contenedores.

### Entrada, salida y tuberías

Todo proceso tiene tres canales: **stdin** (entrada), **stdout** (salida normal) y **stderr** (salida de errores).

| Símbolo | Qué hace | Ejemplo |
|---|---|---|
| `\|` | La salida de un comando es la entrada del siguiente | `ps aux \| grep nginx` |
| `>` | Guarda la salida en un archivo (lo **sobrescribe**) | `ls > lista.txt` |
| `>>` | La **añade** al final del archivo | `echo hola >> notas.txt` |
| `2>` | Redirige los **errores** | `comando 2> errores.txt` |

Comandos que brillan con tuberías: **`grep`** (filtrar líneas), **`wc -l`** (contar líneas), **`sort`**, **`head`**/**`tail`**.

### Códigos de salida

Cada comando termina con un número: **0 = éxito**; cualquier otro = error. Se consulta con `echo $?`. Los scripts y los sistemas de CI deciden si un paso ha fallado mirando este código.

## Ejemplo

```bash
ps aux | grep nginx                  # ¿está nginx en marcha?
systemctl status nginx               # su estado según systemd

grep "ERROR" /var/log/app.log | wc -l          # ¿cuántos errores hay?
grep "ERROR" /var/log/app.log | tail -n 5      # los 5 últimos

export PORT=8080                     # configuración por variable de entorno
./mi-app                             # la app lee $PORT al arrancar

./tests.sh; echo "salida: $?"        # 0 si todo fue bien
```

## Errores comunes

- **Usar `kill -9` a la primera.** El programa no puede cerrar ficheros ni conexiones de forma ordenada; prueba antes `kill` sin opciones.
- **Confundir `>` con `>>`.** `>` borra el contenido previo del archivo.
- **Crear una variable sin `export`** y esperar que la vea un programa que lanzas después.
- **Ignorar los códigos de salida** en scripts: un paso falla y el script sigue como si nada. En bash, `set -e` hace que se detenga al primer error.

## En la entrevista

**«¿Diferencia entre SIGTERM y SIGKILL?»**
SIGTERM (`kill`) pide al proceso que termine y le deja cerrar de forma ordenada; puede capturarla. SIGKILL (`kill -9`) lo mata inmediatamente y no se puede capturar ni ignorar. Kubernetes envía SIGTERM al parar un contenedor y, si no termina tras el periodo de gracia, SIGKILL.

**«¿Qué hace `cat app.log | grep ERROR | wc -l`?»**
Cuenta cuántas líneas del log contienen «ERROR»: la salida de cada comando pasa como entrada al siguiente mediante tuberías.

## Resumen

- Proceso = programa en ejecución con un **PID**; se ven con `ps aux` y `top`.
- **`kill`** (SIGTERM, ordenado) antes que **`kill -9`** (SIGKILL, inmediato).
- **Variables de entorno**: `export NOMBRE=valor`, se leen con `$NOMBRE`; así se configuran los contenedores.
- **`|`** encadena comandos; **`>`** sobrescribe, **`>>`** añade, **`2>`** redirige errores.
- Código de salida **0 = éxito**; se consulta con `$?`.
