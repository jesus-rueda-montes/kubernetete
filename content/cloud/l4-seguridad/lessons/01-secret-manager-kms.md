---
title: Secret Manager y Cloud KMS
minutes: 12
---

## Qué problema resuelve

Las aplicaciones necesitan contraseñas, tokens y claves de API. Si van en el código, en una variable de entorno escrita en el manifiesto o en un archivo del servidor:

- Cualquiera con acceso al repositorio o al servidor las ve.
- No sabes **quién** las ha leído.
- Cambiarlas (rotarlas) implica tocar muchos sitios.

Y algunos datos, por normativa, deben cifrarse con **claves que controla la empresa**, no solo con las de Google.

- **Secret Manager** guarda secretos con **control de acceso**, **versiones** y **auditoría**.
- **Cloud KMS** gestiona **claves de cifrado**: crearlas, rotarlas, controlar quién las usa y auditar cada uso.

## Analogía

- **Secret Manager** es la **caja de seguridad del banco**: cada documento está en su caja, solo entran las personas autorizadas y queda registrado cada acceso.
- **Cloud KMS** es el **cerrajero de confianza** que guarda las **llaves maestras**: no guarda tus documentos, sino las llaves con las que se cierran las cajas.

## Concepto

### Secret Manager

- Un **secreto** tiene **versiones**: cada valor nuevo es una versión (1, 2, 3…). Puedes leer una concreta o **`latest`**, y **desactivar** o **destruir** versiones antiguas.
- Acceso con IAM **por secreto**: el rol **`roles/secretmanager.secretAccessor`** permite leer el valor. Dáselo solo a la cuenta de servicio de la aplicación que lo necesita.
- **Replicación** automática (Google elige las regiones) o gestionada por ti (eliges las regiones).
- Cada acceso queda en los **audit logs** (activando Data Access para Secret Manager).
- **Rotación**: Secret Manager **no cambia el valor solo**; en la fecha de rotación envía un aviso a **Pub/Sub**, y tu proceso (por ejemplo, una función) genera el valor nuevo y añade la versión.

Cómo lo consumen las aplicaciones:

- **Cloud Run**: `--set-secrets=DB_PASSWORD=db-password:latest` lo expone como variable de entorno (o como archivo).
- **GKE**: con el **Secret Manager add-on** o el CSI driver, montado como volumen; o leyéndolo desde el código con Workload Identity Federation.
- Desde código, con las librerías de cliente.

### Cifrado en Google Cloud

- **Todo se cifra en reposo por defecto**, con claves gestionadas por Google. No tienes que hacer nada.
- Por dentro se usa **cifrado de sobre** (*envelope encryption*): los datos se cifran con una **DEK** (clave de datos) y esa DEK se cifra con una **KEK** (clave de claves).
- **CMEK** (*customer-managed encryption keys*): la KEK es **una clave tuya en Cloud KMS**. Tú decides la rotación, quién puede usarla, y puedes **desactivarla** para dejar los datos ilegibles. Lo soportan Cloud Storage, BigQuery, Cloud SQL, Persistent Disk, GKE…

### Cloud KMS

- Jerarquía: **llavero** (*key ring*, en una ubicación) → **clave** → **versiones** de la clave.
- Los llaveros y las claves **no se pueden borrar**; lo que se destruye son las **versiones**, y con un periodo de espera (por defecto, 30 días) para evitar desastres.
- **Rotación automática** con `--rotation-period`: las versiones nuevas cifran lo nuevo; las antiguas siguen sirviendo para descifrar lo anterior.
- **Nivel de protección**: `software` (por defecto), **HSM** (hardware dedicado) o claves **externas** (EKM, fuera de Google).
- Permisos separados para **administrar** claves y para **usarlas** (`roles/cloudkms.cryptoKeyEncrypterDecrypter`).

## Ejemplo

```bash
# Crear el secreto con su primer valor (leído de la entrada estándar)
printf 'S3cr3t0!' | gcloud secrets create db-password \
  --replication-policy=automatic --data-file=-

# Solo la cuenta de servicio de la API puede leerlo
gcloud secrets add-iam-policy-binding db-password \
  --member=serviceAccount:api@tienda.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor

# Cloud Run lo recibe como variable de entorno
gcloud run deploy api --image=europe-west1-docker.pkg.dev/tienda/apps/api:2.0.0 \
  --region=europe-west1 --set-secrets=DB_PASSWORD=db-password:latest

# Clave propia para CMEK, con rotación cada 90 días
gcloud kms keyrings create tienda --location=europe-west1
gcloud kms keys create datos --keyring=tienda --location=europe-west1 \
  --purpose=encryption --rotation-period=90d --next-rotation-time=2026-12-01T00:00:00Z
```

## Errores comunes

- **Dar `secretAccessor` a nivel de proyecto**: cualquier aplicación podría leer cualquier secreto. Dalo por secreto.
- **Pensar que Secret Manager rota solo**: solo avisa; la rotación la implementas tú.
- **Valores sensibles en variables de entorno escritas en el manifiesto**: acaban en git. Usa referencias a Secret Manager.
- **Creer que sin CMEK los datos no están cifrados**: siempre lo están; CMEK añade control, no cifrado.
- **Desactivar o destruir una versión de clave de KMS** que aún cifra datos: esos datos quedan ilegibles.

## En la entrevista

**«¿Cómo gestionarías los secretos de una aplicación en Cloud Run?»**
En Secret Manager, con un secreto por credencial y versiones. La cuenta de servicio de Cloud Run tiene `secretAccessor` solo sobre sus secretos, y los recibe con `--set-secrets` como variable o archivo. Para rotar, avisos por Pub/Sub y un proceso que añade la versión nueva.

**«¿Qué es CMEK y cuándo lo usarías?»**
Claves de cifrado gestionadas por el cliente en Cloud KMS, usadas como KEK en el cifrado de sobre de servicios como Cloud Storage o BigQuery. Lo uso cuando la normativa exige controlar las claves: su rotación, quién puede usarlas y poder revocarlas. Los datos ya se cifran por defecto con claves de Google.

## Resumen

- **Secret Manager**: secretos con **versiones**, IAM **por secreto** (`secretAccessor`), auditoría y **avisos de rotación** por Pub/Sub.
- Consumo: Cloud Run `--set-secrets`, GKE con el add-on o CSI, o librerías de cliente.
- Todo está **cifrado en reposo por defecto**; **CMEK** = tu clave de **Cloud KMS** como KEK.
- KMS: **llavero → clave → versiones**; no se borran llaveros ni claves; **rotación automática**; software, **HSM** o externa.
