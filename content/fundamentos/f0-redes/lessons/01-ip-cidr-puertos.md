---
title: IPs, CIDR y puertos
minutes: 12
---

## Qué problema resuelve

En la nube vas a crear **redes y subredes**, abrir **puertos** en un firewall y conectar servicios entre sí. Si no entiendes qué significa `10.0.1.0/24` o por qué tu base de datos no responde en el puerto `5432`, cada error de red será un misterio.

## Analogía

- Una **dirección IP** es la **dirección postal de un edificio**.
- Un **puerto** es el **número de puerta** dentro del edificio: en la puerta 443 atiende la web segura; en la 22, el acceso remoto (SSH).
- Una **subred** es una **calle**: todas las casas de la calle comparten el principio de la dirección.

## Concepto

### Direcciones IPv4

Una IPv4 son **4 números del 0 al 255** separados por puntos: `192.168.1.10`. En total son **32 bits** (8 por número).

**IPs privadas** (RFC 1918): no se enrutan por internet, se usan dentro de redes internas y VPCs:

| Rango | Tamaño |
|---|---|
| `10.0.0.0/8` | ~16,7 millones de direcciones |
| `172.16.0.0/12` | ~1 millón |
| `192.168.0.0/16` | 65 536 |

El resto (salvo algunos rangos especiales) son **IPs públicas**, visibles desde internet. `127.0.0.1` es **localhost**: la propia máquina.

### Notación CIDR

`10.0.1.0/24` significa: «los primeros **24 bits** son fijos (la red); los **8 restantes** varían (los hosts)». El número de direcciones es **2^(32 − prefijo)**:

| CIDR | Direcciones | Ejemplo de rango |
|---|---|---|
| `/32` | 1 | una sola IP |
| `/28` | 16 | `10.0.1.0` – `10.0.1.15` |
| `/24` | 256 | `10.0.1.0` – `10.0.1.255` |
| `/16` | 65 536 | `10.0.0.0` – `10.0.255.255` |
| `/0` | todas | `0.0.0.0/0` = «cualquier IP» |

**Cuanto mayor el prefijo, más pequeña la red.** Cada bit menos de prefijo **duplica** el tamaño.

No todas las direcciones son utilizables: por ejemplo, en cada subred de Google Cloud se reservan **4** (la de red, la de la puerta de enlace, la penúltima y la de broadcast). Un `/24` deja **252** IPs para tus máquinas.

Dos subredes de la misma red **no pueden solaparse**: `10.0.1.0/24` y `10.0.1.128/25` chocan.

### Puertos, TCP y UDP

Un **puerto** (0–65535) identifica un servicio dentro de una máquina. Una conexión se define por **IP + puerto**.

| Puerto | Servicio |
|---|---|
| 22 | SSH (acceso remoto) |
| 53 | DNS |
| 80 | HTTP |
| 443 | HTTPS |
| 3306 | MySQL |
| 5432 | PostgreSQL |
| 6443 | API server de Kubernetes (habitual) |

Los dos protocolos de transporte más usados:

| | TCP | UDP |
|---|---|---|
| Conexión | Se establece antes de enviar datos | No hay conexión |
| Fiabilidad | Garantiza entrega y orden (reenvía lo perdido) | No garantiza nada |
| Uso | Web, SSH, bases de datos | DNS, vídeo en directo, juegos |

## Ejemplo

Diseño de una VPC para una aplicación:

```
VPC 10.0.0.0/16  (65 536 direcciones)
├── subred web    10.0.1.0/24   (256)  → servidores web
├── subred app    10.0.2.0/24   (256)  → backend
└── subred datos  10.0.3.0/24   (256)  → base de datos
```

Reglas de firewall típicas:

- Permitir **TCP 443** desde `0.0.0.0/0` (cualquiera) hacia la subred web.
- Permitir **TCP 5432** solo desde `10.0.2.0/24` (el backend) hacia la subred de datos.
- **No** abrir el 22 (SSH) a `0.0.0.0/0`.

## Errores comunes

- **Pensar que `/16` es más pequeño que `/24`.** Es al revés: `/16` tiene 256 veces más direcciones.
- **Subredes que se solapan** entre sí o con la red de la oficina a la que luego quieres conectarte por VPN.
- **Subredes demasiado pequeñas.** Ampliarlas después puede ser complicado; en Kubernetes cada Pod consume una IP.
- **Abrir puertos a `0.0.0.0/0`** «para probar» y olvidarlo, sobre todo el 22 o el de la base de datos.
- **Confundir IP privada y pública**: desde internet no se llega a una `10.x.x.x`.

## En la entrevista

**«¿Cuántas direcciones tiene un `/26`?»**
2^(32 − 26) = 2^6 = 64. Las utilizables son algunas menos, porque cada red reserva direcciones (en GCP, 4 por subred).

**«¿Diferencia entre TCP y UDP?»**
TCP establece una conexión y garantiza entrega y orden (web, SSH, bases de datos). UDP envía sin conexión ni garantías, con menos latencia (DNS, streaming).

## Resumen

- IPv4 = 32 bits; rangos **privados**: `10/8`, `172.16/12`, `192.168/16`.
- **CIDR** `/n`: 2^(32 − n) direcciones. Mayor prefijo = red más pequeña.
- Subredes de una red **no deben solaparse**.
- Puertos clave: **22** SSH, **80** HTTP, **443** HTTPS, **53** DNS, **5432** PostgreSQL.
- **TCP** fiable y con conexión; **UDP** rápido y sin garantías.
