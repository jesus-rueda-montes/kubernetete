---
title: Cloud Logging y Cloud Monitoring
minutes: 12
---

## Qué problema resuelve

Tu aplicación está en producción y un cliente dice que «va lenta». Sin observabilidad no sabes si es un problema de la base de datos, de un Pod, de la red o del propio cliente. Y no quieres enterarte de las caídas por los usuarios.

La **observabilidad** es poder responder **qué está pasando** a partir de lo que el sistema emite:

- **Logs**: eventos concretos («error al conectar con la base de datos a las 10:31»).
- **Métricas**: números a lo largo del tiempo (uso de CPU, peticiones por segundo, latencia).
- **Trazas**: el recorrido de una petición por varios servicios, con cuánto tardó cada uno.

En Google Cloud, el conjunto se llama **Google Cloud Observability**: Cloud Logging, Cloud Monitoring, Cloud Trace y Error Reporting.

## Analogía

Es la **caja negra** y el **cuadro de mandos** de un avión:

- Los **logs** son la caja negra: todo lo que pasó, con hora.
- Las **métricas** son los relojes del cuadro de mandos: velocidad, altitud, combustible.
- Las **alertas** son los pitidos que avisan antes de que sea tarde.

## Concepto

### Cloud Logging

Recoge automáticamente los logs de muchos servicios (Cloud Run, GKE, Cloud SQL, balanceadores…). En VMs, se instala el **Ops Agent** para enviar logs y métricas del sistema.

Los logs se guardan en **buckets de logs**:

| Bucket | Qué guarda | Retención |
|---|---|---|
| `_Required` | Audit logs obligatorios (actividad de administración…) | **400 días**, no se puede cambiar |
| `_Default` | El resto | **30 días** por defecto (configurable) |

Los **sinks** (enrutador de logs) envían copias de los logs que cumplan un filtro a otros destinos:

- **Cloud Storage**: archivo barato a largo plazo.
- **BigQuery**: analizar logs con SQL.
- **Pub/Sub**: procesarlos o enviarlos a otra herramienta.
- Otro **bucket de logs** (por ejemplo, uno central de la organización).

Los logs se consultan con el **Logs Explorer** o con `gcloud logging read "FILTRO"`, por ejemplo `severity>=ERROR`.

### Audit logs

**Cloud Audit Logs** responde a «**quién hizo qué, dónde y cuándo**»:

- **Admin Activity**: cambios de configuración (crear una VM, cambiar IAM). **Siempre activos**.
- **Data Access**: quién leyó o escribió datos. **Desactivados por defecto** (salvo en BigQuery), porque generan mucho volumen; se activan donde haga falta.
- **System Event** y **Policy Denied**: acciones del sistema y accesos denegados por políticas.

### Cloud Monitoring

- **Métricas** automáticas de los servicios de Google Cloud, métricas del Ops Agent, métricas personalizadas y **métricas basadas en logs** (por ejemplo, contar las líneas con «payment failed»).
- **Dashboards** para visualizarlas.
- **Uptime checks**: comprueban desde varias regiones del mundo que una URL responde.
- **Políticas de alerta**: condición sobre una métrica + **canales de notificación** (email, SMS, Slack, PagerDuty, Pub/Sub…).
- En GKE, **Managed Service for Prometheus** recoge métricas en formato Prometheus sin gestionar servidores.

## Ejemplo

```bash
# Errores de Cloud Run de la última hora
gcloud logging read 'resource.type="cloud_run_revision" AND severity>=ERROR' \
  --freshness=1h --limit=20

# Guardar los audit logs en un bucket de Cloud Storage durante años
gcloud logging sinks create auditoria-gcs \
  storage.googleapis.com/tienda-auditoria \
  --log-filter='logName:"cloudaudit.googleapis.com"'
```

Una alerta típica: «si la latencia p95 de la API supera 500 ms durante 5 minutos, avisar al canal de guardia».

## Errores comunes

- **Esperar los logs de una VM sin instalar el Ops Agent**: solo llegan los de la plataforma, no los de tu aplicación ni los del sistema operativo.
- **Guardar todos los logs para siempre** en Cloud Logging: es caro. Usa sinks a Cloud Storage para el archivo a largo plazo.
- **Activar Data Access en todo**: el volumen (y la factura) se dispara. Actívalo donde haga falta.
- **Alertas que saltan por todo** (CPU > 80 %): el equipo acaba ignorándolas. Alerta sobre síntomas que afectan al usuario.
- **Crear un sink y no dar permisos a su *writer identity***: el sink usa una cuenta de servicio propia que necesita permiso para escribir en el destino (por ejemplo, en el bucket).
- **Logs sin estructura**: escribe logs en **JSON** para poder filtrar por campos.

## En la entrevista

**«¿Cómo sabrías quién borró una VM de producción?»**
En Cloud Audit Logs: los Admin Activity audit logs están siempre activos y registran quién, qué, cuándo y desde dónde. Los consulto en Logs Explorer filtrando por el método de borrado y el recurso. Para conservarlos más tiempo que la retención por defecto, un sink a Cloud Storage o BigQuery.

**«¿Qué incluye Cloud Monitoring?»**
Métricas de los servicios, del Ops Agent, personalizadas y basadas en logs; dashboards; uptime checks; y políticas de alerta con canales de notificación. En GKE, Managed Service for Prometheus.

## Resumen

- **Logs**, **métricas** y **trazas**: los tres pilares.
- **Cloud Logging**: buckets **`_Required`** (400 días, fijo) y **`_Default`** (30 días); **sinks** a Storage, BigQuery, Pub/Sub.
- **Audit logs**: Admin Activity siempre; Data Access desactivado por defecto (salvo BigQuery).
- **Cloud Monitoring**: métricas, dashboards, **uptime checks** y **alertas**.
- **Ops Agent** en VMs; **Managed Service for Prometheus** en GKE.
