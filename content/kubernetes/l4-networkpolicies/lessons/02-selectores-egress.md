---
title: Namespaces, salida y DNS
minutes: 11
---

## Qué problema resuelve

Con `podSelector` solo eliges Pods de **tu mismo namespace**. Pero el tráfico real cruza namespaces: el **Ingress controller** (en el namespace `traefik`) llama a tu web; **Prometheus** (en `monitoring`) recoge métricas de todos. Además, a veces quieres controlar la **salida**: que la base de datos no pueda conectarse a internet, o que una app solo hable con una API externa concreta.

Aquí verás los **selectores de namespace**, las reglas de **egress** y la trampa más habitual: el **DNS**.

## Analogía

- El `namespaceSelector` es como decir «dejad pasar a **cualquiera del departamento de seguridad**», en vez de nombrar persona por persona.
- La regla de salida es la **lista de números a los que se puede llamar** desde un despacho. Y el DNS es la **guía telefónica**: si también la bloqueas, no puedes buscar ningún número.

## Concepto

### Tres tipos de origen o destino

| Selector | Qué elige |
|---|---|
| `podSelector` | Pods con esas labels **en el namespace de la política**. |
| `namespaceSelector` | **Todos** los Pods de los namespaces con esas labels. |
| `ipBlock` | Un rango de IPs (CIDR), con `except` para excluir partes. Para tráfico de fuera del clúster. |

Kubernetes pone a cada namespace la label **`kubernetes.io/metadata.name: NOMBRE`**, útil para elegir uno por su nombre.

### Y (AND) frente a O (OR)

La diferencia está en el **guion**:

```yaml
# UNA entrada con los dos selectores → AND:
# Pods "app: prometheus" que estén en el namespace "monitoring"
ingress:
  - from:
      - namespaceSelector:
          matchLabels:
            kubernetes.io/metadata.name: monitoring
        podSelector:
          matchLabels:
            app: prometheus
```

```yaml
# DOS entradas (dos guiones) → OR:
# cualquier Pod del namespace "monitoring", O Pods "app: prometheus" de MI namespace
ingress:
  - from:
      - namespaceSelector:
          matchLabels:
            kubernetes.io/metadata.name: monitoring
      - podSelector:
          matchLabels:
            app: prometheus
```

Un guion de más o de menos cambia totalmente la política. Revisa con `kubectl describe networkpolicy`, que lo muestra en texto.

### Salida (egress) y el DNS

Con `Egress` en `policyTypes`, el Pod solo puede **salir** hacia lo que permitan las reglas `egress`. Cuidado: los Pods resuelven nombres (`api.tienda.svc.cluster.local`, `www.google.com`) consultando al **DNS del clúster** (CoreDNS, en el namespace `kube-system`, puerto **53** UDP y TCP). Una política de salida que no lo permita **rompe la resolución de nombres**: la aplicación falla con errores de «host desconocido» aunque la conexión en sí estuviera permitida.

```yaml
egress:
  - to:                                   # permitir DNS
      - namespaceSelector:
          matchLabels:
            kubernetes.io/metadata.name: kube-system
        podSelector:
          matchLabels:
            k8s-app: kube-dns
    ports:
      - protocol: UDP
        port: 53
      - protocol: TCP
        port: 53
```

### Las dos puntas

Para que una conexión de A a B funcione, deben permitirla **la salida de A** (si A está aislado para egress) **y la entrada de B** (si B está aislado para ingress).

## Ejemplo

La web de `tienda` solo acepta tráfico del Ingress controller, y la base de datos no puede salir a ningún sitio:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: web-desde-ingress
  namespace: tienda
spec:
  podSelector:
    matchLabels:
      app: web
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: traefik
      ports:
        - protocol: TCP
          port: 80
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-sin-salida
  namespace: tienda
spec:
  podSelector:
    matchLabels:
      app: db
  policyTypes: [Egress]      # aislada para la salida, sin reglas egress: no sale nada
```

Probar una política desde dentro de un Pod:

```bash
kubectl exec -n tienda deploy/web -- wget -qO- --timeout=2 http://api:8080   # permitido: responde
kubectl exec -n tienda deploy/db -- wget -qO- --timeout=2 http://api:8080    # bloqueado: timeout
```

## Errores comunes

- **Olvidar el DNS** al aislar la salida: todo falla con errores de resolución de nombres.
- **Confundir AND y OR** por un guion: la política deja pasar mucho más (o mucho menos) de lo esperado.
- **Usar `podSelector` para Pods de otro namespace**: solo mira el namespace de la política. Hace falta `namespaceSelector`.
- **Permitir la entrada en B pero no la salida en A** cuando A está aislado para egress: la conexión sigue bloqueada.
- **Usar `ipBlock` para IPs de Pods**: cambian constantemente. Usa selectores de labels.

## En la entrevista

**«Aplicas una política de egress y la aplicación deja de resolver nombres. ¿Qué ha pasado?»**
La política bloquea la salida hacia el DNS del clúster. Hay que añadir una regla de egress hacia CoreDNS (`k8s-app: kube-dns` en `kube-system`) en el puerto 53, UDP y TCP.

**«¿Cómo permites el tráfico solo desde los Pods de Prometheus del namespace monitoring?»**
Con una única entrada en `from` que combine `namespaceSelector` (el namespace `monitoring`) y `podSelector` (`app: prometheus`) en el mismo elemento, para que se apliquen los dos a la vez. Si los pongo en dos elementos, se permite cualquiera de los dos.

## Resumen

- **`podSelector`** (mi namespace), **`namespaceSelector`** (otros namespaces), **`ipBlock`** (IPs externas).
- Mismo elemento = **AND**; elementos separados (dos guiones) = **OR**.
- Label automática: **`kubernetes.io/metadata.name`**.
- Al aislar la salida, **permite el DNS** (puerto 53 UDP/TCP hacia CoreDNS).
- La conexión necesita permiso de **salida en el origen** y de **entrada en el destino**.
