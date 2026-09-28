---
title: Salida a internet, balanceadores de carga y DNS
minutes: 12
---

## Qué problema resuelve

Por seguridad, las VMs de producción **no deberían tener IP pública**: así nadie de internet puede intentar conectarse a ellas directamente. Pero eso crea nuevas necesidades:

- Las VMs siguen necesitando **salir** a internet: instalar paquetes, llamar a APIs externas.
- Necesitan usar **servicios de Google** (Cloud Storage, BigQuery…) sin salir a internet.
- Los usuarios tienen que **llegar a la aplicación** por una única dirección, repartida entre varias VMs.
- Esa dirección necesita un **nombre** (`tienda.example.com`).

Para esto están **Cloud NAT**, el **acceso privado a Google**, los **balanceadores de carga** y **Cloud DNS**.

## Analogía

En el recinto de oficinas:

- **Cloud NAT** es la **centralita**: los empleados pueden llamar hacia fuera, pero nadie de fuera puede marcar su extensión directa.
- El **balanceador de carga** es la **recepción**: todos los visitantes llegan a la misma puerta y la recepcionista los reparte entre los despachos libres.
- **Cloud DNS** es la **guía telefónica**: traduce el nombre de la empresa al número de la recepción.

## Concepto

### Cloud NAT: salir sin IP pública

**Cloud NAT** permite a las VMs **sin IP externa** iniciar conexiones hacia internet. Las respuestas vuelven, pero **nadie de fuera puede iniciar una conexión** hacia las VMs.

- Es **regional** y se configura sobre un **Cloud Router** de esa región y esa red.
- No es una VM que tengas que mantener: es un servicio gestionado, sin cuello de botella único.

### Acceso privado a Google

Con **Private Google Access** activado en una subred, sus VMs sin IP externa pueden llegar a las **APIs de Google** (Cloud Storage, BigQuery, Artifact Registry…) sin salir a internet ni necesitar Cloud NAT para ello. Se activa **por subred** (`--enable-private-ip-google-access`).

### Conectar redes

- **VPC Network Peering**: conecta dos VPC (incluso de proyectos u organizaciones distintas) por IP privada. **No es transitivo**: si A está conectada con B y B con C, A **no** llega a C.
- **Shared VPC**: un **proyecto host** comparte su VPC con varios **proyectos de servicio**. El equipo de redes gestiona la red en un sitio y cada equipo crea sus VMs en su propio proyecto, usando las subredes compartidas.

### Balanceadores de carga

Cloud Load Balancing tiene dos familias:

| Tipo | Capa | Para qué |
|---|---|---|
| **Application Load Balancer** | 7 (HTTP/HTTPS) | Webs y APIs: reparte según la URL o el host, termina TLS, se integra con Cloud CDN y Cloud Armor. |
| **Network Load Balancer** | 4 (TCP/UDP/otros) | Tráfico que no es HTTP. En versión **proxy** o **passthrough** (este conserva la IP del cliente). |

Cada uno puede ser:

- **Externo** (recibe tráfico de internet) o **interno** (solo desde tu VPC).
- **Global** (backends en varias regiones, una sola IP *anycast* para todo el mundo) o **regional**.

Los backends pueden ser **grupos de instancias**, **grupos de endpoints de red** (por ejemplo, Pods de GKE) o servicios serverless. El balanceador usa **health checks** para enviar tráfico solo a los backends sanos.

Las comprobaciones de estado llegan desde rangos IP de Google (`35.191.0.0/16` y `130.211.0.0/22`): hay que **permitirlos en el firewall**, o todos los backends parecerán caídos.

### Cloud DNS

Servicio DNS gestionado. Organizas los registros en **zonas**:

- **Zona pública**: visible desde internet (`tienda.example.com → IP del balanceador`).
- **Zona privada**: solo se resuelve desde las VPC que elijas (`db.interno → 10.10.0.5`).

## Ejemplo

VMs sin IP pública que pueden salir a internet:

```bash
gcloud compute routers create router-euw1 \
  --network=vpc-pro --region=europe-west1

gcloud compute routers nats create nat-euw1 \
  --router=router-euw1 --region=europe-west1 \
  --auto-allocate-nat-external-ips --nat-all-subnet-ip-ranges

gcloud compute instances create web-1 \
  --zone=europe-west1-b --subnet=web-euw1 --no-address --tags=web
```

Arquitectura web típica:

```text
Usuario → Cloud DNS (tienda.example.com)
        → Application Load Balancer externo global (IP pública, TLS)
        → grupo de instancias gestionado en europe-west1 (VMs sin IP pública)
             ↳ salen a internet por Cloud NAT
             ↳ usan Cloud Storage con acceso privado a Google
```

## Errores comunes

- **Dar IP pública a todas las VMs** por comodidad: más superficie de ataque. Usa Cloud NAT para salir e IAP para entrar por SSH.
- **Crear Cloud NAT en una región** y esperar que funcione en otra: es regional.
- **No permitir los rangos de los health checks** en el firewall: el balanceador marca todos los backends como no sanos.
- **Contar con que el peering es transitivo**: A–B y B–C no conecta A con C.
- **Usar un Network Load Balancer para una web** que necesita reglas por URL o TLS gestionado: eso es un Application Load Balancer.

## En la entrevista

**«Tus VMs no tienen IP pública. ¿Cómo instalan paquetes de internet?»**
Con Cloud NAT, configurado en un Cloud Router de la región. Permite conexiones salientes pero no entrantes. Para llegar a las APIs de Google sin salir a internet, activo Private Google Access en la subred.

**«¿Qué balanceador usarías para una web con usuarios en todo el mundo?»**
Un Application Load Balancer externo global: una IP anycast, TLS gestionado, enrutado por URL y backends en varias regiones, con health checks. Se puede añadir Cloud CDN y Cloud Armor.

## Resumen

- **Cloud NAT** (regional, sobre un Cloud Router): las VMs sin IP pública salen a internet; nadie entra.
- **Private Google Access** (por subred): llegar a las APIs de Google sin IP pública.
- **Peering** (no transitivo) y **Shared VPC** (proyecto host + proyectos de servicio).
- Balanceadores: **Application** (capa 7, HTTP/S) y **Network** (capa 4); externos o internos; globales o regionales.
- **Cloud DNS**: zonas públicas y privadas.
