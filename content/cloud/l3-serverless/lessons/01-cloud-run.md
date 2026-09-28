---
title: Cloud Run
minutes: 12
---

## Qué problema resuelve

Tienes una API empaquetada en un contenedor. Para ponerla en producción con VMs o con Kubernetes tienes que gestionar máquinas o un clúster, configurar el autoescalado, el balanceador, los certificados TLS… y pagar por las máquinas aunque nadie use la API a las 4 de la mañana.

**Cloud Run** ejecuta **contenedores sin servidores que gestionar** (*serverless*): le das una imagen y te devuelve una URL HTTPS. Escala solo según las peticiones, **hasta cero** cuando no hay tráfico, y pagas por lo que usas.

## Analogía

Es como un **servicio de catering** en vez de montar tu propio restaurante: tú das la receta (el contenedor) y ellos ponen la cocina, los cocineros que hagan falta según los invitados, y cuando no hay evento, no pagas cocineros.

## Concepto

### El contrato del contenedor

Cloud Run puede ejecutar casi cualquier contenedor, con estas reglas:

- Escucha peticiones HTTP en el puerto de la variable **`$PORT`** (por defecto, **8080**).
- Es **sin estado** (*stateless*): cualquier instancia puede atender cualquier petición y puede desaparecer en cualquier momento. Los datos se guardan fuera (Cloud SQL, Cloud Storage, Firestore).
- El sistema de archivos es **en memoria**: lo que escribas en disco ocupa RAM y se pierde.

### Servicios y revisiones

- Un **servicio** es tu aplicación, con una URL estable (`https://api-xxxx.a.run.app`).
- Cada despliegue crea una **revisión** inmutable (imagen + configuración).
- Puedes **repartir el tráfico** entre revisiones: 90 % a la estable y 10 % a la nueva (*canary*), o volver a la anterior en segundos.

### Escalado y concurrencia

- Cloud Run crea **instancias** del contenedor según las peticiones, y las quita cuando no hacen falta, **hasta cero**.
- Cada instancia atiende **varias peticiones a la vez**: es la **concurrencia**. Al crear un servicio con `gcloud` o Terraform, el máximo por defecto es **80 por cada vCPU**. Con concurrencia 1, cada petición necesita su propia instancia.
- **`--max-instances`** limita cuántas instancias puede haber: protege tu presupuesto y tu base de datos.
- **`--min-instances`** mantiene instancias siempre listas.

### Arranque en frío

Si no hay ninguna instancia y llega una petición, Cloud Run tiene que arrancar una: es el **arranque en frío** (*cold start*), y esa petición tarda más. Para reducirlo:

- **`--min-instances=1`** (o más): siempre hay alguna lista. A cambio, pagas por ella aunque no haya tráfico.
- Imágenes pequeñas y aplicaciones que arrancan rápido.

### Límites de tiempo

Cada petición tiene un **timeout** de **5 minutos** por defecto, ampliable hasta **60 minutos**. Para trabajos largos que no responden a peticiones, están los **jobs**.

### Seguridad

- **`--allow-unauthenticated`**: cualquiera puede llamar al servicio (una web pública).
- Sin él, hay que llamarlo con una identidad que tenga el rol **Cloud Run Invoker** (`roles/run.invoker`): ideal entre microservicios.
- **`--ingress=internal`** limita el tráfico a tu red interna.
- Cada servicio se ejecuta con una **cuenta de servicio**: dale una propia con solo los permisos que necesita.

### Cloud Run jobs

Un **job** ejecuta un contenedor **hasta que termina**, sin atender peticiones: migraciones, procesos por lotes, informes nocturnos. Puede lanzar varias **tareas en paralelo** y reintentar las que fallan. Se ejecuta a mano, desde un pipeline o con **Cloud Scheduler**.

Existen también los **worker pools**, para cargas continuas que no reciben peticiones HTTP (por ejemplo, consumir de una cola).

## Ejemplo

```bash
# Desplegar una API pública
gcloud run deploy api-pedidos \
  --image=europe-west1-docker.pkg.dev/tienda/apps/api-pedidos:1.4.0 \
  --region=europe-west1 \
  --allow-unauthenticated \
  --service-account=api-pedidos@tienda.iam.gserviceaccount.com \
  --min-instances=1 --max-instances=20

# Desplegar la versión nueva sin tráfico y probarla con su propia URL
gcloud run deploy api-pedidos --image=.../api-pedidos:1.5.0 \
  --region=europe-west1 --no-traffic --tag=candidata

# Mandarle el 10 % del tráfico (canary)
gcloud run services update-traffic api-pedidos --region=europe-west1 \
  --to-tags=candidata=10

# Job para la migración de base de datos
gcloud run jobs create migrar-db --image=.../migraciones:1.5.0 \
  --region=europe-west1 --max-retries=1
gcloud run jobs execute migrar-db --region=europe-west1 --wait
```

## Errores comunes

- **Guardar estado en la instancia** (sesiones en memoria, archivos en disco): se pierde cuando la instancia desaparece. Usa servicios externos.
- **La app escucha en un puerto fijo** que no coincide con `$PORT`: el despliegue falla porque el contenedor no responde.
- **No poner `--max-instances`**: un pico de tráfico puede crear cientos de instancias y saturar la base de datos.
- **Hacer trabajo en segundo plano después de responder** con la facturación por petición: la CPU se limita fuera de las peticiones.
- **Usar un servicio para un proceso de 2 horas**: supera el timeout. Usa un job.
- **Dejar `--allow-unauthenticated` en servicios internos**.

## En la entrevista

**«¿Qué es Cloud Run y cuándo lo usarías?»**
Un servicio serverless que ejecuta contenedores sin estado: me da una URL HTTPS, escala según las peticiones hasta cero y pago por uso. Lo uso para APIs, webs y microservicios que responden a HTTP o a eventos, cuando no necesito controlar el clúster. Para tareas que terminan, uso Cloud Run jobs.

**«¿Cómo evitas los arranques en frío?»**
Con `--min-instances` para tener siempre instancias listas (pagando por ellas), imágenes pequeñas y aplicaciones que arrancan rápido. Una concurrencia alta también ayuda, porque cada instancia atiende más peticiones.

## Resumen

- **Cloud Run**: contenedores **sin estado** que escuchan en **`$PORT`**, con URL HTTPS, escalado automático **hasta cero** y pago por uso.
- Cada despliegue = **revisión**; el tráfico se reparte entre revisiones (**canary**, rollback).
- **Concurrencia**: varias peticiones por instancia. **`--min-instances`** evita arranques en frío; **`--max-instances`** limita el coste.
- Timeout de **5 min** por defecto (máx. **60 min**); para tareas largas, **jobs**.
- Acceso público con `--allow-unauthenticated`, o privado con el rol **Cloud Run Invoker**.
