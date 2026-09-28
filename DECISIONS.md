# Decisiones de diseño

Registro de decisiones con su motivo. Las más recientes van al final.

| # | Decisión | Motivo |
|---|---|---|
| 1 | Web SPA estática, uso personal, sin IA | Elegido por el usuario: coste cero y sin backend. |
| 2 | Sin clúster real: teoría, quizzes, comandos, rellenar huecos y editor YAML/HCL con validación estática | Elegido por el usuario. Se compensa con una terminal simulada con autocompletado. |
| 3 | React 19 + Vite 8 + TypeScript | Elección técnica: ecosistema maduro y build estático simple. |
| 4 | React Router con `HashRouter` | GitHub Pages no reescribe rutas; con hash no hace falta un 404.html como truco. |
| 5 | Tailwind CSS v4 (plugin `@tailwindcss/vite`) | Estilo rápido y consistente sin CSS a medida. |
| 6 | oxlint en lugar de ESLint | Es el linter que trae por defecto la plantilla actual de Vite. Es más rápido y basta para el proyecto. |
| 7 | Zustand + `idb-keyval` (IndexedDB) para el progreso, con exportar/importar JSON | Uso personal y sin backend. El JSON sirve de copia de seguridad y para cambiar de dispositivo. |
| 8 | Contenido en `content/` (Markdown + JSON) validado con zod | Revisable en git. Un error de contenido hace fallar los tests y el build. |
| 9 | Frontmatter parseado con `js-yaml` (no `gray-matter`) | `gray-matter` depende de APIs de Node (Buffer) y no funciona bien en el navegador. |
| 10 | Flashcards con `ts-fsrs` | FSRS es el algoritmo actual de Anki. |
| 11 | Progresión por módulos desbloqueables (examen ≥ 80%) con XP, rachas e insignias | Elegido por el usuario. |
| 12 | Pistas progresivas (1-3) sin penalización; solución explicada tras fallar | Petición del usuario. |
| 13 | Autocompletado con Tab en la terminal simulada, también en exámenes. Pistas no en exámenes | Petición del usuario; imita el entorno de la CKA. |
| 14 | Itinerario opcional «Nivel 0» (Linux, redes, Docker), que se puede saltar con su examen | Evita que un principiante absoluto se atasque en Kubernetes. |
| 15 | Despliegue en GitHub Pages con GitHub Actions (`BASE_PATH=/<repo>/`) | Elegido por el usuario. |
| 16 | La ref de un módulo se deriva de su carpeta, no de un campo `id` | Evita que el id y la carpeta se desincronicen. |
| 17 | Validación con `z.strictObject` | Un campo mal escrito (p. ej. `hint` en vez de `hints`) es un error, no se ignora en silencio. |
| 18 | Resaltado de sintaxis de los bloques de código aplazado | Se añadirá (probablemente shiki) cuando se integre Monaco, para compartir temas y dividir el bundle. |
| 19 | Lógica de progreso como funciones puras en `src/engine/progress.ts`; el store solo las envuelve | Se testea sin React ni IndexedDB. |
| 20 | Si IndexedDB falla, el progreso vive en memoria sin romper la app | Modo privado de algunos navegadores y tests en jsdom. |
| 21 | Glosario: se marca solo la primera aparición de cada término por lección, con plural simple | Marcar todas las apariciones satura la lectura. |
| 22 | Módulos bloqueados: se ve su página con el motivo, pero no se accede a lecciones, ejercicios ni examen | Da contexto de qué viene sin saltarse la progresión. |
| 23 | Examen sin límite de intentos, guarda la mejor nota | Aprendizaje sin castigo, coherente con las pistas gratuitas. |
| 24 | Especificación de kubectl verificada contra kubernetes.io al escribirla (sept. 2026) | Regla de no inventar: solo flags y alias confirmados en la documentación. `ingress` se deja sin abreviatura porque no se pudo confirmar. |
| 25 | Corrección de comandos semántica (parseo + comparación), no por texto | Así se aceptan `-n`/`--namespace`, `po`/`pods`, `-it`/`-i -t` y cualquier orden de flags, como en la realidad. |
| 26 | Tab como en bash: completa lo inequívoco; si no avanza, muestra la lista; con la lista abierta, Tab elige | Es el comportamiento que el usuario encontrará en una terminal real y en la CKA. |
| 27 | Botón "Tab" visible en la terminal | Los teclados de móvil no tienen tecla Tab. |
| 28 | Otras CLIs (terraform, ansible, gcloud, aws, az, helm, docker) se especifican cuando llegue su contenido | Evita transcribir cientos de flags que aún no usa ningún ejercicio. |
| 29 | **CodeMirror 6 en lugar de Monaco** (cambio respecto al plan) | Monaco no soporta oficialmente navegadores móviles y pesa varios MB; CodeMirror funciona en táctil, tiene modo YAML y pesa ~25 kB gzip cargado bajo demanda. |
| 30 | Resaltado de las lecciones con los parsers de CodeMirror (`@lezer/highlight`), no shiki | Mismo aspecto que el editor y sin otra dependencia pesada. |
| 31 | Validación YAML por aserciones, sin JSON Schema de Kubernetes (ajv) por ahora | Las aserciones dan mensajes pedagógicos concretos; el esquema completo puede añadirse después si hace falta. |
| 32 | Un solo documento YAML por ejercicio | Simplicidad; los multi-documento (`---`) se añadirán cuando un ejercicio lo necesite. |
| 33 | Errores de js-yaml traducidos al español (los más frecuentes) | Explicaciones claras; si aparece uno no traducido se muestra el original. |
| 34 | **HCL con tree-sitter** (`web-tree-sitter` + gramática `tree-sitter-hcl`), elegido por el usuario | Investigadas 4 opciones (sept. 2026): `@cdktf/hcl2json` descartado (CDKTF archivado por HashiCorp el 10-12-2025 y depende de Node); `hcl2-parser` (librería oficial vía gopherjs) pesa 658 KB gzip, sin mantenimiento desde 2022 y pierde los mensajes de error; regex demasiado impreciso. tree-sitter: ~106 KB gzip de wasm, mantenido y con posiciones de error. |
| 35 | Gramática `.wasm` vendorizada en `src/vendor/tree-sitter-hcl/` (Apache-2.0, v1.2.0) | El paquete npm ejecuta `node-gyp-build` al instalar y falla sin toolchain C++. |
| 36 | La conversión árbol → estructura es propia (con tests), no la librería oficial | Consecuencia de la decisión 34; las expresiones no literales se comparan por su texto fuente. |
| 37 | Aviso de build "direct eval" en web-tree-sitter se acepta | Es código generado por emscripten dentro de la librería (constantes internas), no evalúa entradas del usuario. |
| 38 | `grade()` síncrona + `gradeExercise()` asíncrona | El motor sigue siendo puro y testeable; la carga del wasm queda en `src/lib`. |
| 39 | FSRS con los parámetros por defecto de ts-fsrs y sin fuzz | Probados y estándar; sin fuzz los intervalos son predecibles y testeables. Se pueden ajustar más adelante. |
| 40 | Las tarjetas entran en el repaso al terminar todas las lecciones del módulo | Primero se aprende, luego se repasa (del plan). |
| 41 | Sin límite diario de tarjetas nuevas por ahora | Los mazos son pequeños; si crecen, añadir un tope (como Anki) será un cambio pequeño. |
| 42 | Migración de progreso versionada (`migrateProgress`) | Cambiar el formato no debe borrar el progreso del usuario. |
| 43 | Insignias calculadas a partir del progreso, no almacenadas | No pueden desincronizarse y no requieren migraciones. |
| 44 | Ninguna insignia premia no usar pistas | Sería una penalización encubierta; contradice "pistas sin coste". |
| 45 | Copia de progreso en JSON con `app`, `exportedAt` y `progress` versionado | Validable, migrable y legible; permite pasar el progreso entre dispositivos sin backend. |
| 46 | Temario completo en `TEMARIO.md`, delegado por el usuario («todo tuyo, no me importa el orden») | Una sola fuente del plan y su estado; primero los niveles 0 y 1 de todo para que cada itinerario tenga un camino de entrada. |
| 47 | `flagStyle` por CLI en lugar de tratar terraform como caso especial | El estilo Go (`-flag`) es común a varias herramientas; la corrección sigue siendo semántica. |
| 48 | `args` en la raíz de la especificación para CLIs sin subcomandos | ansible y ansible-playbook reciben el patrón o el playbook directamente. |
| 49 | Operador `hasKeys` y claves entre comillas en las rutas | Ejercicios reales los necesitan (inventarios YAML, annotations, módulos FQCN) sin comprobaciones ambiguas. |
| 50 | Los módulos de Fundamentos dan 50 XP (el resto, 100) | Son opcionales y más cortos. |
| 51 | El dev server usa `PORT` si existe (`autoPort` en `.claude/launch.json`) | Otra sesión ocupaba el 5173; la app no depende de un puerto concreto. |
| 52 | Cuerpos de las lecciones bajo demanda (plugin `?lesson-meta` + `import.meta.glob` perezoso); el resto del contenido sigue en el bundle inicial | Las lecciones son lo que más crece con el temario. Módulos, ejercicios y flashcards hacen falta al arrancar (desbloqueo, repaso, insignias). Tras el cambio, el bundle principal pasó de 704 a 598 kB. |
| 53 | Ejercicios completos y especificaciones de CLI también bajo demanda, aprobado por el usuario (plugin `?exercise-meta`: el índice solo lleva id y tipo; `loadExercises`/`loadCliSpec`) | Con el temario completo el chunk principal llegó a 1,12 MB (313 kB gzip). Las listas, contadores, insignias y el desbloqueo solo necesitan id y tipo. Tras el cambio: 616 kB (188 kB gzip). Las flashcards siguen en el bundle inicial porque el contador de repaso de la barra de navegación las necesita. |
| 54 | La regla del glosario («usado solo tras presentarse») se aplica **dentro de cada itinerario**; entre itinerarios, el tooltip aporta la definición. Campo `trackOnly` para términos ambiguos | Los itinerarios son paralelos: no hay un orden global (Cloud usa "Terraform", Kubernetes usa "YAML"). Algunos términos cambian de sentido fuera de su itinerario ("Service" en "Private Service Connect", "plan" como palabra española). |
| 55 | Test e2e con Playwright (solo Chromium) sobre el build de producción, en CI antes del build de Pages | Prueba los chunks bajo demanda reales y la persistencia en IndexedDB; un solo navegador mantiene el CI rápido. |

## Pendiente de decidir
- **Versiones de las GitHub Actions** del workflow (`checkout@v4`, `upload-pages-artifact@v3`, `deploy-pages@v4`): comprobar si hay versiones mayores nuevas al crear el repo en GitHub.
