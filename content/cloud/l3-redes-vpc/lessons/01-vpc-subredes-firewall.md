---
title: VPC, subredes y reglas de firewall
minutes: 12
---

## Qué problema resuelve

Tus VMs, tus clústeres de GKE y tus bases de datos necesitan **hablar entre ellas** con IPs privadas, y tú necesitas **decidir quién puede llegar a qué**: la web abierta a internet, la base de datos solo accesible desde la web, SSH solo desde tu oficina.

Una **VPC** (*Virtual Private Cloud*) es tu red privada dentro de Google Cloud. Las **subredes** reparten sus direcciones IP por regiones, y las **reglas de firewall** deciden qué tráfico entra y sale.

## Analogía

Una VPC es como un **recinto de oficinas** privado:

- La **VPC** es el recinto entero, con su valla.
- Las **subredes** son los **edificios**, cada uno en una ciudad (región), con su rango de números de despacho (IPs).
- Las **reglas de firewall** son los **controles de acceso**: quién puede entrar en qué edificio y por qué puerta.

## Concepto

### VPC global, subredes regionales

En GCP, una **VPC es un recurso global**: una sola red puede tener subredes en `europe-west1`, `us-central1` y `asia-east1`, y sus VMs se comunican por IP privada **sin configurar nada más**. En AWS y Azure, en cambio, la VPC o VNet es regional.

Cada **subred es regional** y tiene un rango IP en notación CIDR (por ejemplo, `10.10.0.0/24`). Las VMs de cualquier zona de esa región pueden usar la subred.

- En cada subred, Google **reserva 4 direcciones** del rango principal: las dos primeras y las dos últimas.
- Una subred puede tener **rangos secundarios**, que usa por ejemplo GKE para las IPs de los Pods y los Services.

### Modo auto frente a modo custom

| Modo | Qué hace | Cuándo |
|---|---|---|
| **auto** | Crea una subred en cada región con rangos fijos dentro de `10.128.0.0/9`. | Pruebas. |
| **custom** | Tú creas las subredes que quieras con los rangos que elijas. | **Producción** (recomendado). |

Cada proyecto nuevo trae una red llamada **`default`**, en modo auto y con reglas de firewall muy abiertas (SSH, RDP e ICMP desde cualquier IP). En producción se suele **borrar** y crear una red en modo custom.

Los rangos importan: si más adelante conectas esta VPC con otra o con tu oficina, **no pueden solaparse**. Planifica los rangos desde el principio.

### Reglas de firewall

Las reglas de firewall de la VPC se aplican **a cada VM**, no en un punto de la red. Cada regla tiene:

- **Dirección**: `INGRESS` (entrada, por defecto) o `EGRESS` (salida).
- **Acción**: permitir (`--allow`) o denegar (`--action=DENY`).
- **Origen o destino**: rangos IP (`--source-ranges`) o etiquetas de VMs (`--source-tags`).
- **Objetivo** (*target*): a qué VMs se aplica. Con **etiquetas de red** (`--target-tags=web`) o con **cuentas de servicio**. Sin objetivo, se aplica a **todas** las VMs de la red.
- **Prioridad**: de 0 a 65535; **número más bajo = más prioridad**. Por defecto, 1000. Con la misma prioridad, gana `DENY`.

Toda VPC tiene dos **reglas implícitas** con la prioridad más baja (65535), que no se ven ni se pueden borrar:

- **Denegar toda la entrada.**
- **Permitir toda la salida.**

Así que, por defecto, **nada entra** hasta que creas una regla que lo permita.

Las reglas son **stateful** (con estado): si permites la entrada de una conexión, la respuesta sale sin necesitar otra regla.

Ojo: si creas una regla de entrada **sin origen** (ni `--source-ranges` ni `--source-tags`), el origen es **`0.0.0.0/0`**: todo internet.

### Rutas

Las **rutas** dicen por dónde sale el tráfico según su destino. Google crea automáticamente:

- Una **ruta por cada subred**, para que las VMs se comuniquen entre sí.
- Una **ruta por defecto** (`0.0.0.0/0`) hacia internet. Aun así, una VM **sin IP pública** no puede salir a internet solo con esa ruta: necesita Cloud NAT (siguiente lección).

## Ejemplo

Red de producción en modo custom, con una subred y dos reglas:

```bash
gcloud compute networks create vpc-pro --subnet-mode=custom

gcloud compute networks subnets create web-euw1 \
  --network=vpc-pro --region=europe-west1 --range=10.10.0.0/24

# HTTP y HTTPS desde internet, solo a las VMs con la etiqueta "web"
gcloud compute firewall-rules create permitir-web \
  --network=vpc-pro --allow=tcp:80,tcp:443 \
  --source-ranges=0.0.0.0/0 --target-tags=web

# SSH solo desde el rango de IAP (el túnel de Google para SSH sin IP pública)
gcloud compute firewall-rules create permitir-ssh-iap \
  --network=vpc-pro --allow=tcp:22 \
  --source-ranges=35.235.240.0/20
```

La VM recibe la etiqueta al crearla: `gcloud compute instances create web-1 --tags=web ...`.

## Errores comunes

- **Usar la red `default` en producción**: tiene reglas que abren SSH y RDP a todo internet.
- **Olvidar `--source-ranges`** en una regla de entrada: el origen pasa a ser todo internet.
- **Crear la regla con `--target-tags=web` y no poner la etiqueta en la VM**: la regla no se aplica y el tráfico no llega.
- **Rangos que se solapan** con otras VPC o con la red de la oficina: luego no se pueden conectar.
- **Pensar que un número de prioridad más alto gana**: es al revés, gana el más bajo.

## En la entrevista

**«¿Qué diferencia hay entre una VPC de GCP y una de AWS?»**
En GCP la VPC es global y las subredes son regionales: una misma red abarca varias regiones sin configurar peering. En AWS la VPC es regional y sus subredes están en una zona de disponibilidad.

**«¿Cómo funcionan las reglas de firewall en GCP?»**
Se aplican a cada VM, son stateful y se evalúan por prioridad (número más bajo, más prioridad; con empate, gana DENY). Por defecto hay dos reglas implícitas: denegar toda la entrada y permitir toda la salida. Para elegir a qué VMs se aplica una regla se usan etiquetas de red o cuentas de servicio.

## Resumen

- **VPC global**, **subredes regionales** con un rango CIDR (y rangos secundarios para GKE).
- Modo **custom** para producción; la red `default` es demasiado abierta.
- Firewall: dirección, acción, origen, objetivo (etiquetas o cuentas de servicio) y **prioridad** (menor = gana).
- Reglas implícitas: **denegar entrada**, **permitir salida**. Las reglas son **stateful**.
- Rutas automáticas para cada subred y una por defecto hacia internet.
