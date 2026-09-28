---
title: Volúmenes
minutes: 9
---

## Qué problema resuelve

El sistema de archivos de un contenedor es **efímero**: si el contenedor se reinicia, todo lo que escribió desaparece. Y dos contenedores del mismo Pod no ven los archivos del otro. Pero muchas veces necesitas:

- **compartir archivos** entre contenedores de un Pod (una app que escribe logs y un sidecar que los envía),
- **montar configuración** (ConfigMaps, Secrets) como archivos,
- **conservar datos** más allá de la vida del Pod (una base de datos).

Los **volúmenes** resuelven esto.

## Analogía

Un volumen es como un **disco USB que conectas** a los contenedores de un Pod. Algunos USB se borran al apagar el ordenador (volúmenes efímeros, como `emptyDir`); otros son **discos externos** que puedes desconectar y conectar en otro ordenador sin perder nada (volúmenes persistentes).

## Concepto

Un volumen se usa en dos pasos:

1. Se **declara en el Pod**: `spec.volumes` (nombre y tipo).
2. Se **monta en cada contenedor** que lo necesite: `volumeMounts` (nombre y ruta).

```yaml
spec:
  volumes:
    - name: datos              # 1) declarar
      emptyDir: {}
  containers:
    - name: app
      volumeMounts:
        - name: datos          # 2) montar
          mountPath: /datos
```

### Tipos más usados

| Tipo | Vida | Para qué |
|---|---|---|
| **`emptyDir`** | La del **Pod**: se crea vacío al programarse el Pod y se borra cuando el Pod desaparece. Sobrevive a que un **contenedor** se reinicie. | Espacio temporal, compartir archivos entre contenedores del Pod. Con `medium: Memory`, en RAM. |
| **`configMap`** / **`secret`** | La del objeto | Montar configuración como archivos (módulo de nivel 2). |
| **`persistentVolumeClaim`** | **Independiente del Pod** | Datos persistentes: bases de datos, archivos subidos (siguiente lección). |
| **`hostPath`** | La del Node | Un directorio del propio Node. **Peligroso**: da acceso al sistema de archivos del host y ata el Pod a un Node concreto. Solo para casos de sistema (agentes de logs, monitorización). |

## Ejemplo

Un Pod con una app que escribe logs y un sidecar que los lee, compartiendo un `emptyDir`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-con-sidecar
spec:
  volumes:
    - name: logs
      emptyDir: {}
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "while true; do date >> /var/log/app/app.log; sleep 5; done"]
      volumeMounts:
        - name: logs
          mountPath: /var/log/app      # la app escribe aquí
    - name: envia-logs
      image: busybox:1.36
      command: ["sh", "-c", "tail -F /logs/app.log"]
      volumeMounts:
        - name: logs
          mountPath: /logs             # el sidecar lee lo mismo en otra ruta
          readOnly: true
```

```bash
kubectl logs app-con-sidecar -c envia-logs   # -c elige el contenedor
```

## Errores comunes

- **Guardar datos importantes en `emptyDir`**: se pierden al borrar o reprogramar el Pod.
- **Declarar el volumen y olvidar el `volumeMounts`** (o al revés, con nombres que no coinciden).
- **Usar `hostPath` para datos de aplicación**: el Pod depende de un Node concreto y abre un riesgo de seguridad.
- **Montar sobre una carpeta que ya tiene contenido** en la imagen: el montaje lo oculta.

## En la entrevista

**«¿Qué pasa con los datos de un `emptyDir` si el contenedor se reinicia? ¿Y si se borra el Pod?»**
Si el contenedor se reinicia, los datos se conservan: el `emptyDir` vive lo que vive el Pod. Si el Pod se borra (o se reprograma en otro Node), se pierden.

**«¿Por qué evitar `hostPath`?»**
Porque expone el sistema de archivos del Node al contenedor (riesgo de escalada) y ata el Pod a un Node concreto. Para datos persistentes se usan PersistentVolumeClaims.

## Resumen

- Un volumen se **declara** en `spec.volumes` y se **monta** en `volumeMounts` de cada contenedor.
- **`emptyDir`**: vive con el Pod; sirve para temporales y compartir entre contenedores.
- **`configMap`/`secret`**: configuración como archivos.
- **`persistentVolumeClaim`**: datos que sobreviven al Pod.
- **`hostPath`**: solo para casos de sistema; riesgo de seguridad.
