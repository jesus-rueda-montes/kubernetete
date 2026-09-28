---
title: ConfigMaps
minutes: 10
---

## Qué problema resuelve

La misma imagen de tu aplicación debe funcionar en desarrollo, en pruebas y en producción. Lo que cambia entre ellos es la **configuración**: la URL de la base de datos, el nivel de logs, un archivo de ajustes… Si metes esa configuración **dentro de la imagen**, necesitarías una imagen distinta por entorno.

Un **ConfigMap** guarda configuración **no confidencial** como datos del clúster, separada de la imagen, y se la entrega a los Pods.

## Analogía

La imagen es un **electrodoméstico** que sale igual de fábrica; el ConfigMap es el **panel de ajustes** que configuras en cada casa. No hace falta fabricar una lavadora distinta para cada familia.

## Concepto

Un ConfigMap es un objeto con pares **clave/valor** en `data`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: web-config
data:
  LOG_LEVEL: "info"          # valores siempre como texto
  nginx.conf: |              # un valor puede ser un archivo entero
    server {
      listen 80;
    }
```

Reglas:

- **Máximo 1 MiB** de datos. No es para archivos grandes.
- Debe estar en el **mismo namespace** que el Pod que lo usa.
- **No es secreto**: cualquiera con permiso de lectura lo ve. Para credenciales, usa Secrets.

### Tres formas de usarlo en un Pod

| Forma | Cómo | ¿Se actualiza al cambiar el ConfigMap? |
|---|---|---|
| **Una variable** | `env[].valueFrom.configMapKeyRef` | **No**: hay que reiniciar el Pod |
| **Todas las claves como variables** | `envFrom[].configMapRef` | **No** |
| **Como archivos** | Un volumen `configMap` montado con `volumeMounts` | **Sí**, al cabo de un rato (salvo si se monta con `subPath`) |

Como variables de entorno, el valor se lee **al arrancar el contenedor**. Tras cambiar un ConfigMap usado así, se suele hacer `kubectl rollout restart deployment/<nombre>`.

Si una configuración no debe cambiar nunca, puedes marcarla con `immutable: true`: se protege contra cambios accidentales y el clúster no tiene que vigilarla.

## Ejemplo

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web
spec:
  containers:
    - name: web
      image: nginx:1.27
      env:
        - name: LOG_LEVEL              # variable del contenedor...
          valueFrom:
            configMapKeyRef:
              name: web-config         # ...sacada del ConfigMap web-config
              key: LOG_LEVEL           # ...clave LOG_LEVEL
      volumeMounts:
        - name: config
          mountPath: /etc/nginx/conf.d # cada clave será un archivo aquí
          readOnly: true
  volumes:
    - name: config
      configMap:
        name: web-config
        items:                         # opcional: solo algunas claves
          - key: nginx.conf
            path: default.conf         # nombre del archivo dentro de mountPath
```

Crear un ConfigMap sin YAML:

```bash
kubectl create configmap web-config --from-literal=LOG_LEVEL=info --from-file=nginx.conf
kubectl get configmap web-config -o yaml     # ver su contenido (alias: cm)
```

## Errores comunes

- **Guardar contraseñas en un ConfigMap.** Van en Secrets.
- **Cambiar el ConfigMap y esperar que la variable de entorno cambie sola.** Hay que reiniciar los Pods.
- **Valores numéricos o booleanos sin comillas** en `data`: los valores de un ConfigMap deben ser texto; `LOG_LEVEL: 3` sin comillas es un error de validación.
- **ConfigMap en otro namespace** que el Pod: el Pod no arranca (`CreateContainerConfigError`).
- **Montar el volumen en una carpeta con otros archivos**: el montaje **oculta** el contenido original de esa carpeta.

## En la entrevista

**«¿Cómo pasas configuración a una aplicación en Kubernetes?»**
Con ConfigMaps (y Secrets si es sensible), como variables de entorno o como archivos montados. Así la misma imagen sirve para todos los entornos.

**«Has cambiado un ConfigMap y la aplicación no se entera. ¿Por qué?»**
Si se consume como variables de entorno, se leen solo al arrancar: hay que reiniciar los Pods (`kubectl rollout restart`). Si se monta como volumen, los archivos se actualizan al cabo de un tiempo, pero la aplicación tiene que volver a leerlos.

## Resumen

- Un **ConfigMap** guarda configuración **no confidencial** fuera de la imagen (máx. **1 MiB**, mismo namespace).
- Se usa como **variable** (`configMapKeyRef`), como **todas las claves** (`envFrom`) o como **archivos** (volumen).
- Las **variables no se actualizan**; los **archivos montados sí** (con retraso, y no con `subPath`).
- Tras cambiarlo: **`kubectl rollout restart`**.
- `kubectl create configmap --from-literal / --from-file`.
