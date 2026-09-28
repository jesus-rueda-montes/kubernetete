## Reglas de Memoria y Contexto

1. **Gestión de Lógica y Memoria de Desarrollo:**
   - Mantén y actualiza una sección en este documento (o un archivo dedicado como `DECISIONS.md` / `ARCHITECTURE.md`) con la lógica clave del proyecto, la estructura de componentes, decisiones de diseño de software y el estado actual del desarrollo.
   - Antes de realizar cambios significativos, revisa y actualiza la documentación de arquitectura para asegurar continuidad entre ventanas de contexto.

2. **Cero Invención / Asunciones (Strict No-Hallucination Policy):**
   - Si no sabes cómo resolver un problema, falta información sobre una librería/API, o hay múltiples formas de implementar una funcionalidad con implicaciones de diseño: **NO te inventes la solución ni asumas intenciones**.
   - Haz una pausa y realiza preguntas claras y directas al usuario especificando las alternativas posibles con sus pros y contras.
## Proyecto: Kubernetete

App web personal (SPA estática, sin backend ni IA) para aprender Cloud (GCP principal + AWS/Azure), Kubernetes, Terraform y Ansible, de principiante a nivel de entrevista técnica.

- Arquitectura y estado actual: [ARCHITECTURE.md](ARCHITECTURE.md)
- Decisiones de diseño y su motivo: [DECISIONS.md](DECISIONS.md)
- Temario (módulos planificados y su estado): [TEMARIO.md](TEMARIO.md)

### Comandos
- `npm run dev`: servidor de desarrollo
- `npm test`: tests (Vitest)
- `npm run test:e2e`: test e2e (Playwright; la primera vez: `npx playwright install chromium`)
- `npm run lint`: lint (oxlint)
- `npm run build`: typecheck + build de producción

### Reglas de contenido
- Idioma: español, con los términos técnicos en inglés.
- Cada lección sigue la plantilla fija (qué problema resuelve, analogía, concepto, ejemplo comentado, errores comunes, cómo lo preguntan en una entrevista, resumen). Ver ARCHITECTURE.md.
- Los comandos y flags de `content/cli-specs/` se transcriben de la documentación oficial, con la URL de origen. Nunca se inventan.
- Las pistas nunca penalizan (ni XP, ni nota, ni racha, ni desbloqueo). En los exámenes no hay pistas, pero sí autocompletado.
