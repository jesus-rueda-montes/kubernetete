---
title: Qué es (y qué no es) la nube
minutes: 8
---

## Qué problema resuelve

Antes de la nube, lanzar una aplicación significaba **comprar servidores**: esperar semanas a que llegaran, instalarlos en un centro de datos, calcular cuántos harían falta dentro de dos años… Si te quedabas corto, la web se caía en el pico de ventas; si te pasabas, pagabas máquinas apagadas.

La **nube** (*cloud computing*) te permite **alquilar recursos informáticos por internet, al momento y pagando por uso**: máquinas, almacenamiento, bases de datos, redes…

## Analogía

Es la diferencia entre **tener un generador eléctrico en casa** y **enchufarte a la red eléctrica**. Con el generador compras, mantienes y dimensionas tú el equipo. Con la red, enchufas lo que necesitas y pagas los kWh que consumes; de la central se encarga otro.

## Concepto

### Definición (NIST)

La definición de referencia la da el NIST (instituto de estándares de EE. UU.): la nube es un modelo que permite acceder por red, de forma cómoda y bajo demanda, a un conjunto compartido de recursos configurables que se asignan y liberan rápidamente con un mínimo esfuerzo de gestión. Tiene **cinco características esenciales**:

| Característica | Qué significa en la práctica |
|---|---|
| **Autoservicio bajo demanda** | Creas una máquina tú mismo, desde una consola o una API, sin llamar a nadie. |
| **Acceso amplio por red** | Se usa por internet, desde cualquier dispositivo. |
| **Recursos compartidos** (*resource pooling*) | El proveedor sirve a muchos clientes con el mismo hardware, de forma aislada. |
| **Elasticidad rápida** | Puedes crecer o encoger en minutos, incluso automáticamente. |
| **Servicio medido** | Se mide el consumo y pagas por lo que usas. |

### CapEx frente a OpEx

- **CapEx** (*capital expenditure*): gasto de inversión. Comprar servidores por adelantado.
- **OpEx** (*operational expenditure*): gasto operativo. Pagar mes a mes por lo consumido.

La nube convierte gran parte del CapEx en **OpEx**. No significa automáticamente «más barato»: significa **pagar por uso** y poder empezar sin inversión inicial.

### Modelos de despliegue

| Modelo | Descripción |
|---|---|
| **Nube pública** | Recursos de un proveedor (Google Cloud, AWS, Azure) compartidos por muchos clientes. |
| **Nube privada** | Infraestructura de nube dedicada a una sola organización (en su centro de datos o en el de un tercero). |
| **Híbrida** | Combinación de nube pública con infraestructura propia, conectadas. |
| **Multicloud** | Uso de varios proveedores públicos a la vez (por ejemplo, GCP y AWS). |

(El NIST define además la *nube comunitaria*, compartida por organizaciones con necesidades comunes. Es poco habitual.)

### Los tres grandes proveedores

**Google Cloud (GCP)**, **Amazon Web Services (AWS)** y **Microsoft Azure**. Los conceptos son casi los mismos; cambian los nombres de los servicios. En esta app usamos GCP como referencia y, al final del itinerario, verás las equivalencias.

## Ejemplo

Una tienda online con un pico de tráfico en el Black Friday:

- **Sin nube**: compra servidores para aguantar el pico. El resto del año, el 80 % de esa capacidad está sin usar, pero ya está pagada.
- **Con nube**: funciona todo el año con 3 máquinas; durante el Black Friday, un escalado automático sube a 20, y el lunes vuelve a 3. Paga las 20 máquinas **solo esos días**.

Eso es **elasticidad** y **servicio medido** en acción.

## Errores comunes

- **«La nube es el ordenador de otro» y nada más.** Lo importante no es dónde está el hardware, sino el **autoservicio, la elasticidad y el pago por uso** mediante APIs.
- **Pensar que la nube siempre es más barata.** Una máquina encendida 24/7 con recursos de sobra puede salir cara. El ahorro llega al **ajustar** los recursos a la demanda.
- **Confundir híbrida con multicloud.** Híbrida = pública + infraestructura propia; multicloud = varios proveedores públicos.
- **Creer que en la nube la seguridad es cosa del proveedor.** Una parte es tuya (lo verás en la siguiente lección).

## En la entrevista

**«¿Qué ventajas tiene la nube frente a un centro de datos propio?»**
Autoservicio y rapidez para crear recursos, elasticidad para ajustarse a la demanda, pago por uso (OpEx en lugar de CapEx), alcance global y acceso a servicios gestionados sin mantener el hardware.

**«¿Diferencia entre nube híbrida y multicloud?»**
Híbrida combina nube pública con infraestructura propia (on-premises o privada). Multicloud usa varios proveedores públicos. Una empresa puede ser ambas cosas a la vez.

## Resumen

- La nube es **alquilar recursos informáticos bajo demanda, por red y pagando por uso**.
- Cinco características: **autoservicio, acceso por red, recursos compartidos, elasticidad y servicio medido**.
- Pasa gasto de **CapEx a OpEx**, lo que no siempre equivale a más barato.
- Modelos: **pública, privada, híbrida** y **multicloud**.
- GCP, AWS y Azure comparten conceptos; cambian los nombres.
