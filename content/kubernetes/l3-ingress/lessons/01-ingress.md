---
title: Ingress
minutes: 12
---

## Qué problema resuelve

Tienes varias aplicaciones web en el clúster: la tienda, la API y el panel de administración. Si expones cada una con un Service de tipo **LoadBalancer**, pagas **un load balancer (y una IP) por aplicación**, y cada una tiene que gestionar su propio TLS. Además, querrías cosas como «`tienda.example.com/api` va a la API y el resto a la web».

Un **Ingress** define **reglas de enrutado HTTP(S)** (por dominio y por ruta) detrás de **un único punto de entrada**, con la terminación TLS centralizada.

## Analogía

Un Ingress es la **recepción de un edificio de oficinas**: todos los visitantes entran por la misma puerta, y el recepcionista mira a quién vienen a ver («empresa A, planta 3») para mandarlos al sitio correcto. Las reglas son el **directorio del vestíbulo**; el recepcionista que las aplica es el **Ingress controller**.

## Concepto

### Ingress e Ingress controller

- El objeto **Ingress** solo **describe reglas**. Por sí mismo **no hace nada**.
- Un **Ingress controller** (un programa que instalas en el clúster o que te da el proveedor) lee esas reglas y configura un proxy o load balancer real. Ejemplos: el de GKE (crea un load balancer de Google Cloud), Traefik, HAProxy, Contour…
- Cada Ingress indica qué controller lo atiende con **`ingressClassName`** (el nombre de una **IngressClass**). Si lo omites, se usa la IngressClass marcada como predeterminada, si la hay.
- **Excepción importante: GKE.** Su Ingress controller **no admite `ingressClassName`**: se elige con la annotation `kubernetes.io/ingress.class: "gce"` (load balancer externo) o `"gce-internal"` (interno). Sin ninguna de las dos, GKE crea un load balancer externo. Kubernetes avisa de que la annotation está obsoleta, pero GKE la sigue usando.

### Reglas

```yaml
spec:
  ingressClassName: traefik      # qué controller lo gestiona (ejemplo)
  rules:
    - host: tienda.example.com   # opcional: si se omite, vale para cualquier host
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api        # Service de destino...
                port:
                  number: 80     # ...y su puerto
```

**`pathType`** (obligatorio en cada ruta):

| pathType | Coincide con | `/api` coincide con `/api/pedidos`? |
|---|---|---|
| **Exact** | Exactamente esa ruta | No |
| **Prefix** | Esa ruta y lo que cuelga de ella, por segmentos separados por `/` | Sí (pero no con `/apiv2`) |
| **ImplementationSpecific** | Lo que decida el controller | Depende |

Si una petición no encaja con ninguna regla, va al **`defaultBackend`** (si lo defines).

### TLS

```yaml
spec:
  tls:
    - hosts: [tienda.example.com]
      secretName: tienda-tls     # Secret de tipo kubernetes.io/tls, con tls.crt y tls.key
```

El Secret debe estar en el **mismo namespace** que el Ingress. El controller termina el HTTPS (puerto 443) y reenvía al Service. Herramientas como **cert-manager** crean y renuevan esos certificados automáticamente.

### Limitaciones y estado actual

- Ingress solo cubre **HTTP y HTTPS**. Para otros protocolos, Services NodePort o LoadBalancer.
- Muchas opciones (reescrituras de URL, límites de tamaño…) se configuran con **annotations propias de cada controller**, que no son portables.
- La **API de Ingress está congelada**: sigue siendo estable y GA, pero ya no evoluciona. El proyecto Kubernetes recomienda **Gateway API** (siguiente lección).
- **ingress-nginx**, el controller más popular durante años, dejó de mantenerse en **marzo de 2026** (sin más versiones ni parches de seguridad). La API de Ingress no se elimina, pero conviene elegir un controller mantenido o migrar a Gateway API.

## Ejemplo

Un Ingress que envía `/api` a la API y el resto a la web, con HTTPS:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tienda
spec:
  ingressClassName: traefik
  tls:
    - hosts: [tienda.example.com]
      secretName: tienda-tls
  rules:
    - host: tienda.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
```

```bash
kubectl apply -f ingress.yaml
kubectl get ingress tienda        # ADDRESS: la IP del load balancer (puede tardar unos minutos)
kubectl describe ingress tienda   # reglas, backends y eventos del controller

# Equivalente rápido (la ruta con * usa pathType Prefix):
kubectl create ingress tienda --class=traefik \
  --rule="tienda.example.com/api*=api:80" --rule="tienda.example.com/*=web:80,tls=tienda-tls"
```

## Errores comunes

- **Crear un Ingress sin controller**: se queda sin dirección (`ADDRESS` vacío) y no pasa nada.
- **`ingressClassName` incorrecto**: ningún controller lo atiende.
- **Services o puertos inexistentes** en los backends: errores 502/503 del proxy.
- **Secret TLS en otro namespace** o sin `tls.crt`/`tls.key`.
- **Confiar en annotations** de un controller y cambiar de controller: esas opciones dejan de funcionar.
- **Esperar que `Prefix` `/api` incluya `/apiv2`**: la coincidencia es por segmentos de ruta.

## En la entrevista

**«¿Diferencia entre un Service LoadBalancer y un Ingress?»**
Un Service LoadBalancer expone un Service con su propio load balancer de capa 4. Un Ingress define reglas HTTP(S) por host y ruta para muchos Services detrás de un único punto de entrada, con TLS centralizado; necesita un Ingress controller que lo implemente.

**«¿Qué necesitas para que un Ingress funcione?»**
Un Ingress controller instalado (y su IngressClass), los Services de destino con endpoints, y para HTTPS un Secret TLS en el mismo namespace. Y hoy conviene valorar Gateway API, que es la evolución recomendada.

## Resumen

- **Ingress** = reglas de enrutado **HTTP(S)** por **host** y **ruta** hacia Services, detrás de un único punto de entrada.
- Sin **Ingress controller** no hace nada; se elige con **`ingressClassName`**.
- **`pathType`**: `Exact`, `Prefix` (por segmentos) o `ImplementationSpecific`.
- **TLS** con un Secret `kubernetes.io/tls` en el mismo namespace.
- API **congelada**: la evolución es **Gateway API**; ingress-nginx dejó de mantenerse en marzo de 2026.
