---
title: IaaS, PaaS, SaaS y responsabilidad compartida
minutes: 10
---

## Qué problema resuelve

«Usar la nube» puede significar cosas muy distintas: alquilar una máquina virtual y administrarla tú, subir tu código y olvidarte de los servidores, o simplemente usar el correo de Gmail. Según el **modelo de servicio**, cambia **cuánto gestionas tú** y **cuánto el proveedor**, y con ello tu trabajo, tu flexibilidad y tu responsabilidad en seguridad.

## Analogía

La analogía clásica es la **pizza**:

- **Hecha en casa** (on-premises): compras la harina, el horno, la mesa… todo es tuyo.
- **IaaS**: te alquilan la cocina con horno. Tú haces la masa, pones los ingredientes y la horneas.
- **PaaS**: pides la pizza a domicilio. Tú solo pones la mesa y la bebida.
- **SaaS**: vas a una pizzería. Solo te sientas y comes.

## Concepto

| Modelo | Qué te dan | Qué gestionas tú | Ejemplos en GCP | En AWS / Azure |
|---|---|---|---|---|
| **IaaS** (*Infrastructure as a Service*) | Máquinas virtuales, discos y redes | Sistema operativo, parches, runtime, tu aplicación y tus datos | Compute Engine | EC2 / Azure Virtual Machines |
| **PaaS** (*Platform as a Service*) | Una plataforma donde subes código o contenedores | Tu aplicación y tus datos (y su configuración) | App Engine, Cloud Run | Elastic Beanstalk / Azure App Service |
| **SaaS** (*Software as a Service*) | Una aplicación terminada | Tus datos, usuarios y configuración | Google Workspace | — / Microsoft 365 |

Cuanto más arriba en la tabla, **más control** y **más trabajo**; cuanto más abajo, **menos gestión** y **menos flexibilidad**.

Entre IaaS y PaaS hay grises: **Kubernetes gestionado** (GKE, EKS, AKS) te quita el control plane pero sigues gestionando tus workloads; las **bases de datos gestionadas** (Cloud SQL) te quitan instalar y parchear el motor pero sigues diseñando esquemas y consultas. A los servicios en los que ni siquiera eliges servidores y pagas por petición se les llama **serverless** (Cloud Run, Cloud Run functions).

### Modelo de responsabilidad compartida

La seguridad se reparte:

- El **proveedor** es responsable de la seguridad **de** la nube: edificios, hardware, red física, virtualización.
- **Tú** eres responsable de la seguridad **en** la nube: quién tiene acceso (IAM), tus datos, la configuración de tus recursos, y todo lo que gestiones según el modelo.

La línea se mueve según el modelo:

| Capa | IaaS | PaaS | SaaS |
|---|---|---|---|
| Datos y accesos (IAM) | Tú | Tú | Tú |
| Aplicación | Tú | Tú | Proveedor |
| Sistema operativo y parches | Tú | Proveedor | Proveedor |
| Hardware, red física, centro de datos | Proveedor | Proveedor | Proveedor |

Fíjate en la primera fila: **tus datos y quién accede a ellos son siempre responsabilidad tuya**, uses el modelo que uses.

## Ejemplo

La misma web desplegada de tres maneras en Google Cloud:

1. **IaaS**, en Compute Engine: creas una VM, instalas Linux, nginx y tu aplicación. Si sale un parche de seguridad del sistema operativo, **lo aplicas tú**.
2. **PaaS / serverless**, en Cloud Run: subes una imagen de contenedor. Google gestiona servidores, sistema operativo y escalado (incluso a cero cuando no hay tráfico). Tú gestionas el código y sus dependencias.
3. **SaaS**: si lo que necesitabas era una web de un formulario de contacto, quizá bastaba con Google Forms. No gestionas nada técnico.

En los tres casos, si dejas un bucket de datos **público por error**, la culpa no es del proveedor: es configuración tuya.

## Errores comunes

- **Pensar que con PaaS o SaaS «la seguridad es del proveedor».** Los accesos y los datos siempre son tuyos.
- **Elegir IaaS por costumbre.** Si no necesitas controlar el sistema operativo, un servicio gestionado te ahorra parches, escalado y guardias.
- **Confundir serverless con «sin servidores».** Hay servidores; lo que no hay es servidores **que gestiones tú**.
- **Encajar a la fuerza cada servicio en una categoría.** Los límites son difusos; lo importante es saber **qué gestionas tú** en cada caso.

## En la entrevista

**«Explica IaaS, PaaS y SaaS con un ejemplo de cada uno.»**
IaaS: alquilas infraestructura (VMs, discos, redes), como Compute Engine o EC2, y gestionas desde el sistema operativo hacia arriba. PaaS: despliegas código o contenedores en una plataforma gestionada, como Cloud Run o App Service. SaaS: usas una aplicación terminada, como Google Workspace o Microsoft 365.

**«¿Qué es el modelo de responsabilidad compartida?»**
El proveedor asegura la infraestructura de la nube (centros de datos, hardware, virtualización) y el cliente asegura lo que pone en ella: identidades y permisos, datos y configuración. Cuanto más gestionado es el servicio, más capas asume el proveedor, pero los datos y los accesos siempre son del cliente.

## Resumen

- **IaaS**: te dan infraestructura; gestionas desde el sistema operativo hacia arriba (Compute Engine).
- **PaaS**: subes código o contenedores; la plataforma gestiona el resto (Cloud Run, App Engine).
- **SaaS**: usas una aplicación terminada (Google Workspace).
- **Responsabilidad compartida**: el proveedor asegura **la** nube; tú aseguras lo que hay **en** ella.
- Tus **datos y accesos (IAM)** son siempre responsabilidad tuya.
