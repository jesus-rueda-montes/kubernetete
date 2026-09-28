# Arquitectura de Kubernetete

## Estado actual
- **Fase 0 (base): completada.** Scaffold, Tailwind, rutas, Vitest, lint y workflow de GitHub Pages.
- **Fase 1 (motor de contenido): completada.**
  - `src/content/schema.ts`: esquemas zod de itinerarios, módulos, lecciones, los 4 tipos de ejercicio, flashcards y glosario.
  - `src/content/lesson.ts`: parser de frontmatter (js-yaml) y comprobación de las 7 secciones obligatorias en orden.
  - `src/content/loader.ts`: `buildCatalog()` valida todo y acumula los errores con la ruta del archivo (`ContentError`); `getCatalog()` lo cachea.
  - Páginas: mapa de itinerarios, módulo y lector de lecciones (`MarkdownView`).
  - Contenido piloto: `content/kubernetes/l1-pods` (1 lección, 4 ejercicios, 3 flashcards).
- **Fase 2 (quizzes, exámenes, desbloqueo, persistencia, pistas y glosario): completada.**
  - `src/engine/grade.ts`: corrección de quiz y fill, `SUPPORTED_TYPES` (crece por fases), respuestas vacías.
  - `src/engine/progress.ts`: estado de progreso y transiciones puras (XP, racha, ejercicios, exámenes) y desbloqueo (`lockReasons`).
  - `src/engine/exam.ts`: construcción del examen (tipos soportados, barajado, máx. 10) y nota.
  - `src/store/progressStore.ts`: Zustand + persist en IndexedDB (`idb-keyval`), con respaldo en memoria si IndexedDB falla. `App` espera a la hidratación antes de pintar.
  - `src/content/glossaryPlugin.ts` + `GlossaryTerm`: tooltip en la primera aparición de cada término de una lección.
  - Páginas: práctica de ejercicio (pistas, reintento, solución explicada), examen (sin pistas, corrección al entregar), dashboard y ajustes (borrar progreso).
- **Fase 3 (terminal simulada): completada.**
  - `content/cli-specs/kubectl.json`: get, describe, logs, delete, apply, run, exec, scale, flags globales y tipos de recurso con alias. Verificado contra kubernetes.io (URL en cada comando).
  - `src/engine/cli.ts`: `tokenize`, `parseCommand` (normaliza alias y formas de flags, errores en español), `sameCommand`, `complete`, `applyCompletion`.
  - `gradeCommand` (en `grade.ts`): equivalencia semántica con los comandos aceptados; patrones regex como respaldo; `feedback` explica el fallo.
  - El loader valida que cada comando aceptado (y cada `solution.answer` de un fill de shell) sea válido según su especificación.
  - `Terminal`: Tab, lista de flags al escribir "-", ↑↓ (lista o historial), Esc, botón "Tab" para móvil, salida simulada.
  - Rellenar huecos: Tab completa un hueco usando el contexto del comando.
- **Fase 4 (editor YAML): completada.**
  - `src/engine/yamlAssert.ts`: rutas (`a.b[0]`, `[*]`, `[name=web]`), operadores `exists`, `absent`, `equals`, `matches`, `oneOf`, `count`; errores de sintaxis con línea y traducidos al español.
  - Editor: **CodeMirror 6** (`src/components/code/CodeEditor.tsx`), carga diferida, Tab = 2 espacios.
  - Resaltado en lecciones: `CodeBlock` + `highlight.ts` (mismos parsers y clases `tok-*` que el editor): yaml, json, bash.
  - El loader exige `solution.answer` en ejercicios de editor y comprueba que pase todas sus aserciones.
  - Rutas pesadas con `React.lazy` (lección, ejercicio, examen, ajustes).
  - Contenido piloto: ejercicio `manifest-pod-web`.
