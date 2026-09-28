---
title: ¿Por qué Kubernetes?
minutes: 8
---

## Qué problema resuelve

Con uno o dos contenedores en un servidor, puedes arrancarlos a mano. Con **cientos de contenedores repartidos en decenas de máquinas**, aparecen preguntas difíciles:

- ¿En qué máquina arranco cada contenedor para aprovechar bien la CPU y la memoria?
- Si un contenedor se cae a las 3 de la mañana, ¿quién lo vuelve a arrancar?
- Si una máquina entera falla, ¿quién mueve sus contenedores a otra?
- ¿Cómo actualizo la aplicación a una nueva versión sin cortar el servicio?
- ¿Cómo encuentran unos contenedores a otros si cambian de máquina y de IP?

Un **orquestador de contenedores** responde a todo esto de forma automática. **Kubernetes** (abreviado **K8s**: una K, 8 letras y una s) es el orquestador más usado. Nació en Google y hoy lo mantiene la Cloud Native Computing Foundation (CNCF).

## Analogía

Piensa en un **termostato**. No le dices «enciende la calefacción 20 minutos»: le dices «quiero 21 °C». El termostato mide la temperatura una y otra vez y enciende o apaga la calefacción hasta conseguirlo. Si abres una ventana, vuelve a corregir sin que hagas nada.

Kubernetes funciona igual: le dices **cómo quieres que esté** tu sistema («3 copias de mi web») y él trabaja continuamente para que la realidad coincida.

## Concepto

### Modelo declarativo

Hay dos formas de dar órdenes a un sistema:

| Imperativo | Declarativo |
|---|---|
| Dices **los pasos**: «arranca un contenedor, luego otro, luego otro». | Dices **el resultado**: «quiero 3 réplicas». |
| Si algo falla a mitad, tienes que arreglarlo tú. | El sistema detecta la diferencia y la corrige solo. |

Kubernetes es **declarativo**. Describes el **estado deseado** en un **manifest** (un archivo YAML) y se lo envías al clúster. Cada objeto de Kubernetes tiene dos partes clave:

- `spec`: lo que **quieres** (lo escribes tú).
- `status`: lo que **hay** ahora mismo (lo rellena Kubernetes).

### Bucles de reconciliación

Dentro de Kubernetes, unos programas llamados **controllers** repiten sin parar el mismo ciclo:

1. **Observar** el estado actual.
2. **Comparar** con el estado deseado.
3. **Actuar** para acercar uno al otro.

A esto se le llama **bucle de reconciliación** (*reconciliation loop*). Por eso Kubernetes «se cura solo»: si un Pod de tus 3 réplicas desaparece, un controller lo nota y crea otro.

### Qué te da Kubernetes

- **Scheduling**: decide en qué máquina se ejecuta cada contenedor.
- **Autorreparación** (*self-healing*): reinicia y sustituye lo que falla.
- **Escalado**: más o menos copias, a mano o automáticamente.
- **Service discovery y balanceo**: nombres estables para llegar a tus aplicaciones.
- **Despliegues progresivos** (*rolling updates*) y vuelta atrás (*rollback*).
- **Configuración y secretos** separados de la imagen.

Lo que **no** hace: no compila tu código ni crea imágenes, y no sustituye a tu base de datos gestionada ni a tu sistema de CI.

## Ejemplo

El mismo objetivo expresado de las dos formas:

```bash
# Imperativo: órdenes paso a paso
kubectl run web --image=nginx:1.27   # "crea este Pod ahora"
kubectl delete pod web               # "bórralo ahora"
```

```yaml
# Declarativo: describes el estado final (lo verás a fondo con los Deployments)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3            # estado deseado: 3 copias, siempre
  selector:
    matchLabels:
      app: web
  template:              # molde de cada Pod
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
```

```bash
kubectl apply -f web.yaml   # "haz que el clúster se parezca a este archivo"
```

Si luego cambias `replicas: 3` por `replicas: 5` y vuelves a ejecutar `kubectl apply`, Kubernetes crea solo las 2 que faltan.

## Errores comunes

- **Pensar que Kubernetes ejecuta contenedores sueltos.** La unidad mínima es el Pod, que envuelve uno o varios contenedores.
- **Arreglar cosas a mano en el clúster** y no en el manifest. El siguiente `apply` (o el propio controller) deshará tu cambio o lo dejará desincronizado del repositorio.
- **Confundir `spec` y `status`.** Tú escribes `spec`; `status` lo escribe Kubernetes.
- **Usar Kubernetes para todo.** Para una aplicación pequeña, un servicio gestionado más sencillo (por ejemplo, un servicio *serverless*) puede ser mejor opción.

## En la entrevista

**«¿Qué significa que Kubernetes es declarativo?»**
Que describes el estado deseado (por ejemplo, 3 réplicas de una imagen concreta) y los controllers comparan continuamente ese estado con el real y actúan para igualarlos. No das la secuencia de pasos.

**«¿Qué pasa si borras a mano un Pod que pertenece a un Deployment?»**
El controller detecta que hay menos réplicas de las deseadas y crea un Pod nuevo, con otro nombre y otra IP.

## Resumen

- Kubernetes es un **orquestador**: coloca, vigila, escala y actualiza contenedores en muchas máquinas.
- Es **declarativo**: escribes el estado deseado (`spec`) y Kubernetes informa del real (`status`).
- Los **controllers** ejecutan **bucles de reconciliación**: observar, comparar y actuar.
- Gracias a eso se **autorrepara**: lo que falla se sustituye solo.
