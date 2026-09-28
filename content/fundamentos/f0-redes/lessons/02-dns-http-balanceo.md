---
title: DNS, HTTP y load balancers
minutes: 10
---

## Qué problema resuelve

Nadie escribe `142.250.184.14` en el navegador: escribe `google.com`. Y cuando una web falla, el navegador te da una pista en forma de número: 404, 502, 503… Entender **DNS**, **HTTP** y los **load balancers** es lo que te permite seguir el camino de una petición desde el usuario hasta tu aplicación.

## Analogía

- **DNS** es la **agenda del teléfono**: buscas «Ana» y te da su número.
- **HTTP** es el **idioma** en que el navegador y el servidor se hablan: «dame esta página» / «aquí la tienes (200)» o «no existe (404)».
- Un **load balancer** es el **recepcionista de un hospital**: recibe a todos los pacientes y los reparte entre los médicos que están libres.

## Concepto

### DNS

El **DNS** traduce nombres a IPs. Tipos de registro más usados:

| Registro | Para qué | Ejemplo |
|---|---|---|
| **A** | Nombre → IPv4 | `tienda.example.com → 34.110.20.5` |
| **AAAA** | Nombre → IPv6 | |
| **CNAME** | Nombre → otro nombre (alias) | `www.example.com → tienda.example.com` |
| **MX** | Servidores de correo del dominio | |
| **TXT** | Texto libre (verificaciones de dominio, SPF…) | |

Cada registro tiene un **TTL**: cuánto tiempo pueden guardarlo en caché. Por eso un cambio de DNS no se ve al instante en todas partes.

### HTTP y HTTPS

Una petición HTTP tiene un **método** y una **ruta**; la respuesta, un **código de estado**.

- Métodos: **GET** (leer), **POST** (crear), **PUT/PATCH** (modificar), **DELETE** (borrar).
- Códigos por familias:

| Familia | Significado | Ejemplos |
|---|---|---|
| **2xx** | Éxito | 200 OK, 201 Created |
| **3xx** | Redirección | 301 Moved Permanently |
| **4xx** | **Error del cliente** | 400 Bad Request, 401 Unauthorized (no autenticado), 403 Forbidden (sin permiso), 404 Not Found |
| **5xx** | **Error del servidor** | 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout |

Para depurar en la nube son clave los **502** y **504**: normalmente significan que un **proxy o load balancer** no ha recibido una respuesta válida (502) o a tiempo (504) de la aplicación que hay detrás.

**HTTPS** es HTTP cifrado con **TLS**. El servidor presenta un **certificado** que demuestra que es quien dice ser. Puerto 443.

### Load balancers

Un **load balancer** reparte el tráfico entre varios servidores (*backends*) y deja de enviar tráfico a los que fallan sus **health checks** (comprobaciones de salud).

| Tipo | Decide mirando… | Puede… |
|---|---|---|
| **Capa 4** (TCP/UDP) | IP y puerto | Repartir conexiones; muy rápido; no entiende HTTP. |
| **Capa 7** (HTTP/HTTPS) | La petición HTTP: host, ruta, cabeceras | Enviar `/api` a un backend y `/` a otro, terminar TLS… |

## Ejemplo

El viaje de una petición a `https://tienda.example.com/carrito`:

1. El navegador pregunta al **DNS**: `tienda.example.com` → registro **A** → `34.110.20.5` (la IP del load balancer).
2. Abre una conexión **TCP** al puerto **443** y negocia **TLS** (verifica el certificado).
3. Envía `GET /carrito`.
4. El **load balancer de capa 7** mira la ruta y la envía a un backend **sano** del grupo «web».
5. El backend responde **200 OK** con la página.

Si en el paso 4 todos los backends fallan su health check, el usuario verá un **502** o **503**.

## Errores comunes

- **Cambiar un registro DNS y esperar que se vea al instante.** Hay que esperar al TTL.
- **Confundir 401 y 403.** 401: no te has identificado. 403: te has identificado, pero no tienes permiso.
- **Culpar al load balancer de un 502** sin mirar la aplicación. Casi siempre es el backend que falla, tarda o no escucha en el puerto correcto.
- **Health checks mal configurados** (ruta o puerto equivocados): todos los backends aparecen «no sanos» aunque funcionen.

## En la entrevista

**«¿Qué pasa cuando escribes una URL en el navegador?»**
Resolución DNS del nombre a una IP, conexión TCP (y negociación TLS si es HTTPS), envío de la petición HTTP, posible paso por un load balancer que la envía a un backend sano, y respuesta con un código de estado y contenido.

**«¿Diferencia entre un load balancer de capa 4 y uno de capa 7?»**
El de capa 4 reparte conexiones mirando solo IP y puerto. El de capa 7 entiende HTTP: puede enrutar por host o ruta, terminar TLS y tomar decisiones según cabeceras.

## Resumen

- **DNS**: nombre → IP. Registros **A**, **CNAME**, **MX**, **TXT**; los cambios tardan lo que marque el **TTL**.
- **HTTP**: métodos (GET, POST…) y códigos: **2xx** bien, **4xx** error del cliente, **5xx** error del servidor.
- **HTTPS** = HTTP + **TLS** (certificado, puerto 443).
- Un **load balancer** reparte tráfico entre backends **sanos** (health checks).
- **Capa 4** mira IP y puerto; **capa 7** entiende HTTP (rutas, hosts).
