---
title: YAML paso a paso
minutes: 10
---

## Qué problema resuelve

Kubernetes, Ansible, los pipelines de CI (GitHub Actions, Cloud Build) y muchas herramientas más se configuran con **YAML**. Es fácil de leer, pero tiene trampas: un espacio de más, un tabulador o un `no` sin comillas pueden romper una configuración o, peor, **cambiar su significado sin dar error**.

## Analogía

YAML es como un **esquema con sangrías** en un cuaderno: lo que está más a la derecha **pertenece** a lo que tiene encima. Si te equivocas de sangría, una idea acaba colgando del apartado equivocado.

## Concepto

YAML describe datos con tres piezas:

### 1. Mapas (clave: valor)

```yaml
nombre: web
puerto: 80
```

- Después de los dos puntos va **un espacio**.
- Las claves de un mismo mapa no pueden repetirse.

### 2. Listas

Cada elemento empieza por **guion y espacio**:

```yaml
puertos:
  - 80
  - 443
```

### 3. Anidación con indentación

La indentación (**solo espacios, nunca tabuladores**) indica qué contiene qué. Lo habitual son 2 espacios.

```yaml
contenedores:          # un mapa con la clave "contenedores"...
  - nombre: web        # ...cuyo valor es una lista de mapas
    imagen: nginx      # "imagen" pertenece al mismo elemento que "nombre"
  - nombre: logs
    imagen: busybox
```

Fíjate: `imagen` está alineada con `nombre` (no con el guion). Ambas son claves **del mismo elemento** de la lista.

### Tipos de valor

| Escribes | YAML entiende |
|---|---|
| `80` | número |
| `"80"` | texto |
| `true`, `false` | booleano |
| `null` o `~` | nulo |
| `1.27` | número decimal (¡no la versión «1.27»!) |
| `hola mundo` | texto (las comillas son opcionales si no hay caracteres especiales) |

**Cuándo usar comillas**: si el texto parece otro tipo (`"1.27"`, `"true"`, `"0644"`), empieza por un carácter especial (`*`, `&`, `@`, `{`…) o contiene `: `.

### Textos de varias líneas

```yaml
script: |        # "|" conserva los saltos de línea
  echo hola
  echo adiós
resumen: >       # ">" une las líneas en una sola (con espacios)
  Esto es un texto
  largo en una línea.
```

### Comentarios y varios documentos

- `#` inicia un comentario.
- `---` separa **varios documentos** en un mismo archivo (muy usado en Kubernetes para meter varios objetos).

### YAML y JSON

JSON es prácticamente un **subconjunto** de YAML: `{"puerto": 80, "tags": ["a", "b"]}` también es YAML válido. Por eso kubectl acepta manifests en ambos formatos.

## Ejemplo

El mismo dato en JSON y en YAML:

```json
{
  "app": "web",
  "replicas": 3,
  "puertos": [80, 443],
  "env": { "MODO": "pro" }
}
```

```yaml
app: web
replicas: 3
puertos:
  - 80
  - 443
env:
  MODO: pro
```

## Errores comunes

- **Tabuladores.** YAML los prohíbe para indentar. Configura tu editor para insertar espacios.
- **Olvidar el espacio tras `:` o tras `-`.** `puerto:80` es un texto, no una clave con valor.
- **Indentación desalineada** dentro de un elemento de lista: una clave queda colgando de otro nivel.
- **Versiones como números.** `version: 1.10` se lee como el número `1.1`. Usa `"1.10"`.
- **Permisos o códigos con ceros a la izquierda.** Escribe `mode: "0644"` entre comillas (así lo recomienda Ansible) para que no se interprete como otro número.
- **Valores tipo `no`, `yes`, `on`, `off`.** En YAML 1.1 (que usan algunas herramientas) se leen como booleanos: el famoso «problema de Noruega» (`NO` como código de país → `false`). Ante la duda, comillas.

## En la entrevista

**«¿Qué diferencia hay entre YAML y JSON?»**
JSON es casi un subconjunto de YAML. YAML es más legible (indentación en lugar de llaves, comentarios con `#`, textos multilínea, varios documentos con `---`), pero su indentación y su tipado implícito lo hacen más propenso a errores sutiles.

**«Un manifest da un error de "mapping values are not allowed here". ¿Qué buscas?»**
Un problema de sintaxis alrededor de `:`: casi siempre indentación incorrecta, una clave sin espacio tras los dos puntos o un texto con `: ` sin comillas.

## Resumen

- YAML = **mapas** (`clave: valor`), **listas** (`- elemento`) e **indentación con espacios**.
- **Nunca tabuladores**; espacio obligatorio tras `:` y `-`.
- `80` es número y `"80"` es texto; entrecomilla versiones y valores ambiguos.
- `|` conserva saltos de línea; `>` los une; `---` separa documentos.
- JSON es casi un **subconjunto** de YAML.
