---
title: Grupos de instancias gestionados
minutes: 8
---

## Qué problema resuelve

Una VM suelta es un **punto único de fallo** y no crece con la demanda. Si la web recibe el triple de visitas o una máquina se cuelga, alguien tendría que crear VMs a mano y reemplazar las rotas. Los **grupos de instancias gestionados** (*Managed Instance Groups*, **MIG**) hacen eso automáticamente.

## Analogía

Un MIG es como una **flota de taxis** con una central: todos los coches son del mismo modelo (plantilla); si uno se avería, la central manda otro (autocuración); en hora punta saca más coches a la calle y de madrugada los retira (autoescalado).

## Concepto

- Una **plantilla de instancia** (*instance template*) define cómo es cada VM: tipo de máquina, imagen, discos, red, cuenta de servicio, startup script.
- El **MIG** crea y mantiene N VMs **idénticas** a partir de esa plantilla.

Lo que aporta un MIG:

| Función | Qué hace |
|---|---|
| **Autoescalado** | Añade o quita VMs según la CPU, el tráfico del load balancer u otras métricas. |
| **Autocuración** (*autohealing*) | Con un **health check de la aplicación**, **recrea** las VMs que dejan de responder. |
| **Regional (multizona)** | Un MIG **regional** reparte las VMs entre varias zonas: sobrevive a la caída de una. |
| **Actualizaciones progresivas** | Cambias la plantilla y el MIG sustituye las VMs poco a poco (y permite probar la nueva versión en unas pocas, tipo *canary*). |
| **Load balancing** | Un MIG se usa como *backend* de un load balancer. |

¿Te suena? Es la misma idea que un **Deployment** de Kubernetes (plantilla + réplicas + actualización progresiva), pero con VMs en lugar de Pods.

Los **grupos no gestionados** solo agrupan VMs distintas para el load balancer, sin autoescalado ni autocuración. Casi nunca son la opción adecuada para algo nuevo.

## Ejemplo

Arquitectura típica de una web en VMs:

```
Usuarios → Load balancer HTTP(S) global
                 │
        MIG regional "web" (plantilla web-v2, 3–10 VMs)
          ├── europe-west1-b: web-7x2k, web-p9q1
          ├── europe-west1-c: web-m3n8
          └── europe-west1-d: web-z4t6
```

- El autoescalado mantiene la CPU media alrededor del 60 %.
- Si una VM falla el health check de `/healthz`, se recrea.
- Si cae la zona `-b`, siguen funcionando las de `-c` y `-d` (y el MIG crea más si hace falta).

## Errores comunes

- **Guardar estado en las VMs** de un MIG (archivos subidos, sesiones): se pierde cuando el MIG recrea o reduce VMs. El estado va en una base de datos o en Cloud Storage.
- **MIG zonal para producción**: una caída de zona lo tumba todo. Mejor regional.
- **Health check de autocuración demasiado agresivo**: recrea VMs que solo estaban arrancando.
- **Editar a mano una VM del grupo**: el siguiente reemplazo la devuelve a la plantilla.

## En la entrevista

**«¿Cómo harías escalable y tolerante a fallos una aplicación desplegada en VMs?»**
Con una plantilla de instancia y un MIG regional detrás de un load balancer, con autoescalado por CPU o por carga del balanceador y autocuración con un health check. La aplicación debe ser stateless: el estado en servicios gestionados.

**«¿Qué relación hay entre un MIG y un Deployment de Kubernetes?»**
Son el mismo patrón a distinto nivel: una plantilla, un número deseado de réplicas idénticas, reemplazo automático de las que fallan y actualizaciones progresivas. Uno gestiona VMs; el otro, Pods.

## Resumen

- **Plantilla de instancia** + **MIG** = N VMs idénticas gestionadas.
- **Autoescalado**, **autocuración** (health check), **actualizaciones progresivas**.
- **MIG regional** para sobrevivir a la caída de una zona.
- Las VMs de un MIG deben ser **stateless**.
- Es el equivalente, en VMs, de un **Deployment** de Kubernetes.
