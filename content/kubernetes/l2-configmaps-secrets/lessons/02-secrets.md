---
title: Secrets
minutes: 10
---

## Qué problema resuelve

Contraseñas de bases de datos, claves de API, certificados TLS… Tu aplicación los necesita, pero **no deben estar en la imagen ni en un ConfigMap** que lea cualquiera. Un **Secret** es el objeto de Kubernetes para datos sensibles: se usa igual que un ConfigMap, pero se trata aparte (permisos, montaje en memoria, opciones de cifrado).

## Analogía

Si el ConfigMap es el **tablón de anuncios** de la oficina, el Secret es la **caja fuerte**… con un matiz importante: por defecto, la caja fuerte **no tiene cerradura de verdad**. Viene preparada para que se la pongas (cifrado en reposo, permisos RBAC, gestores de secretos externos).

## Concepto

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db
type: Opaque                 # tipo por defecto: datos arbitrarios
data:
  password: czNjcjN0         # en base64 ("s3cr3t")
stringData:
  usuario: tienda            # en texto plano; Kubernetes lo codifica al guardar
```

- En **`data`** los valores van codificados en **base64**; en **`stringData`** se escriben tal cual y Kubernetes los codifica.
- Máximo **1 MiB** por Secret, en el mismo namespace que el Pod.
- Se consumen **igual que un ConfigMap**: `secretKeyRef` (una variable), `envFrom.secretRef` (todas) o un volumen `secret`. Las mismas reglas de actualización: las variables no cambian solas; los archivos montados sí.

### base64 no es cifrado

**base64 es una codificación, no un cifrado**: cualquiera la deshace con `base64 -d`. Además, **por defecto los Secrets se guardan sin cifrar en etcd**. Medidas recomendadas:

1. Activar el **cifrado en reposo** (*encryption at rest*) de los Secrets en etcd. En GKE, EKS o AKS existen opciones gestionadas.
2. **RBAC con mínimo privilegio**: quien puede leer Secrets de un namespace, o crear Pods en él, puede ver sus Secrets.
3. Considerar un **gestor de secretos externo** (Secret Manager de GCP, AWS Secrets Manager, Azure Key Vault, HashiCorp Vault), por ejemplo a través del *Secrets Store CSI Driver*.
4. **Nunca** subir a git un manifest de Secret con valores reales.

### Tipos habituales

| Tipo | Para qué |
|---|---|
| `Opaque` | Datos arbitrarios (el tipo por defecto). |
| `kubernetes.io/tls` | Certificado y clave TLS (`tls.crt`, `tls.key`); lo usan los Ingress. |
| `kubernetes.io/dockerconfigjson` | Credenciales para descargar imágenes de un registro privado (`imagePullSecrets`). |
| `kubernetes.io/basic-auth` / `ssh-auth` | Usuario y contraseña / clave SSH. |

## Ejemplo

```bash
# Crear un Secret sin escribir base64 a mano
kubectl create secret generic db --from-literal=password='s3cr3t' --from-literal=usuario=tienda

# Ver lo que hay (y comprobar que base64 no protege nada)
kubectl get secret db -o jsonpath='{.data.password}' | base64 -d   # s3cr3t
```

Usarlo en un contenedor:

```yaml
spec:
  containers:
    - name: api
      image: ghcr.io/tienda/api:2.1.0
      env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db           # Secret
              key: password      # clave
      envFrom:
        - configMapRef:
            name: api-config     # y el resto de configuración, de un ConfigMap
```

## Errores comunes

- **Creer que un Secret está cifrado** porque se ve en base64.
- **Subir Secrets a git.** Aunque los borres después, siguen en el historial. Usa un gestor de secretos o herramientas de cifrado para git.
- **Poner a mano valores en `data` sin base64** (o codificando también el salto de línea: `echo` añade `\n`; usa `echo -n`). Mejor `stringData` o `kubectl create secret`.
- **Dar permiso de lectura de Secrets** (o de crear Pods) en un namespace a quien no lo necesita.
- **Imprimir secretos en los logs** de la aplicación.

## En la entrevista

**«¿Son seguros los Secrets de Kubernetes?»**
Por defecto, no mucho: los valores solo están en base64 (codificación, no cifrado) y etcd los guarda sin cifrar. Para protegerlos hay que activar el cifrado en reposo, aplicar RBAC de mínimo privilegio y, a menudo, usar un gestor externo como Secret Manager o Vault.

**«¿Diferencia entre ConfigMap y Secret?»**
Se usan igual (variables o archivos), pero el Secret es para datos sensibles: se puede cifrar en reposo, se restringe aparte con RBAC, tiene tipos específicos (TLS, credenciales de registro) y se monta en memoria (tmpfs) en los Nodes. El ConfigMap es para configuración no confidencial.

## Resumen

- Un **Secret** guarda datos sensibles; se usa como un ConfigMap (`secretKeyRef`, `envFrom`, volumen).
- **`data`** en base64, **`stringData`** en claro; **base64 no es cifrado**.
- Por defecto los Secrets **no están cifrados en etcd**: activa el **cifrado en reposo**, aplica **RBAC** y valora un **gestor externo**.
- Tipos: **Opaque**, **tls**, **dockerconfigjson**…
- `kubectl create secret generic <nombre> --from-literal=clave=valor`.
