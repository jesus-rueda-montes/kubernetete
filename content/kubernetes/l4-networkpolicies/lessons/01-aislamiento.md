---
title: Aislar Pods con NetworkPolicies
minutes: 11
---

## Qué problema resuelve

Por defecto, en Kubernetes **cualquier Pod puede conectarse con cualquier otro Pod**, en cualquier namespace. Si un atacante entra en el frontend, puede conectarse directamente a la base de datos, a los Pods de otro equipo o a herramientas internas.

Una **NetworkPolicy** es un **firewall a nivel de Pod**: define qué tráfico puede **entrar** en unos Pods (*ingress*) y qué tráfico puede **salir** de ellos (*egress*).

## Analogía

Sin políticas, el clúster es una **oficina diáfana**: cualquiera puede acercarse a cualquier mesa. Una NetworkPolicy convierte una zona en un **despacho con lista de invitados**: solo entra quien está en la lista, y el resto ni siquiera puede llamar a la puerta.

## Concepto

### Requisito: el plugin de red

Las NetworkPolicies las aplica el **plugin de red** (CNI) del clúster. Si el plugin **no las soporta**, puedes crear políticas y **no pasará nada**: no dan error, simplemente se ignoran. Calico y Cilium las soportan; en GKE las aplica **GKE Dataplane V2** (activado por defecto en Autopilot).

### Pods aislados y no aislados

- Un Pod que **ninguna** política selecciona está **no aislado**: acepta todo y puede enviar a cualquier sitio.
- En cuanto una política con `Ingress` en `policyTypes` **selecciona** un Pod, ese Pod pasa a estar **aislado para la entrada**: solo entra lo que alguna política permita.
- Lo mismo para la salida con `Egress`.
- Las políticas **se suman**: si varias seleccionan un Pod, se permite todo lo que permita cualquiera de ellas. No hay reglas de denegar.
- El tráfico de **respuesta** de una conexión permitida siempre se permite.

### Estructura

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-solo-desde-api
  namespace: tienda
spec:
  podSelector:                 # A QUÉ Pods se aplica (en este namespace)
    matchLabels:
      app: db
  policyTypes: [Ingress]       # qué direcciones se controlan
  ingress:
    - from:                    # DESDE dónde se permite entrar
        - podSelector:
            matchLabels:
              app: api
      ports:
        - protocol: TCP
          port: 5432
```

- `spec.podSelector` elige los Pods protegidos. **`podSelector: {}`** (vacío) = **todos** los Pods del namespace.
- `ingress[].from` y `egress[].to` dicen el origen o destino permitido, y `ports` los puertos.

### «Denegar por defecto»

La práctica recomendada es empezar cerrando todo en el namespace y abrir solo lo necesario:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: denegar-entrada
  namespace: tienda
spec:
  podSelector: {}              # todos los Pods del namespace
  policyTypes: [Ingress]       # aislados para la entrada...
                               # ...y sin reglas "ingress": no entra nada
```

Después se añaden políticas que permiten los flujos concretos (del Ingress controller a la web, de la web a la API, de la API a la base de datos).

## Ejemplo

Tres capas en el namespace `tienda`: `web` → `api` → `db`.

```yaml
# 1. Nada entra por defecto
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: denegar-entrada
  namespace: tienda
spec:
  podSelector: {}
  policyTypes: [Ingress]
---
# 2. La API solo acepta tráfico de la web, en el 8080
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-desde-web
  namespace: tienda
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: web
      ports:
        - protocol: TCP
          port: 8080
---
# 3. La base de datos solo acepta tráfico de la API, en el 5432
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-desde-api
  namespace: tienda
spec:
  podSelector:
    matchLabels:
      app: db
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api
      ports:
        - protocol: TCP
          port: 5432
```

```bash
kubectl get networkpolicies -n tienda
kubectl describe networkpolicy db-desde-api -n tienda
```

Ojo: con estas tres políticas, **nada puede llegar a `web`**, ni siquiera el Ingress controller, que vive en otro namespace. Para permitirlo hace falta un `namespaceSelector`, que verás en la siguiente lección.

## Errores comunes

- **Crear políticas en un clúster cuyo plugin no las soporta**: no hay error, pero no protegen nada.
- **Pensar que una política «solo añade una regla»**: en cuanto selecciona un Pod, **todo lo demás** hacia ese Pod queda bloqueado.
- **`podSelector: {}` sin querer**: se aplica a todos los Pods del namespace.
- **Olvidar que las etiquetas deben coincidir**: si los Pods de la API tienen `app: backend` y la política espera `app: api`, el tráfico se bloquea.
- **Buscar una regla de «denegar»**: igual que RBAC, las políticas solo suman permisos.

## En la entrevista

**«¿Qué hace una NetworkPolicy y qué necesita para funcionar?»**
Controla el tráfico de entrada y salida de los Pods que selecciona, por labels de Pods, de namespaces o por rangos IP, y por puerto. Necesita un plugin de red que las aplique, como Calico, Cilium o GKE Dataplane V2; si no, se ignoran sin dar error.

**«¿Cómo aislarías un namespace?»**
Con una política de denegar por defecto (`podSelector: {}` con `policyTypes: [Ingress]`, y también `Egress` si quiero controlar la salida) y después políticas que permiten solo los flujos necesarios.

## Resumen

- Por defecto, **todo Pod habla con todo Pod**.
- Las NetworkPolicies las aplica el **plugin de red**; sin soporte, se **ignoran**.
- Un Pod seleccionado por una política queda **aislado** en esa dirección; las políticas **se suman**.
- `spec.podSelector` = a quién se aplica; `from`/`to` + `ports` = qué se permite.
- Patrón: **denegar por defecto** (`podSelector: {}`) y abrir solo lo necesario.
