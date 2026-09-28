---
title: SLIs, SLOs y alertas útiles
minutes: 11
---

## Qué problema resuelve

«La web tiene que estar siempre disponible» no es un objetivo realista ni medible. Si intentas el 100 %, nunca puedes desplegar nada, porque cada cambio es un riesgo. Y si no mides nada, no sabes si vas bien o mal hasta que se queja un cliente.

La práctica de **SRE** (*Site Reliability Engineering*, de Google) propone definir **qué es «funcionar bien»** con números (**SLIs** y **SLOs**) y usar el margen que queda (el **presupuesto de error**) para decidir cuándo arriesgar y cuándo frenar.

## Analogía

Es como un **presupuesto mensual de gastos**: si te has fijado gastar como máximo 300 € en ocio y a mitad de mes llevas 50 €, puedes permitirte un capricho. Si ya llevas 290 €, toca frenar. El presupuesto de error funciona igual con los fallos: mientras quede, puedes desplegar novedades; si se agota, toca estabilizar.

## Concepto

### SLI, SLO y SLA

| Término | Qué es | Ejemplo |
|---|---|---|
| **SLI** (indicador) | Una **medida** de la calidad del servicio | % de peticiones con respuesta correcta en menos de 300 ms |
| **SLO** (objetivo) | El **valor objetivo** del SLI en un periodo | 99,9 % en 30 días |
| **SLA** (acuerdo) | Un **compromiso con el cliente**, con consecuencias (reembolsos) | 99,5 % mensual o devolvemos el 10 % |

- El SLO interno suele ser **más exigente** que el SLA: así te enteras antes de incumplir el contrato.
- Los SLIs se miden **desde el punto de vista del usuario**: disponibilidad y latencia de las peticiones, no el uso de CPU.

### Presupuesto de error

Con un SLO del **99,9 %**, puedes «fallar» el **0,1 %**. En 30 días:

```text
30 días × 24 h × 60 min = 43 200 minutos
0,1 % de 43 200 = 43,2 minutos de fallo permitidos al mes
```

- Si queda presupuesto: se despliega con normalidad y se asumen riesgos.
- Si se está agotando: se frenan los despliegues arriesgados y se prioriza la fiabilidad.

Cada «nueve» extra cuesta mucho más: 99,99 % son solo **unos 4 minutos** al mes.

### Las cuatro señales doradas

Para un servicio, el libro de SRE de Google recomienda vigilar:

1. **Latencia**: cuánto tardan las peticiones (distinguiendo las correctas de las fallidas).
2. **Tráfico**: cuántas peticiones llegan.
3. **Errores**: cuántas fallan.
4. **Saturación**: lo lleno que está el sistema (CPU, memoria, colas).

### Alertas útiles

- Alerta sobre **síntomas que notan los usuarios** (errores, latencia, SLO en riesgo), no sobre cada causa posible (una CPU alta que no afecta a nadie).
- Mejor aún: alerta por la **velocidad de consumo del presupuesto de error** (*burn rate*): «a este ritmo, agotaremos el presupuesto del mes en 2 días».
- Cada alerta debe ser **accionable**: quien la recibe tiene que saber qué hacer.
- Cloud Monitoring permite definir **SLOs** de un servicio y **alertas sobre su burn rate**.

## Ejemplo

API de pedidos:

```text
SLI:  proporción de peticiones HTTP a /api/pedidos con código < 500
      y respondidas en menos de 300 ms
SLO:  99,9 % en una ventana de 30 días
Presupuesto: 0,1 % de las peticiones (con 10 millones/mes → 10 000 peticiones "malas")

Alertas:
- Burn rate alto (se agotaría en horas)   → aviso inmediato a la persona de guardia
- Burn rate moderado (se agotaría en días) → ticket para revisar en horario laboral
```

## Errores comunes

- **SLO del 100 %**: imposible y paraliza los cambios.
- **SLIs internos** (CPU, memoria) en vez de lo que vive el usuario.
- **SLO igual al SLA**: no deja margen para reaccionar antes de incumplir el contrato.
- **Alertas no accionables** o demasiadas: fatiga, y la alerta importante se ignora.
- **Medir solo la media de latencia**: esconde a los usuarios lentos. Usa percentiles (p95, p99).

## En la entrevista

**«¿Qué diferencia hay entre SLI, SLO y SLA?»**
El SLI es la medida (por ejemplo, el porcentaje de peticiones correctas y rápidas). El SLO es el objetivo interno para ese SLI (99,9 % en 30 días). El SLA es el compromiso contractual con el cliente, con penalizaciones, y suele ser menos exigente que el SLO.

**«¿Qué es un presupuesto de error y para qué sirve?»**
El margen de fallo que permite el SLO (con 99,9 %, unos 43 minutos al mes). Sirve para equilibrar velocidad y fiabilidad: si queda presupuesto, se despliega; si se agota, se prioriza estabilizar. Las alertas por burn rate avisan cuando se consume demasiado rápido.

## Resumen

- **SLI** = medida; **SLO** = objetivo; **SLA** = contrato (menos exigente que el SLO).
- **Presupuesto de error** = 100 % − SLO; 99,9 % ≈ **43 minutos al mes**.
- **Cuatro señales doradas**: latencia, tráfico, errores, saturación.
- Alertas sobre **síntomas del usuario** y por **burn rate**, siempre **accionables**.
- Latencia con **percentiles**, no con la media.
