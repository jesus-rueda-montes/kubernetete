---
title: Regiones y zonas
minutes: 9
---

## Qué problema resuelve

La nube no es etérea: son **centros de datos reales** repartidos por el mundo. Dónde crees tus recursos decide:

- **La latencia**: lo rápido que responde tu aplicación a tus usuarios.
- **La resiliencia**: si un incendio o un corte eléctrico en un edificio tira tu servicio o no.
- **El cumplimiento legal**: algunas leyes exigen que los datos estén en un país o región concretos.
- **El precio**: el mismo recurso no cuesta igual en todas las ubicaciones.

## Analogía

Piensa en una **cadena de supermercados**:

- Cada **ciudad** donde está la cadena es una **región**.
- En cada ciudad hay **varias tiendas** en barrios distintos: son las **zonas**. Si una tienda cierra por una avería, las otras de la ciudad siguen abiertas.
- Para un cliente es mejor la ciudad donde vive (menos latencia), y si la ciudad entera se inunda, necesitarás tiendas en **otra ciudad**.

## Concepto

### Región y zona

- Una **región** es un área geográfica independiente, por ejemplo `europe-west1` (Bélgica) o `us-central1` (Iowa).
- Una región contiene varias **zonas**: áreas de despliegue aisladas entre sí ante fallos, pero con conexiones de **alto ancho de banda y baja latencia** con las otras zonas de su región.
- El nombre de una zona es el de su región más una letra: **`europe-west1-b`** es la zona `b` de `europe-west1`.

Un fallo suele afectar a **una zona**. Es muy raro, pero posible, que afecte a una región entera.

### Alcance de los recursos

Cada recurso tiene un **alcance** que determina dónde vive y qué le afecta si algo falla. Algunos ejemplos en Google Cloud:

| Alcance | Ejemplos (Compute Engine) | Si cae una zona… |
|---|---|---|
| **Zonal** | Máquinas virtuales (instancias), discos persistentes zonales, grupos de instancias zonales | Los recursos de esa zona dejan de estar disponibles. |
| **Regional** | Subredes, IPs estáticas regionales, grupos de instancias regionales, discos regionales | Siguen funcionando con las otras zonas de la región. |
| **Global** | Redes VPC, reglas de firewall, rutas, imágenes, snapshots | No les afecta. |

Una **VPC** en Google Cloud es **global** y sus **subredes son regionales**. En AWS, en cambio, la VPC es **regional** y las subredes son **zonales**. Es una diferencia típica de entrevista (la verás en la parte de redes).

### Alta disponibilidad

La regla de oro: **no pongas todos los huevos en la misma zona**.

- **Multizona** (varias zonas de una región): protege frente a la caída de un edificio o zona. Es el mínimo para producción.
- **Multirregión**: protege frente a la caída de una región entera. Más caro y complejo (datos replicados a distancia).

La disponibilidad se mide en **«nueves»**:

| Disponibilidad | Caída máxima al año |
|---|---|
| 99 % | ~3,65 días |
| 99,9 % | ~8,8 horas |
| 99,99 % | ~53 minutos |
| 99,999 % | ~5 minutos |

Cada nueve extra suele costar bastante más en infraestructura y complejidad.

### Cómo elegir región

1. **Cerca de tus usuarios** (latencia).
2. **Requisitos legales** de dónde deben estar los datos (por ejemplo, datos de ciudadanos europeos en la UE).
3. **Servicios disponibles**: no todos los productos o tipos de máquina existen en todas las regiones.
4. **Precio**.

## Ejemplo

Una API para usuarios en España con requisito de datos en la UE:

- Región `europe-southwest1` (Madrid) o `europe-west1` (Bélgica).
- Un **grupo de instancias regional** (sus VMs se reparten entre las zonas `-a`, `-b` y `-c`) detrás de un load balancer.
- Base de datos gestionada en **alta disponibilidad regional** (una réplica en espera en otra zona).

Si cae la zona `-a`, el load balancer envía tráfico a las VMs de las otras zonas y la base de datos pasa a su réplica: el servicio sigue.

Para consultar regiones y zonas con la CLI de Google Cloud:

```bash
gcloud compute regions list                              # todas las regiones
gcloud compute zones list --filter="region:europe-west1"  # zonas de una región
gcloud config set compute/region europe-west1           # región por defecto de gcloud
```

## Errores comunes

- **Desplegar todo en una sola zona** «porque es más sencillo». Una avería de esa zona tira todo el servicio.
- **Confundir región y zona.** `europe-west1` es una región; `europe-west1-b` es una zona.
- **Elegir la región por costumbre** (la primera de la lista) en lugar de por latencia, ley y precio.
- **Olvidar que mover datos entre regiones cuesta dinero** (tráfico de salida) y añade latencia.
- **Suponer que algo multirregión es gratis.** Replicar datos entre regiones tiene coste y complejidad.

## En la entrevista

**«¿Cómo diseñarías una aplicación para que tolere la caída de una zona?»**
Desplegándola en varias zonas de la región: un grupo de instancias regional (o un clúster regional) detrás de un load balancer y una base de datos con alta disponibilidad regional. Si una zona cae, el tráfico va a las otras.

**«¿Qué diferencia hay entre un recurso zonal, uno regional y uno global?»**
Su alcance y su exposición a fallos: un recurso zonal (como una VM) vive en una zona y cae con ella; uno regional (como una subred) abarca todas las zonas de una región; uno global (como una red VPC en GCP) no depende de ninguna región concreta.

## Resumen

- **Región**: área geográfica (`europe-west1`). **Zona**: área aislada dentro de ella (`europe-west1-b`).
- Las zonas de una región están conectadas con **alta velocidad y baja latencia**.
- Recursos **zonales** (VMs), **regionales** (subredes) y **globales** (VPC en GCP).
- Producción: como mínimo **multizona**; para catástrofes regionales, **multirregión**.
- Elige región por **latencia, ley, servicios disponibles y precio**.
