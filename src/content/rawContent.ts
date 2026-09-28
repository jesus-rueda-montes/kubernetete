import { loadBaseContent, type RawContent } from './loader'

// Todo el contenido completo: lecciones, ejercicios y especificaciones de CLI.
// Solo para tests y validación: la app usa getCatalog(), que carga lo pesado bajo demanda.
export function loadRawContent(): RawContent {
  return {
    ...loadBaseContent(),
    lessons: import.meta.glob('/content/*/*/lessons/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>,
    exercises: import.meta.glob('/content/*/*/exercises.json', { eager: true, import: 'default' }),
    cliSpecs: import.meta.glob('/content/cli-specs/*.json', { eager: true, import: 'default' }),
  }
}
