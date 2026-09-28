---
title: Moverse por el sistema y los permisos
minutes: 10
---

## Qué problema resuelve

Casi todo en la nube acaba ejecutándose en **Linux**: las máquinas virtuales, los nodes de Kubernetes, las imágenes de contenedor… Y en un servidor no hay ventanas ni ratón: hay una **terminal**. Saber moverte por ella, leer archivos y entender los **permisos** es imprescindible para depurar casi cualquier problema.

## Analogía

El sistema de ficheros de Linux es un **árbol genealógico** que empieza en una única raíz, `/`. Cada carpeta cuelga de otra. Y los permisos son como las **llaves de un edificio**: el dueño, los vecinos de su grupo y los visitantes tienen llaves distintas para leer, modificar o entrar.

## Concepto

### Rutas

- Todo parte de la raíz **`/`**. No hay `C:` ni `D:`.
- **Ruta absoluta**: empieza por `/`, por ejemplo `/etc/nginx/nginx.conf`.
- **Ruta relativa**: parte de donde estás, por ejemplo `logs/app.log`.
- `.` es la carpeta actual; `..` la carpeta padre; `~` tu carpeta personal (`/home/usuario`).

Carpetas importantes: `/etc` (configuración), `/var/log` (logs), `/home` (usuarios), `/tmp` (temporales), `/usr/bin` (programas).

### Comandos básicos

| Comando | Qué hace |
|---|---|
| `pwd` | Muestra dónde estás. |
| `ls -l` | Lista archivos con detalles (permisos, dueño, tamaño). `-a` incluye los ocultos (empiezan por `.`). |
| `cd ruta` | Cambia de carpeta. `cd` solo te lleva a `~`. |
| `cat archivo` | Muestra el contenido. |
| `less archivo` | Lo muestra página a página (`q` para salir). |
| `tail -f archivo` | Muestra el final y sigue mostrando lo nuevo (ideal para logs). |
| `mkdir -p a/b/c` | Crea carpetas (y las intermedias). |
| `cp`, `mv`, `rm` | Copiar, mover o renombrar, borrar. `rm -r` borra carpetas. **No hay papelera.** |

### Permisos

`ls -l` muestra algo así:

```
-rwxr-x---  1 ana  devs  4096  script.sh
```

Los 10 primeros caracteres: el tipo (`-` archivo, `d` carpeta) y **tres grupos de tres**:

| Quién | Caracteres | Aquí |
|---|---|---|
| **u**ser (dueño: `ana`) | `rwx` | leer, escribir y ejecutar |
| **g**roup (grupo: `devs`) | `r-x` | leer y ejecutar |
| **o**thers (el resto) | `---` | nada |

Cada permiso tiene un valor: **r = 4**, **w = 2**, **x = 1**. Se suman por grupo, y así salen los números habituales:

| Número | Permisos | Uso típico |
|---|---|---|
| `755` | `rwxr-xr-x` | Programas y carpetas: todos pueden leer y ejecutar; solo el dueño modifica. |
| `644` | `rw-r--r--` | Archivos normales: todos leen; solo el dueño escribe. |
| `600` | `rw-------` | Secretos, como una clave SSH privada: solo el dueño. |

- **`chmod 644 archivo`** cambia los permisos; `chmod +x script.sh` añade ejecución.
- **`chown usuario:grupo archivo`** cambia el dueño.
- **`root`** es el superusuario: puede con todo. **`sudo comando`** ejecuta un comando como root.

## Ejemplo

```bash
cd /var/log                 # ruta absoluta
ls -l                       # ¿qué logs hay y de quién son?
tail -f nginx/error.log     # seguir el log de errores en directo (Ctrl+C para salir)

cd ~                        # vuelvo a mi carpeta personal
chmod 600 .ssh/id_ed25519   # la clave SSH privada solo la leo yo
chmod +x desplegar.sh       # permito ejecutar mi script
./desplegar.sh              # lo ejecuto (./ = "el de esta carpeta")
```

## Errores comunes

- **«Permission denied»** al ejecutar un script: le falta el permiso `x` (`chmod +x`), o necesitas `sudo` para esa acción.
- **`chmod 777`** «para que funcione». Da permiso de escritura a cualquiera: es un agujero de seguridad.
- **Clave SSH con permisos abiertos.** SSH se niega a usarla si otros usuarios pueden leerla («UNPROTECTED PRIVATE KEY FILE»): ponla en `600`.
- **`rm -rf` en la ruta equivocada.** No hay papelera. Revisa con `pwd` y `ls` antes.
- **Confundir rutas relativas y absolutas** en scripts: una ruta relativa depende de desde dónde se ejecute.

## En la entrevista

**«¿Qué significa `chmod 640`?»**
Dueño: lectura y escritura (6 = 4 + 2). Grupo: solo lectura (4). Resto: ningún permiso (0).

**«Un script da "Permission denied". ¿Qué revisas?»**
Que tenga permiso de ejecución (`ls -l`, `chmod +x`), que tu usuario tenga acceso a esa ruta y, si la acción lo requiere, ejecutarlo con `sudo`.

## Resumen

- Todo cuelga de **`/`**; rutas **absolutas** (empiezan por `/`) y **relativas**.
- `pwd`, `ls -l`, `cd`, `cat`, `less`, `tail -f` para moverte y leer.
- Permisos **rwx** para **dueño, grupo y resto**; en números, r=4, w=2, x=1.
- **`755`** programas, **`644`** archivos, **`600`** secretos. Nunca `777`.
- **`sudo`** ejecuta como root; úsalo solo cuando haga falta.
