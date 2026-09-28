---
title: Controladores y el patrón operator
minutes: 11
---

## Qué problema resuelve

Kubernetes sabe mantener vivos Pods sin estado, pero no sabe administrar software complejo: cómo hacer una **copia de seguridad** de PostgreSQL, cómo **promocionar una réplica** cuando cae la primaria, cómo **renovar un certificado** antes de que caduque. Eso lo hace normalmente una persona: el **operador humano**, siguiendo un manual.

Un **operator** es un programa que **automatiza ese conocimiento** dentro de Kubernetes, usando CRDs para que describas lo que quieres y un **controlador** que se encarga de conseguirlo.

## Analogía

Un controlador es como el **termostato** de casa: tú fijas la temperatura deseada (el `spec`); el termostato mide la real (el `status`) y enciende o apaga la calefacción hasta que coinciden. Y lo repite **continuamente**, no una sola vez.

Un operator es un **termostato especializado**: en vez de temperatura, sabe llevar una base de datos al estado que pides.

## Concepto

### El bucle de reconciliación

Todo Kubernetes funciona con **controladores** que repiten el mismo bucle:

```text
1. Observar  → leer el estado deseado (spec) y el estado real
2. Comparar  → ¿hay diferencias?
3. Actuar    → crear, cambiar o borrar lo necesario para acercar la realidad al spec
4. Informar  → actualizar el status del objeto
(y volver a empezar)
```

El controlador de Deployments hace exactamente esto: si pides 3 réplicas y hay 2, crea una. Por eso Kubernetes es **declarativo**: dices **qué** quieres, no **cómo** llegar.

- **`spec`**: lo que **tú pides**.
- **`status`**: lo que **el controlador informa** que hay.

### Operator = CRD + controlador

Un **operator** combina:

1. Una o varias **CRDs** para describir la aplicación (`Cluster`, `Backup`, `Certificate`…).
2. Un **controlador** (un Deployment en el clúster) que vigila esos objetos y reconcilia: crea StatefulSets, Services, Secrets, Jobs de backup, hace failovers…

Ejemplos conocidos:

| Operator | Qué automatiza | Custom resources |
|---|---|---|
| **cert-manager** | Certificados TLS (Let's Encrypt u otras autoridades) y su renovación | `Certificate`, `Issuer` |
| **Prometheus Operator** | Despliegue de Prometheus y qué monitorizar | `Prometheus`, `ServiceMonitor` |
| **CloudNativePG** | Clústeres de PostgreSQL: réplicas, failover, backups | `Cluster`, `Backup` |

Se escriben normalmente en Go con frameworks como **Kubebuilder** u **Operator SDK**.

### Cuándo usar (o no) un operator

A favor:

- Software **con estado** y operaciones complejas (bases de datos, colas).
- Operaciones repetitivas que hoy hace una persona.

En contra:

- Añades un componente más que **mantener y actualizar**.
- Suelen necesitar **permisos amplios** en el clúster: revisa su RBAC.
- Para una base de datos crítica, a veces es más sencillo un servicio gestionado (Cloud SQL) que operarla dentro del clúster.

## Ejemplo

Con cert-manager instalado, pedir un certificado es declarar un objeto:

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: web-tls
  namespace: tienda
spec:
  secretName: web-tls                  # dónde guardará el certificado
  dnsNames:
    - tienda.example.com
  issuerRef:
    name: letsencrypt
    kind: ClusterIssuer
```

```bash
kubectl get certificate web-tls -n tienda
```

```text
NAME      READY   SECRET    AGE
web-tls   True    web-tls   2m
```

El controlador de cert-manager ha pedido el certificado, lo ha guardado en el Secret `web-tls` y **lo renovará solo** antes de que caduque. La columna `READY` sale del `status`.

## Errores comunes

- **Desinstalar el operator y dejar sus custom resources**: nadie los reconcilia; y si borras las CRDs, se borran todos.
- **Editar a mano los objetos que crea un operator** (el StatefulSet de la base de datos): el operator los devuelve a lo que diga su custom resource.
- **Ignorar el `status`** y los eventos del custom resource: ahí explica el operator por qué algo no funciona.
- **Instalar operators sin revisar** qué permisos piden ni quién los mantiene.

## En la entrevista

**«¿Qué es un operator?»**
Un patrón para automatizar la gestión de una aplicación dentro de Kubernetes: CRDs que describen lo que quieres y un controlador que reconcilia continuamente el estado real con el deseado, codificando el conocimiento de un operador humano (despliegue, backups, failover, actualizaciones).

**«¿Qué es el bucle de reconciliación?»**
El funcionamiento de todos los controladores: observar el estado deseado y el real, comparar y actuar para acercarlos, informando en el `status`, una y otra vez. Es lo que hace a Kubernetes declarativo y autorreparable.

## Resumen

- **Controlador**: bucle **observar → comparar → actuar → informar**, continuo.
- **`spec`** = lo que pides; **`status`** = lo que hay.
- **Operator** = **CRDs + controlador** que automatiza la operación de una aplicación.
- Ejemplos: **cert-manager**, **Prometheus Operator**, **CloudNativePG**.
- Útiles para software con estado; cuidado con sus **permisos** y su mantenimiento.