- **Fase 5 (editor HCL): completada.**
  - `src/engine/hcl.ts`: tree-sitter (gramática Terraform) → estructura estilo hcl2json (`resource.TIPO.NOMBRE[0].attr`); expresiones no literales como texto (`"var.region"`); errores en español con línea/columna y pistas (":" en vez de "=", "{" que falta, cierres que faltan).
  - `src/lib/hclLoader.ts`: carga perezosa de los .wasm (runtime + gramática vendorizada en `src/vendor/tree-sitter-hcl/`).
  - Corrección asíncrona: `src/lib/gradeExercise.ts` (`gradeExercise`, `gradeAll`) carga el parser solo si hace falta; `grade()` sigue siendo síncrona con `GradeContext`.
  - Resaltado HCL propio (`hclMode.ts`, StreamLanguage) en editor y lecciones (```hcl / terraform / tf).
  - Tests con Node: `tsconfig.test.json` (tipos node) separado del de la app.
  - Contenido piloto: `terraform/l1-primer-recurso` (lección, 2 quizzes, 1 ejercicio HCL, 4 flashcards).
- **Fase 6 (flashcards FSRS): completada.**
  - `src/engine/srs.ts` (ts-fsrs 5.x, parámetros por defecto: retención 90 %, pasos de aprendizaje 1 min / 10 min, sin fuzz): `reviewCard`, `previewDue`, `availableCards`, `dueQueue`, `nextDue`, `formatInterval`.
  - Progreso v2: campo `cards` (estado FSRS serializado con fechas ISO) y `migrateProgress` desde v1 (probado con datos reales del navegador).
  - `ReviewPage` (`/#/repaso`): cola fija por sesión; si una tarjeta vuelve en < 20 min se repite en la misma sesión; atajos Espacio y 1-4.
  - Contador de pendientes en el menú y tarjeta "Repaso de hoy" en el dashboard.
- **Fase 7 (gamificación y copia de progreso): completada.**
  - `src/engine/badges.ts`: 12 insignias + 1 por itinerario con contenido, **calculadas** a partir del progreso (no se guardan). Ninguna premia no usar pistas (hay test).
  - `BadgeToaster`: aviso "¡Nueva insignia!" al ganarla (se suscribe al store; no avisa al importar/borrar gracias a `isBulkChange`).
  - Dashboard: rejilla de insignias con barra de avance.
  - `src/engine/progressFile.ts`: exportar/importar JSON (`{ app, exportedAt, progress }`) validado con zod y migrado de versión; rechaza copias de versiones futuras.
  - Ajustes: descargar copia, importar (con confirmación que compara XP y lecciones) y borrar.
- **Fase 8 (producción de contenido): todos los módulos del temario escritos** (niveles 0 a 5 en los cinco itinerarios). Estado en [TEMARIO.md](TEMARIO.md).
  - Nivel 5 añadió: spec kubectl `events`, `debug`, `get --sort-by/--field-selector`; specs nuevas `aws.json` y `az.json` (subconjunto: sts, s3, ec2, eks / login, account, group, aks); gcloud `billing` (budgets, projects, accounts), `compute instances add-labels`, `--instance-termination-action`, `sql instances promote-replica`, `secrets`, `kms`.
  - Glosario ampliado a 164 términos de los cinco itinerarios (`content/glossary.json`). `introducedIn` = primer módulo de su itinerario que usa el término; `trackOnly` limita el tooltip a su itinerario en términos ambiguos (Service, Secret, Node, plan…). Tests en `content.test.ts` (describe "glosario"), con la misma expresión que el plugin (`glossaryPattern`) y el mismo filtro (`glossaryForTrack`). Decisión 54.
  - Test e2e con Playwright (`e2e/progreso.spec.ts`, `npm run test:e2e`): sobre el build de producción servido con `vite preview` (puerto 4180), lee una lección, aprueba el examen de `kubernetes/l1-arquitectura` con las soluciones del contenido (`data-exercise-id` en la pregunta del examen), comprueba que se desbloquea `l1-pods` y que el progreso sobrevive a una recarga. Se ejecuta también en el workflow de GitHub Pages.
  - Pendiente: revisión del contenido por el usuario y publicación en GitHub.
  - Ejercicios y especificaciones de CLI bajo demanda (decisión 53): chunk principal de 1,12 MB a 616 kB (188 kB gzip).
  - Motor: forma `TIPO/NOMBRE` de kubectl (`deploy/web` = `deployments web`).
  - Nuevas especificaciones de CLI: `terraform`, `gcloud`, `docker`, `ansible`, `ansible-playbook`; `kubectl` ampliada (label, create namespace, config, cluster-info, api-resources).
  - `gcloud` ampliada para Cloud L3: `compute networks`/`subnets`, `firewall-rules`, `routers`/`nats`, `sql`, `run`, `container`. `terraform`: `force-unlock`. Nueva `ansible-galaxy` (role/collection init, install, list); `ansible-galaxy` y `ansible-vault` añadidas a `CLIS` en `schema.ts`.
  - Nueva `helm` (Helm 4: `--rollback-on-failure` sustituye a `--atomic`). `kubectl` ampliada: RBAC (`create role/rolebinding/clusterrole/clusterrolebinding/serviceaccount`, `auth can-i/whoami`, global `--as`), `autoscale`, `top`, `kustomize`, y tipos `networkpolicies`, `roles`, `hpa`, `pdb`, `crds`…
  - Ejemplos de Ingress controller con Traefik: ingress-nginx se retiró en marzo de 2026.
  - Mejoras del motor que ha pedido el contenido:
    - `flagStyle: "single-dash"` (terraform).
    - `args` en la raíz de la CLI para las que no tienen subcomandos (ansible).
    - Claves entre comillas en las rutas (`metadata.annotations['a.b/c']`).
    - Operador `hasKeys`.
    - Resaltado de `dockerfile` e `ini`.
  - Carga de contenido:
    - `getCatalog()` usa `loadAppContent()`, donde las lecciones traen solo su frontmatter (plugin `lessonMeta` de `vite.config.ts`, query `?lesson-meta`) y los ejercicios solo `{ id, type }` (plugin `exerciseMeta`, query `?exercise-meta`).
    - `loadExercises(mod)` descarga el exercises.json del módulo (validado con zod) y las specs de CLI que usan; `getCliSpec(cli)` las lee de forma síncrona una vez cargadas. Las promesas se cachean y se anotan con `status`/`value` para `use()` de React.
    - `LoadBoundary` (Suspense + error boundary) envuelve lo que se descarga: lección, ejercicio y examen; si falla la red, muestra un aviso con «recarga la página».
    - Los tests usan `buildCatalog(loadRawContent())` (modo `full`): validan todo y dejan los ejercicios completos en `mod.fullExercises`.
    - El cuerpo se descarga al abrir la lección, con `loadLessonBody()` (promesa cacheada) y `use()` + Suspense en `LessonPage`.
    - Los tests usan `loadRawContent()` (`src/content/rawContent.ts`), que trae las lecciones completas y valida sus secciones. No se importa desde la app, para que no entre en el bundle.

## Fases
0. Base del proyecto ✅
1. Motor de contenido: esquemas zod, loader, lector de lecciones, mapa de itinerarios ✅
2. Quizzes, exámenes, desbloqueo, persistencia, pistas y glosario ✅
3. Terminal simulada: tokenizador, autocompletado, salida simulada, rellenar huecos ✅
4. Editor YAML (CodeMirror 6) + motor de aserciones ✅
5. Editor HCL (tree-sitter) ✅
6. Flashcards FSRS y vista de repaso ✅
7. Gamificación, dashboard y exportar/importar progreso ✅
8. Producción de contenido (en curso; ver TEMARIO.md)

## Estructura (objetivo)
```
content/
  tracks.json                   # itinerarios, niveles, orden y requisitos
  glossary.json                 # término -> definición, módulo donde se introduce
  cli-specs/<cli>.json          # subcomandos, flags, alias, descripción y URL de origen
  <itinerario>/<módulo>/
    module.json                 # id, título, nivel, prereqs, xp
    lessons/NN-slug.md          # frontmatter + secciones obligatorias
    exercises.json              # quiz | command | fill | editor (con hints[] y solution)
    flashcards.json
src/
  content/                      # schema.ts (zod), loader.ts (import.meta.glob)
  engine/                       # lógica pura y testeable: quiz, command, completion, fill,
                                # yamlAssert, hclAssert, srs, progress
  store/                        # Zustand + persist (IndexedDB)
  pages/                        # Dashboard, TrackMap, Lesson, Exercise, Exam, Review, Settings
  components/                   # Layout, MarkdownView, Terminal, CodeEditor, QuizCard, HintPanel…
```

## Principios
- **La lógica vive en `src/engine/`** como funciones puras sin React, para testearla con Vitest.
- **El contenido es datos**: añadir un módulo no requiere tocar código.
- **Todo el contenido se valida** en los tests, que se ejecutan en CI antes de publicar.

## Rutas actuales
| Ruta | Página |
|---|---|
| `/#/` | Dashboard: XP, racha, repaso de hoy, "Continúa por aquí" e insignias |
| `/#/itinerarios` | Mapa de itinerarios por nivel |
| `/#/modulo/:trackId/:slug` | Módulo: lecciones, nº de ejercicios y flashcards |
| `/#/modulo/:trackId/:slug/leccion/:lessonId` | Lector de lección con glosario y "He terminado esta lección" |
| `/#/modulo/:trackId/:slug/ejercicio/:exerciseId` | Práctica con pistas y solución explicada |
| `/#/modulo/:trackId/:slug/examen` | Examen del módulo |
| `/#/ajustes` | Ajustes: exportar, importar y borrar progreso |
| `/#/repaso` | Repaso de flashcards (FSRS) |

## Plantilla de lección (obligatoria)
1. Qué problema resuelve
2. Analogía
3. Concepto (con diagrama si ayuda)
4. Ejemplo mínimo comentado
5. Errores comunes
6. Cómo lo preguntan en una entrevista
7. Resumen (3-5 viñetas)

## Convenciones del contenido
- La identidad de un módulo sale de su ruta: `content/<itinerario>/<módulo>/` → ref `"<itinerario>/<módulo>"`. `module.json` no lleva id.
- Las lecciones se ordenan por nombre de archivo (`01-…`, `02-…`); el id es el nombre sin `.md`.
- Los huecos de los ejercicios `fill` se escriben `{{id}}` en la plantilla y deben declararse en `blanks`.
- Si el contenido es inválido, la app muestra la lista de errores en lugar de romperse (y los tests fallan).

## Reglas de progreso
- XP: lección leída +5, ejercicio resuelto por primera vez +10, examen aprobado por primera vez + el `xp` del módulo.
- Pistas y "ver solución": solo se cuentan (`hintsUsed`) como estadística; nunca cambian XP, nota, racha ni desbloqueo (hay test).
- Racha: cualquier actividad en un día local cuenta; saltarse un día la reinicia a 1.
- Desbloqueo: examen aprobado (≥ 80%) del módulo anterior del mismo itinerario + prerequisitos explícitos. El primer módulo de cada itinerario está abierto.
- Examen: ejercicios de tipos soportados, barajados, máx. 10, sin pistas; se guarda la mejor nota.
- Flashcards: las de un módulo entran en el repaso cuando está desbloqueado y se han leído todas sus lecciones. Cada tarjeta repasada da +1 XP y cuenta para la racha.
- Cambios de formato del progreso: subir `version` en `initialProgress` y en el store, y añadir el paso en `migrateProgress` (con test).

## Especificaciones de CLI (`content/cli-specs/<cli>.json`)
- Solo se incluye lo que usa el temario, **transcrito de la documentación oficial**; cada comando lleva su `source`.
- `valueSets`: valores de posicionales con alias (p. ej. `po` → `pods`); se usan para autocompletar y para normalizar al corregir.
- Flags: `takesValue`, `values` (sugerencias) y `strict` (solo esos valores son válidos).
- Los flags del subcomando tienen prioridad sobre los globales (p. ej. `-f` es `--follow` en `logs` y `--filename` en `get`).
- Para añadir una CLI nueva: crear su JSON; si un ejercicio de tipo `command` la usa sin especificación, el test de contenido falla.
- `flagStyle`:
  - `gnu` (por defecto): `--largo` y `-c` corto, con cortos agrupables (`-it`).
  - `single-dash` (estilo Go, terraform): `-largo` y `-largo=valor`; `--largo` también se acepta. Los booleanos que se escriben `-x=false` se modelan como flags con valor `true|false` y `strict`.
- CLI sin subcomandos (`ansible <patrón>`, `ansible-playbook <playbook>`): se definen `args` en la raíz y `commands` queda vacío.

## Ejercicios de editor
- `assertions[].message` es lo que ve el alumno al corregir: debe decir **qué** se comprueba y **dónde** (p. ej. "Tiene la etiqueta app: web (dentro de metadata.labels)").
- `equals` es estricto con tipos: `containerPort: 80` (número) ≠ `"80"` (texto), igual que en Kubernetes.
- Claves con `.` o `/` (annotations, labels con prefijo, módulos FQCN de Ansible): `['clave.con/puntos']`. Un documento que es una lista (playbook) empieza por índice: `[0].hosts`.
- `hasKeys` (lista de claves): el mapa contiene esas claves aunque su valor esté vacío (p. ej. `children: { web: , db: }` en un inventario).
- `equals`/`matches`/`oneOf` fallan si la ruta no existe (no "aprueban en vacío"); para exigir que algo NO esté, usa `absent`.
- `solution.answer` es obligatorio y el test de contenido verifica que pasa todas las aserciones (YAML en el loader; HCL en `hcl.test.ts`, que además comprueba que el `starter` NO aprueba).
- HCL: los bloques se anidan por etiquetas y el último nivel es una lista (`resource.google_storage_bucket.fotos[0].name`); los bloques sin etiquetas también son listas (`versioning[0].enabled`); los mapas (`labels = {...}`) son objetos.

## Convenciones de redacción del contenido
- Comandos y flags: solo los transcritos en `content/cli-specs/`. Datos de producto (alcances, rangos reservados, precedencias…): comprobados en la documentación oficial antes de escribirlos.
- En los Dockerfile de ejemplo, los comentarios van en su propia línea (Docker no admite `#` al final de una instrucción).
- Los tests de interfaz que usan el contenido piloto (`kubernetes/l1-pods`) aprueban antes los módulos anteriores del itinerario (`resetAndUnlockPods`), para no depender de cuántos haya.

## Notas para tests de interfaz
- Las acciones del store devuelven una Promise (por `persist`). Dentro de `act`, usar cuerpo con llaves: `act(() => { store.accion() })`; si no, React lo trata como `act` asíncrono sin `await` y rompe los tests siguientes.
- La corrección es asíncrona: tras "Comprobar", usar `await screen.findBy...`.
