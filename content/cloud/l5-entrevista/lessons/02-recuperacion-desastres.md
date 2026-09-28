---
title: Recuperación ante desastres
minutes: 13
---

## Qué problema resuelve

La alta disponibilidad protege frente a fallos **pequeños y frecuentes**: se cae un nodo o una zona y el sistema sigue. Pero hay incidentes **grandes y raros**: una región entera caída, un borrado masivo de datos, un ransomware, un error de despliegue que corrompe la base de datos.

La **recuperación ante desastres** (*disaster recovery*, DR) es el plan para **volver a funcionar** tras uno de esos incidentes. En una entrevista de diseño, casi siempre te preguntarán: «¿Y si se cae la región?».

## Analogía

Es la **rueda de repuesto** de un coche, con tres niveles de preparación:

- **Cold**: no llevas repuesto. Llamas a la grúa y esperas horas. Barato, lento.
- **Warm**: llevas una rueda de repuesto. Paras unos minutos, la cambias y sigues.
- **Hot**: neumáticos que siguen rodando pinchados. Casi no notas el problema, pero son los más caros.

## Concepto

### RTO y RPO

- **RTO** (*recovery time objective*): el **tiempo máximo** que la aplicación puede estar **caída**.
- **RPO** (*recovery point objective*): el **tiempo máximo de datos** que se pueden **perder** (por ejemplo, «como mucho los últimos 5 minutos»).
- Cuanto **más pequeños**, **más caro**. Los decide el negocio según lo que cuesta cada hora caída o cada dato perdido, no el equipo técnico solo.

### Patrones de DR

| Patrón | Cómo es | RTO / RPO | Coste |
|---|---|---|---|
| **Cold** (copias y restaurar) | Solo **copias de seguridad** en otra región; la infraestructura se crea al ocurrir el desastre (con Terraform) | Horas o días | Bajo |
| **Warm** | Una versión **reducida** del sistema ya en marcha en la otra región (datos replicados, poco cómputo) que se **escala** al activarla | Minutos u horas | Medio |
| **Hot** (activo-activo) | El sistema completo funcionando en **varias regiones** a la vez, con tráfico en todas | Casi cero | Alto |

Una misma empresa suele mezclar patrones: **hot** para la tienda, **warm** para el backoffice, **cold** para los datos históricos.

### Piezas en GCP

- **Copias de seguridad**: backups automáticos y **point-in-time recovery** de Cloud SQL; Backup and DR Service; Cloud Storage con **versionado** y buckets **dual-region o multi-region**.
- **Réplica en otra región** (Cloud SQL *cross-region read replica*): en un desastre, se **promociona** a principal (`gcloud sql instances promote-replica`).
- **Infraestructura como código**: con Terraform, recrear el entorno en otra región es cambiar una variable y aplicar. Sin IaC, un DR cold puede tardar días.
- **Balanceador global**: con backends en dos regiones, el tráfico se desvía solo a la región sana.
- **Datos globales**: servicios como **Spanner** multirregional o Firestore en ubicación multirregión replican los datos entre regiones por sí mismos.

### Lo que más se olvida

- **Probar el plan**: un DR que nunca se ha ensayado no funciona. Se hacen simulacros periódicos.
- **Las copias no son HA ni la HA son copias**: la HA replica también los errores (un `DROP TABLE`); las copias no evitan la caída.
- **Proteger las copias**: en otro proyecto, con acceso restringido y, si hace falta, bloqueo de retención, para que un atacante o un error no las borre junto con los datos.
- **Dependencias**: DNS, secretos, cuotas en la otra región, imágenes en un registro accesible.

## Ejemplo

```text
Requisitos: tienda online, RTO 1 hora, RPO 5 minutos, datos en la UE.

Diseño (warm):
- Región principal europe-west1: Cloud Run + Cloud SQL HA (con PITR).
- Región de DR europe-west4:
    · réplica de lectura de Cloud SQL (replicación asíncrona, pocos segundos de retraso)
    · el servicio de Cloud Run ya desplegado con min-instances=0
    · imágenes en un repositorio multirregión de Artifact Registry
- Balanceador global con backends en ambas regiones.
- Terraform para todo; simulacro de DR cada trimestre.

Si cae europe-west1:
1. Promocionar la réplica:  gcloud sql instances promote-replica tienda-db-dr
2. Apuntar la aplicación de DR a la nueva principal (secreto / variable).
3. El balanceador ya envía el tráfico a la región sana; Cloud Run escala solo.
```

## Errores comunes

- **Confundir HA y DR**: la HA regional no sobrevive a la caída de la región.
- **Decidir RTO/RPO sin el negocio**: cada nueve y cada minuto cuestan dinero.
- **Copias en la misma región o proyecto** que los datos: un desastre o un atacante se lleva ambos.
- **No ensayar**: el día del desastre descubres que faltaban permisos, cuotas o un secreto.
- **Elegir hot para todo**: multiplica el coste y la complejidad, sobre todo con datos que se escriben en varias regiones.

## En la entrevista

**«¿Qué diferencia hay entre RTO y RPO?»**
El RTO es cuánto tiempo puede estar caído el servicio; el RPO, cuántos datos (medidos en tiempo) se pueden perder. Un RPO de 5 minutos exige replicación o copias muy frecuentes; un RTO de 1 hora exige tener la infraestructura casi lista en otra región o poder crearla muy rápido con IaC.

**«¿Cómo harías DR para una base de datos Cloud SQL?»**
Según el RTO/RPO: como mínimo backups automáticos y PITR (cold). Para algo más exigente, una réplica de lectura en otra región que se promociona en el desastre (warm), con la aplicación ya desplegada allí y un balanceador global. Las copias, en otro proyecto protegido. Y un simulacro periódico.

## Resumen

- **HA** = fallos pequeños (zona); **DR** = fallos grandes (región, borrado, ataque).
- **RTO**: tiempo caído; **RPO**: datos perdidos. Más pequeños = más caro; los fija el negocio.
- Patrones: **cold** (copias + IaC), **warm** (réplica reducida que se escala), **hot** (activo-activo).
- GCP: PITR, **réplica entre regiones + `promote-replica`**, buckets multirregión, **balanceador global**, Terraform.
- **Ensaya** el plan y protege las copias en otro proyecto.
