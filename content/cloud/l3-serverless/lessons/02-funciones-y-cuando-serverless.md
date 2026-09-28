---
title: Funciones, eventos y cuándo elegir serverless
minutes: 10
---

## Qué problema resuelve

A veces no necesitas una aplicación entera, sino **un trozo de código que reaccione a algo**: generar una miniatura cuando alguien sube una foto a un bucket, o procesar un mensaje que llega a una cola. Escribir un servidor web, un Dockerfile y un despliegue para eso es demasiado.

Además, con tantas opciones (VMs, GKE, Cloud Run, funciones), necesitas un criterio para **elegir dónde ejecutar cada carga**.

## Analogía

- Una **función** es como un **sensor de movimiento** que enciende la luz: no hace nada hasta que pasa algo, y entonces ejecuta una acción concreta.
- Elegir entre VMs, GKE y Cloud Run es como elegir entre **comprar un coche**, **gestionar una flota** o **pedir un taxi**: más control o más comodidad.

## Concepto

### Cloud Run functions

**Cloud Run functions** (antes Cloud Functions) te deja desplegar **solo el código de una función**, en lenguajes como Node.js, Python, Go o Java. Google construye el contenedor por ti y lo ejecuta sobre Cloud Run, así que hereda su escalado, su concurrencia y su configuración.

Una función se dispara de dos formas:

- **HTTP**: recibe una petición y responde, como un pequeño endpoint.
- **Eventos**: reacciona a algo que pasa en Google Cloud, a través de **Eventarc**:
  - Un objeto nuevo en **Cloud Storage**.
  - Un mensaje en un tema de **Pub/Sub**.
  - Un cambio en un documento de **Firestore**, entre otros.

### Pub/Sub en dos líneas

**Pub/Sub** es el servicio de **mensajería** de Google Cloud. Un productor **publica** mensajes en un **tema** (*topic*) y los consumidores los reciben a través de **suscripciones**. Así los servicios se comunican sin depender unos de otros: si el consumidor está caído, los mensajes esperan.

### Eventos: reintentos e idempotencia

Con los eventos, la entrega es **al menos una vez**: el mismo evento puede llegar **dos veces**. Tu función debe ser **idempotente**: procesar dos veces el mismo evento no debe duplicar el resultado (por ejemplo, comprobar si la miniatura ya existe).

### ¿VMs, GKE o Cloud Run?

| | Compute Engine (VMs) | GKE | Cloud Run / functions |
|---|---|---|---|
| Qué gestionas | El sistema operativo y todo lo de encima | El clúster y los manifiestos de Kubernetes | Solo el contenedor o el código |
| Escalado | Grupos de instancias | Autoescalado de Pods y de nodos | Automático, hasta cero |
| Mejor para | Software que no se puede contenerizar, licencias, control total del SO | Muchos servicios, cargas con estado, necesidades de Kubernetes (operators, DaemonSets, protocolos especiales) | APIs y webs sin estado, eventos, tráfico irregular |
| Pago | Por máquina encendida | Por nodos (o por Pod en Autopilot) | Por uso |

Pregunta clave: **¿necesito algo que Cloud Run no me da?** Si no, Cloud Run suele ser lo más simple y barato. Cuando el tráfico es alto y constante, o necesitas control de Kubernetes, GKE puede compensar.

## Ejemplo

Procesar imágenes subidas a un bucket:

```text
Usuario sube foto ──► Cloud Storage (bucket "subidas")
                          │  evento "objeto finalizado" (Eventarc)
                          ▼
                 Cloud Run function "miniaturas"
                          │  crea la miniatura (si no existe ya)
                          ▼
                 Cloud Storage (bucket "miniaturas")
```

Arquitectura con desacoplamiento:

```text
API (Cloud Run) ──publica──► Pub/Sub "pedidos-creados"
                                 ├──► función "enviar-email"
                                 └──► servicio "facturación" (Cloud Run)
```

Si el servicio de facturación está caído, los mensajes esperan en su suscripción y la API sigue funcionando.

## Errores comunes

- **Funciones no idempotentes**: un evento duplicado envía dos emails o cobra dos veces.
- **Encadenar muchas funciones por HTTP** para un proceso complejo: difícil de depurar. Usa Pub/Sub o Workflows.
- **Elegir GKE por costumbre** para una sola API sin estado con poco tráfico: pagas y mantienes un clúster sin necesidad.
- **Elegir Cloud Run** para algo que necesita estado local, un protocolo no soportado o acceso al nodo: ahí encajan GKE o VMs.
- **Olvidar los límites de tiempo**: una función no es para procesos de horas.

## En la entrevista

**«¿Cómo decides entre Cloud Run, GKE y Compute Engine?»**
Empiezo por lo más gestionado: si es un contenedor sin estado que responde a HTTP o a eventos, Cloud Run. Si tengo muchos servicios, cargas con estado o necesito capacidades de Kubernetes, GKE. Si necesito control del sistema operativo o software que no se puede contenerizar, VMs. También miro el patrón de tráfico: irregular favorece Cloud Run; alto y constante puede salir más barato en GKE.

**«¿Qué problema tienen los eventos con entrega "al menos una vez"?»**
Que el mismo evento puede llegar varias veces, así que el consumidor tiene que ser idempotente, por ejemplo guardando el ID de los eventos ya procesados.

## Resumen

- **Cloud Run functions**: solo el código; disparadas por **HTTP** o por **eventos** (Eventarc: Cloud Storage, Pub/Sub, Firestore…).
- **Pub/Sub**: temas y suscripciones para **desacoplar** servicios.
- Entrega **al menos una vez** → funciones **idempotentes**.
- Orden de preferencia habitual: **Cloud Run** (más simple) → **GKE** (control de Kubernetes) → **VMs** (control del SO).
