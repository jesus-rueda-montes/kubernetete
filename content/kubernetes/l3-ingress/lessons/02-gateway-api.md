---
title: Gateway API
minutes: 9
---

## Qué problema resuelve

Ingress se quedó corto: solo HTTP básico, muchas funciones escondidas en annotations distintas en cada controller, y un único objeto donde se mezclan las decisiones del equipo de plataforma (qué load balancer, qué puertos, qué certificados) y las del equipo de la aplicación (qué rutas van a qué Service).

**Gateway API** es la evolución oficial: más expresiva (cabeceras, pesos para *canary*, gRPC…), **portable** entre implementaciones y **orientada a roles**.

## Analogía

Si Ingress era un recepcionista con una sola lista, Gateway API es un **aeropuerto**:

- La **compañía que construye aeropuertos** define los tipos de terminal (**GatewayClass**).
- La **dirección del aeropuerto** abre una terminal concreta con sus puertas y controles (**Gateway**).
- Cada **aerolínea** publica sus propios vuelos y a qué puerta van (**HTTPRoute**), sin tocar la terminal.

## Concepto

Gateway API no viene dentro de Kubernetes: se instala como **CRDs** (recursos personalizados) junto con una implementación (el controlador de GKE, Envoy Gateway, Istio, Cilium…).

| Recurso | Lo gestiona… | Qué define |
|---|---|---|
| **GatewayClass** | El proveedor de infraestructura | Un tipo de gateway y el controlador que lo implementa. |
| **Gateway** | El equipo de plataforma (operador del clúster) | Una instancia concreta: **listeners** (protocolo, puerto, hostname, TLS) y qué namespaces pueden colgar rutas. |
| **HTTPRoute** (y GRPCRoute…) | El equipo de la aplicación | Reglas: hosts, rutas, cabeceras, y a qué Services (con pesos) va el tráfico. Se engancha a un Gateway con **`parentRefs`**. |

Ventajas frente a Ingress:

- **Separación de responsabilidades**: cada equipo toca su recurso, con RBAC distinto.
- **Funciones estándar** que en Ingress eran annotations: coincidencia por cabeceras, reescrituras, **reparto del tráfico por pesos** (por ejemplo, 90 % a la versión estable y 10 % a la nueva).
- **Más protocolos**: HTTP, gRPC, y otros según la implementación.

## Ejemplo

```yaml
# Lo crea el equipo de plataforma
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: publico
  namespace: infra
spec:
  gatewayClassName: gke-l7-global-external-managed   # ejemplo de clase en GKE
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: All              # rutas de cualquier namespace
---
# Lo crea el equipo de la tienda, en su namespace
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: tienda
  namespace: tienda
spec:
  parentRefs:
    - name: publico
      namespace: infra
  hostnames: ["tienda.example.com"]
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /api
      backendRefs:
        - name: api-v1           # 90 % del tráfico a la versión estable
          port: 80
          weight: 90
        - name: api-v2           # 10 % a la nueva (canary)
          port: 80
          weight: 10
```

## Errores comunes

- **Aplicar un Gateway sin tener instaladas las CRDs** ni una implementación: «no matches for kind Gateway».
- **HTTPRoute que no se engancha**: `parentRefs` mal escrito o el Gateway no permite rutas de ese namespace (`allowedRoutes`). `kubectl describe httproute` muestra el estado `Accepted`.
- **Suponer que todas las implementaciones soportan todo**: hay funciones estándar (*core*) y extendidas; revisa la de tu proveedor.

## En la entrevista

**«¿Por qué Gateway API y no Ingress?»**
Ingress está congelado y depende de annotations no portables. Gateway API separa responsabilidades (GatewayClass, Gateway y Routes para distintos roles), estandariza funciones avanzadas como la coincidencia por cabeceras o el reparto por pesos, admite más protocolos y es portable entre implementaciones.

**«¿Cómo harías un despliegue canary con Gateway API?»**
Con una HTTPRoute cuyos `backendRefs` apuntan a los Services de las dos versiones con pesos (por ejemplo 90/10), cambiando los pesos poco a poco según las métricas.

## Resumen

- **Gateway API** es la evolución de Ingress; se instala como **CRDs** con una implementación.
- **GatewayClass** (tipo) → **Gateway** (instancia con listeners) → **HTTPRoute** (reglas de la aplicación).
- **Orientada a roles**: plataforma y aplicación gestionan recursos distintos.
- Estandariza **cabeceras, reescrituras y pesos** (canary) sin annotations.
- Las rutas se enganchan al Gateway con **`parentRefs`**.
