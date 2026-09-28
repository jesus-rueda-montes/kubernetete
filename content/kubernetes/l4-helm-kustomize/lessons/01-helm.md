---
title: Helm
minutes: 12
---

## Qué problema resuelve

Instalar una aplicación real en Kubernetes (una base de datos, un Ingress controller, Prometheus) supone decenas de manifiestos: Deployments, Services, ConfigMaps, RBAC, CRDs… Y cada entorno necesita **valores distintos**: réplicas, tamaño de disco, dominio. Copiar los YAML y editarlos a mano no escala, y deshacer un despliegue fallido tampoco es trivial.

**Helm** es el **gestor de paquetes** de Kubernetes: empaqueta manifiestos con **plantillas** y **valores configurables**, los instala con un comando y guarda un **historial** para poder volver atrás.

## Analogía

Helm es como **apt** o **npm** para Kubernetes:

- Un **chart** es el **paquete** (la receta).
- Los **values** son las **opciones de instalación**.
- Una **release** es **una instalación concreta** de ese paquete en tu clúster; puedes tener varias del mismo chart (por ejemplo, `redis-cache` y `redis-sesiones`).

## Concepto

### Estructura de un chart

```text
mi-web/
├── Chart.yaml          # nombre, versión del chart, versión de la app, dependencias
├── values.yaml         # valores por defecto
└── templates/          # manifiestos con plantillas
    ├── deployment.yaml
    ├── service.yaml
    └── _helpers.tpl    # trozos reutilizables
```

Las plantillas usan la sintaxis de **Go templates**:

```yaml
# templates/deployment.yaml
spec:
  replicas: {{ .Values.replicas }}
  template:
    spec:
      containers:
        - name: web
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
```

```yaml
# values.yaml
replicas: 2
image:
  repository: nginx
  tag: "1.27"
```

### Valores: de dónde salen

Por orden de prioridad (el último gana):

1. `values.yaml` del chart.
2. Archivos con **`-f valores-pro.yaml`** (si pasas varios, gana el último).
3. **`--set clave=valor`** en la línea de comandos.

Consejo: guarda los valores de cada entorno en archivos versionados en git; usa `--set` solo para casos puntuales.

### El ciclo de vida

| Comando | Qué hace |
|---|---|
| `helm repo add NOMBRE URL` y `helm repo update` | Añade un repositorio de charts y actualiza su índice. |
| `helm install RELEASE CHART` | Instala una release nueva. |
| `helm upgrade RELEASE CHART` | Aplica una versión nueva del chart o valores nuevos. Crea una **revisión**. |
| `helm upgrade --install ...` | Instala si no existe, actualiza si existe: ideal en pipelines. |
| `helm history RELEASE` | Lista las revisiones. |
| `helm rollback RELEASE [REVISIÓN]` | Vuelve a una revisión anterior (sin número, a la anterior). |
| `helm uninstall RELEASE` | Borra los recursos de la release. |
| `helm template ...` | Genera los YAML **en local**, sin tocar el clúster. |

Opciones útiles:

- **`--version`**: fija la versión del chart. Sin ella, se instala la última.
- **`--wait`**: espera a que los recursos estén listos antes de dar la operación por buena.
- **`--rollback-on-failure`** (en Helm 3 se llamaba `--atomic`): si falla, deshace la operación.
- **`-n NAMESPACE --create-namespace`**: la release vive en un namespace.

Los charts también se publican en **registros OCI** (los mismos que las imágenes): `helm install web oci://registro/charts/web --version 1.2.0`.

## Ejemplo

Instalar el Ingress controller Traefik en su namespace, con una versión fijada y tus valores:

```bash
helm repo add traefik https://traefik.github.io/charts
helm repo update
helm show values traefik/traefik > valores-por-defecto.yaml   # qué se puede configurar

helm upgrade --install traefik traefik/traefik   -n traefik --create-namespace   --version 41.6.0   -f valores-pro.yaml   --wait

helm list -n traefik
helm history traefik -n traefik
helm rollback traefik 1 -n traefik      # si la nueva versión da problemas
```

## Errores comunes

- **No fijar `--version`**: el mismo comando instala hoy una versión y mañana otra.
- **Configurar todo con `--set`**: nadie sabe después qué valores tiene la release. Usa archivos de valores en git.
- **Editar a mano los recursos** que gestiona Helm con `kubectl edit`: el siguiente `upgrade` los sobrescribe.
- **Olvidar `-n`**: Helm busca la release en el namespace actual y dice que no existe.
- **Subir secretos en `values.yaml`** al repositorio.
- **Usar `helm install` en un pipeline**: la segunda vez falla porque la release ya existe. Usa `upgrade --install`.

## En la entrevista

**«¿Qué es Helm y qué es una release?»**
El gestor de paquetes de Kubernetes. Un chart es un paquete de plantillas con valores por defecto; una release es una instalación de un chart en el clúster, con su historial de revisiones. Permite parametrizar por entorno con archivos de valores y volver atrás con `helm rollback`.

**«¿Cómo desplegarías con Helm desde un pipeline?»**
Con `helm upgrade --install`, la versión del chart fijada, un archivo de valores por entorno versionado en git, `--wait` y `--rollback-on-failure` (antes `--atomic`) para que un despliegue fallido se deshaga solo. Antes, `helm lint` y `helm template` para revisar los manifiestos.

## Resumen

- **Chart** (paquete: `Chart.yaml`, `values.yaml`, `templates/`), **values** (configuración), **release** (instalación con revisiones).
- Prioridad: `values.yaml` < `-f archivo` < `--set`.
- `install`, `upgrade --install`, `history`, `rollback`, `uninstall`, `template`.
- Fija **`--version`**; usa **`--wait`** y **`--rollback-on-failure`** en pipelines.
- Charts en repositorios o en registros **OCI**.
