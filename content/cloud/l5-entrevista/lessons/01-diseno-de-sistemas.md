---
title: Cómo responder a una pregunta de diseño
minutes: 15
---

## Qué problema resuelve

En las entrevistas de cloud, DevOps o plataforma casi siempre hay una pregunta abierta: **«Diseña la infraestructura de una tienda online en GCP»**. Tienes 30-45 minutos, una pizarra y ninguna respuesta única. Mucha gente se bloquea o empieza a nombrar servicios sin orden.

Lo que se evalúa no es acertar «el diseño correcto», sino **cómo razonas**: qué preguntas haces, cómo priorizas y si conoces las contrapartidas de cada decisión.

## Analogía

Es como un **arquitecto** al que le encargan un edificio. Antes de dibujar, pregunta cuánta gente vivirá, el presupuesto y las normas de la zona. Después hace un **boceto** general y lo va **detallando** planta a planta, explicando por qué elige cada material.

## Concepto

### Un método en cinco pasos

1. **Requisitos** (5 minutos). Pregunta antes de dibujar:
   - **Funcionales**: qué hace el sistema (catálogo, carrito, pagos…).
   - **No funcionales**: usuarios y picos de tráfico, **disponibilidad** (SLO), latencia, **RTO/RPO**, normativa (datos en la UE), presupuesto.
2. **Diseño de alto nivel**: cajas y flechas. Usuarios → borde (DNS, balanceador, CDN, WAF) → cómputo → datos → procesos asíncronos.
3. **Detalle** de las piezas críticas: la base de datos, cómo escala el cómputo, cómo se despliega.
4. **Aspectos transversales**: seguridad, observabilidad, costes, CI/CD e infraestructura como código.
5. **Contrapartidas y evolución**: qué sacrificas, qué pasa si el tráfico se multiplica por 10, qué harías distinto con más presupuesto.

### Los pilares del Well-Architected Framework

Google Cloud (igual que AWS y Azure) organiza las buenas prácticas en pilares. Te sirven de **lista de comprobación** para el paso 4:

- **Excelencia operativa**: automatización, IaC, CI/CD, observabilidad.
- **Seguridad, privacidad y cumplimiento**: IAM de mínimo privilegio, cifrado, redes privadas, auditoría.
- **Fiabilidad**: redundancia en zonas y regiones, autoescalado, copias, DR.
- **Optimización de costes**: tamaño correcto, descuentos, escalar a cero, presupuestos.
- **Optimización del rendimiento**: caché, CDN, elegir la base de datos adecuada.
- **Sostenibilidad**: regiones con energía más limpia, no desperdiciar recursos.

### Arquitectura web de referencia en GCP

```text
Usuarios
   │  Cloud DNS
   ▼
Application Load Balancer externo global  ← Cloud Armor (WAF) + Cloud CDN (estáticos)
   │
   ▼
Cloud Run (o GKE) en 1-2 regiones, autoescalado
   │            │                      │
   ▼            ▼                      ▼
Cloud SQL HA   Memorystore (caché)    Cloud Storage (imágenes, backups)
(+ réplica de lectura / réplica en otra región)
   │
Pub/Sub → procesos asíncronos (emails, facturas) en Cloud Run functions o jobs

Transversal: IAM con cuentas de servicio por servicio · Secret Manager ·
VPC privada + Private Service Connect · Cloud Logging/Monitoring con SLOs ·
Terraform + Cloud Build/Cloud Deploy · presupuestos y etiquetas
```

Justificaciones que conviene decir en voz alta:

- **Cloud Run** si la aplicación es sin estado y tiene picos: escala solo y a cero. **GKE** si hay muchos servicios, necesidades especiales o el equipo ya usa Kubernetes.
- **Cloud SQL HA** para no perder la base de datos si cae una zona; **réplicas de lectura** si hay muchas lecturas.
- **Pub/Sub** para desacoplar: si el servicio de emails cae, los pedidos siguen entrando.
- **CDN y caché** para bajar la latencia y la carga de la base de datos.

## Ejemplo

Primeros minutos de una buena respuesta:

```text
Entrevistador: Diseña la infraestructura de una tienda online en GCP.

Tú: Antes de dibujar, unas preguntas:
    - ¿Cuántos usuarios y qué picos? (p. ej. Black Friday x10)
    - ¿Qué disponibilidad se espera? ¿99,9 %?
    - ¿Cuánto tiempo puede estar caída (RTO) y cuántos datos perder (RPO)?
    - ¿Clientes solo en Europa? ¿Datos que deban quedarse en la UE?
    - ¿El equipo tiene experiencia con Kubernetes?

Entrevistador: 50.000 usuarios al día, picos x10, 99,9 %, RTO 1 hora,
               RPO 5 minutos, solo Europa, equipo pequeño sin Kubernetes.

Tú: Entonces empezaría con una región europea, Cloud Run por el equipo pequeño
    y los picos, Cloud SQL HA con PITR para el RPO, y una réplica en otra región
    europea para cumplir el RTO si cae la región...
```

## Errores comunes

- **Empezar a dibujar sin preguntar**: diseñas para requisitos que no existen.
- **Sobrediseñar**: multirregión activo-activo para una tienda con 99,9 % y un equipo de tres personas.
- **Nombrar servicios sin justificar**: cada caja necesita un «porque».
- **Olvidar lo transversal**: seguridad, observabilidad, costes y cómo se despliega.
- **No mencionar contrapartidas**: más disponibilidad cuesta más dinero y más complejidad.
- **Quedarse en silencio**: piensa en voz alta; el entrevistador quiere ver tu razonamiento.

## En la entrevista

**«¿Cloud Run o GKE para este sistema?»**
Depende del equipo y de la carga. Cloud Run si son servicios HTTP sin estado, el equipo es pequeño y hay picos: menos operación y escala a cero. GKE si hay muchos microservicios, cargas con estado, necesidades de red o hardware especiales, o el equipo ya domina Kubernetes. Se puede empezar con Cloud Run y migrar, porque ambos usan contenedores.

**«¿Cómo escalaría tu diseño si el tráfico se multiplica por 10?»**
El cómputo escala solo (Cloud Run o HPA + Cluster Autoscaler). El cuello de botella suele ser la base de datos: más caché, réplicas de lectura, colas para lo que no es inmediato y, si hace falta, una base de datos que escale horizontalmente como Spanner. Revisaría cuotas y haría pruebas de carga antes.

## Resumen

- Método: **requisitos → alto nivel → detalle → transversal → contrapartidas**.
- Pregunta siempre por tráfico, **SLO**, **RTO/RPO**, normativa, presupuesto y equipo.
- Pilares: operaciones, seguridad, fiabilidad, costes, rendimiento y sostenibilidad.
- Referencia GCP: DNS → **balanceador global + Cloud Armor + CDN** → **Cloud Run/GKE** → **Cloud SQL HA**, caché, Cloud Storage, **Pub/Sub**.
- Justifica cada caja, piensa en voz alta y no sobrediseñes.
