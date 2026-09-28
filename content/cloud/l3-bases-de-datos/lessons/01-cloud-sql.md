---
title: Cloud SQL
minutes: 12
---

## Qué problema resuelve

Montar tú mismo PostgreSQL o MySQL en una VM significa encargarte de todo: instalarlo, aplicar parches, programar copias de seguridad, configurar la replicación y recuperar el servicio a las 3 de la mañana cuando falla el disco.

**Cloud SQL** es una base de datos relacional **gestionada**: tú eliges el motor, el tamaño y las opciones; Google se encarga de parches, copias, replicación y failover.

## Analogía

Es como **alquilar un coche con mantenimiento incluido** (*renting*): tú decides el modelo y lo conduces, pero la empresa se ocupa de las revisiones, los neumáticos y te da otro coche si el tuyo se avería.

## Concepto

### Motores

Cloud SQL ofrece **MySQL**, **PostgreSQL** y **SQL Server**. Tus aplicaciones se conectan igual que a una base de datos normal: no hay que cambiar el código.

Hay dos ediciones: **Enterprise** y **Enterprise Plus**, que añade más rendimiento, más disponibilidad y ventanas de mantenimiento más cortas.

### Alta disponibilidad (HA)

Por defecto una instancia es **zonal**: vive en una zona y, si esa zona cae, la base de datos no está disponible.

Con **`--availability-type=regional`** la instancia tiene:

- Una instancia **primaria** en una zona y otra **standby** en otra zona de la misma región.
- **Replicación síncrona**: cada escritura se guarda en las dos zonas antes de confirmarse. No se pierden datos confirmados.
- **Failover automático**: si la primaria o su zona fallan, la standby pasa a ser la primaria. Las conexiones abiertas se cortan, pero la aplicación se reconecta a la **misma IP**: no hay que cambiar su configuración.

Ojo:

- La standby **no sirve lecturas**: solo está esperando.
- Una instancia HA **cuesta el doble** que una zonal.

### Réplicas de lectura

Una **réplica de lectura** es una copia que recibe los cambios de la primaria de forma **asíncrona**. Sirve para **repartir las lecturas** (informes, consultas pesadas) y quitar carga a la primaria.

| | Standby de HA | Réplica de lectura |
|---|---|---|
| Para qué | Disponibilidad (failover) | Escalar lecturas |
| Replicación | Síncrona | Asíncrona (puede ir algo por detrás) |
| ¿Sirve consultas? | No | Sí, solo lectura |
| ¿Otra región? | No, misma región | Sí, puede estar en otra región |

Una réplica en otra región sirve también como plan de recuperación ante desastres: se puede **promocionar** a instancia independiente.

### Copias de seguridad

- **Copias automáticas diarias**, activadas por defecto.
- **Recuperación a un momento concreto** (*point-in-time recovery*): vuelves a cómo estaba la base de datos, por ejemplo, justo antes del `DELETE` sin `WHERE`. Se basa en los logs de transacciones.
- **Protección contra borrado** (`--deletion-protection`), para no eliminar la instancia por error.

La HA **no sustituye a las copias**: si borras una tabla, el borrado se replica a la standby al instante.

### Conectarse

- **IP privada** (recomendada): la instancia tiene una IP dentro de tu VPC. Tus VMs y GKE se conectan sin salir a internet.
- **IP pública**: solo si hace falta, y nunca abierta a todo internet.
- **Cloud SQL Auth Proxy** o los **conectores de lenguaje**: cifran la conexión y autorizan con **IAM**, sin gestionar certificados ni listas de IPs. Es la forma recomendada desde GKE o Cloud Run.

## Ejemplo

PostgreSQL de producción, con alta disponibilidad y protección contra borrado:

```bash
gcloud sql instances create pedidos-pro \
  --database-version=POSTGRES_16 \
  --edition=enterprise --cpu=2 --memory=8GiB \
  --region=europe-west1 \
  --availability-type=regional \
  --enable-point-in-time-recovery \
  --deletion-protection

# Réplica de lectura para los informes
gcloud sql instances create pedidos-informes \
  --master-instance-name=pedidos-pro --region=europe-west1

# Probar el failover (en una ventana acordada)
gcloud sql instances failover pedidos-pro
```

## Errores comunes

- **Instancia zonal en producción**: una caída de zona para tu servicio.
- **Pensar que la HA protege de errores humanos**: un `DROP TABLE` se replica. Para eso están las copias y el point-in-time recovery.
- **Mandar las lecturas a la standby**: no admite consultas. Usa réplicas de lectura.
- **IP pública abierta a `0.0.0.0/0`**: usa IP privada o el Auth Proxy.
- **Guardar la contraseña de la base de datos en el código**: usa autenticación IAM o Secret Manager.

## En la entrevista

**«¿Cómo das alta disponibilidad a una base de datos en Cloud SQL?»**
Con una instancia regional: primaria y standby en dos zonas, replicación síncrona y failover automático. Además, copias automáticas y point-in-time recovery para errores humanos. Si hace falta escalar lecturas o tener recuperación en otra región, añado réplicas de lectura.

**«¿Qué diferencia hay entre la standby y una réplica de lectura?»**
La standby es para disponibilidad: replicación síncrona, en la misma región y sin servir consultas. La réplica de lectura es para rendimiento: asíncrona, sirve lecturas y puede estar en otra región.

## Resumen

- **Cloud SQL**: MySQL, PostgreSQL y SQL Server gestionados.
- **HA** (`--availability-type=regional`): primaria + standby en otra zona, replicación **síncrona**, **failover automático**; cuesta el doble.
- **Réplicas de lectura**: asíncronas, para escalar lecturas o para otra región.
- **Copias automáticas**, **point-in-time recovery** y **protección contra borrado**.
- Conexión por **IP privada** y **Cloud SQL Auth Proxy** con IAM.
