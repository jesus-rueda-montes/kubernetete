/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFile } from 'node:fs/promises'
import { defineConfig, type Plugin } from 'vite'

// `leccion.md?lesson-meta` devuelve solo el bloque de frontmatter de la lección.
// Así el catálogo (títulos y minutos) va en el bundle inicial y el cuerpo de cada
// lección se descarga al abrirla.
function lessonMeta(): Plugin {
  const suffix = '?lesson-meta'
  return {
    name: 'kubernetete:lesson-meta',
    enforce: 'pre',
    async load(id) {
      if (!id.endsWith(suffix)) return
      const source = await readFile(id.slice(0, -suffix.length), 'utf8')
      const frontmatter = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(source)?.[0] ?? ''
      return `export default ${JSON.stringify(frontmatter)}`
    },
  }
}

// `exercises.json?exercise-meta` devuelve solo el id y el tipo de cada ejercicio:
// basta para listarlos y contar; el archivo completo se descarga al practicar.
function exerciseMeta(): Plugin {
  const suffix = '?exercise-meta'
  return {
    name: 'kubernetete:exercise-meta',
    enforce: 'pre',
    async load(id) {
      if (!id.endsWith(suffix)) return
      const data = JSON.parse(await readFile(id.slice(0, -suffix.length), 'utf8')) as { exercises?: { id?: unknown; type?: unknown }[] }
      const exercises = (data.exercises ?? []).map(({ id, type }) => ({ id, type }))
      return `export default ${JSON.stringify({ exercises })}`
    },
  }
}

// BASE_PATH lo fija el workflow de GitHub Pages (/<nombre-del-repo>/).
// En local se sirve desde la raíz.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [lessonMeta(), exerciseMeta(), react(), tailwindcss()],
  // PORT lo asigna el panel de vista previa si 5173 está ocupado.
  server: { port: Number(process.env.PORT) || 5173 },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
