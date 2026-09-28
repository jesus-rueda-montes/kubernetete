---
title: Kustomize
minutes: 10
---

## Qué problema resuelve

Tienes los manifiestos de tu aplicación y los despliegas en `dev` y en `pro`. Las diferencias son pocas: en `pro` hay 5 réplicas en vez de 1, otra etiqueta de imagen y un namespace distinto. Mantener dos copias completas de los YAML hace que acaben siendo diferentes sin querer. Y usar Helm para tu propia aplicación te obliga a escribir plantillas llenas de `{{ }}`.

**Kustomize** personaliza manifiestos **sin plantillas**: partes de YAML normal (la **base**) y describes solo los **cambios** de cada entorno (los **overlays**). Viene **integrado en kubectl**.

## Analogía

Es como un **documento con notas adhesivas**: el documento original (la base) no se toca; cada entorno pega encima sus notas («aquí pon 5», «cambia esta versión»). Al leerlo, ves el resultado combinado.

## Concepto

### `kustomization.yaml`

Cada directorio de Kustomize tiene un archivo `kustomization.yaml` que dice qué recursos incluye y qué transformaciones aplica.

```text
app/
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   └── service.yaml
└── overlays/
    ├── dev/
    │   └── kustomization.yaml
    └── pro/
        ├── kustomization.yaml
        └── replicas.yaml          # un parche
```

`base/kustomization.yaml`:

```yaml
resources:
  - deployment.yaml
  - service.yaml
```

`overlays/pro/kustomization.yaml`:

```yaml
resources:
  - ../../base                     # parte de la base
namespace: tienda-pro              # pone este namespace a todo
labels:
  - pairs:
      entorno: pro
images:
  - name: ghcr.io/tienda/web
    newTag: "2.3.1"                # cambia la etiqueta de la imagen
patches:
  - path: replicas.yaml            # parche con los cambios concretos
```

`overlays/pro/replicas.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web                        # identifica el objeto a modificar
spec:
  replicas: 5                      # solo lo que cambia
```

### Transformaciones habituales

| Campo | Qué hace |
|---|---|
| `resources` | Archivos o directorios que se incluyen (también otras bases). |
| `namespace` | Pone ese namespace a todos los recursos. |
| `namePrefix` / `nameSuffix` | Añade un prefijo o sufijo a los nombres. |
| `labels` | Añade labels (opcionalmente también a los selectores). |
| `images` | Cambia el nombre o la etiqueta de las imágenes. |
| `patches` | Parches parciales sobre recursos concretos. |
| `configMapGenerator` / `secretGenerator` | Generan ConfigMaps o Secrets a partir de archivos o literales. |

Los ConfigMaps y Secrets generados llevan un **sufijo con un hash** de su contenido (`app-config-7g2k9…`), y Kustomize actualiza las referencias. Así, si cambia la configuración, cambia el nombre y el Deployment **se reinicia solo** con la nueva.

### Usarlo con kubectl

```bash
kubectl kustomize overlays/pro         # muestra el YAML final, sin aplicar nada
kubectl apply -k overlays/pro          # lo aplica
```

### ¿Helm o Kustomize?

| | Helm | Kustomize |
|---|---|---|
| Enfoque | Plantillas + valores | YAML normal + parches |
| Historial y rollback | Sí (releases, `helm rollback`) | No: lo gestionas con git |
| Ideal para | **Instalar software de terceros** (charts públicos) | **Tus propias aplicaciones** con variaciones por entorno |
| Incluido en kubectl | No | Sí (`-k`) |

Se pueden combinar: por ejemplo, generar un chart con `helm template` y ajustarlo con Kustomize. Herramientas de GitOps como Argo CD y Flux soportan las dos.

## Ejemplo

```bash
kubectl kustomize overlays/pro | grep -E "namespace|replicas|image"
```

```text
  namespace: tienda-pro
  replicas: 5
        image: ghcr.io/tienda/web:2.3.1
```

Y en dev, con su propio overlay, la misma base produce 1 réplica en `tienda-dev` con otra etiqueta.

## Errores comunes

- **Copiar toda la base en cada overlay**: se pierde la gracia; el overlay solo debe contener las diferencias.
- **El parche no encuentra el objeto**: el `kind` y el `metadata.name` del parche deben coincidir con los de la base.
- **Usar `kubectl apply -f`** sobre un directorio de Kustomize: aplica los archivos sueltos, sin transformaciones. Es `-k`.
- **Editar a mano el YAML generado**: se pierde en el siguiente `apply -k`.
- **Meter secretos reales** en `secretGenerator` con literales en git.

## En la entrevista

**«¿Qué diferencia hay entre Helm y Kustomize?»**
Helm usa plantillas con valores y gestiona releases con historial y rollback; es ideal para instalar software de terceros. Kustomize parte de YAML normal y aplica overlays y parches por entorno, sin plantillas, y viene integrado en kubectl; es muy cómodo para tus propias aplicaciones.

**«¿Qué son una base y un overlay?»**
La base son los manifiestos comunes. Cada overlay referencia la base y añade solo lo que cambia en su entorno: namespace, réplicas, etiquetas de imagen o parches.

## Resumen

- **Kustomize**: YAML normal + **overlays**, sin plantillas; integrado en kubectl.
- `kustomization.yaml`: `resources`, `namespace`, `labels`, `images`, `patches`, generadores.
- Generadores con **sufijo hash** → reinicio automático al cambiar la configuración.
- **`kubectl kustomize DIR`** (ver) y **`kubectl apply -k DIR`** (aplicar).
- **Helm** para software de terceros con releases; **Kustomize** para variaciones de tus apps.
