import { lazy, useSyncExternalStore } from 'react'
import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { ContentError, getCatalog } from './content/loader'
import { Dashboard } from './pages/Dashboard'
import { ModulePage } from './pages/ModulePage'
import { Placeholder } from './pages/Placeholder'
import { TrackMap } from './pages/TrackMap'
import { useProgress } from './store/progressStore'

// Páginas pesadas (Markdown, terminal, editor) en trozos aparte que se
// descargan al visitarlas; la portada y el mapa cargan al instante.
const LessonPage = lazy(() => import('./pages/LessonPage').then((m) => ({ default: m.LessonPage })))
const ExercisePage = lazy(() => import('./pages/ExercisePage').then((m) => ({ default: m.ExercisePage })))
const ExamPage = lazy(() => import('./pages/ExamPage').then((m) => ({ default: m.ExamPage })))
const ReviewPage = lazy(() => import('./pages/ReviewPage').then((m) => ({ default: m.ReviewPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))

/** El progreso se lee de IndexedDB de forma asíncrona: esperamos antes de pintar
 *  para no mostrar módulos bloqueados que en realidad están aprobados. */
function useHydrated() {
  return useSyncExternalStore(
    (onChange) => useProgress.persist.onFinishHydration(onChange),
    () => useProgress.persist.hasHydrated(),
  )
}

export default function App() {
  const hydrated = useHydrated()
  // Si el contenido es inválido, mostramos exactamente qué falla en vez de
  // una pantalla en blanco (los tests también lo detectan antes).
  try {
    getCatalog()
  } catch (e) {
    if (!(e instanceof ContentError)) throw e
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold text-red-400">Contenido inválido</h1>
        <ul className="mt-4 list-disc space-y-1 pl-6 font-mono text-sm text-red-200">
          {e.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </main>
    )
  }

  if (!hydrated) return null

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="itinerarios" element={<TrackMap />} />
        <Route path="modulo/:trackId/:slug" element={<ModulePage />} />
        <Route path="modulo/:trackId/:slug/leccion/:lessonId" element={<LessonPage />} />
        <Route path="modulo/:trackId/:slug/ejercicio/:exerciseId" element={<ExercisePage />} />
        <Route path="modulo/:trackId/:slug/examen" element={<ExamPage />} />
        <Route path="repaso" element={<ReviewPage />} />
        <Route path="ajustes" element={<SettingsPage />} />
        <Route path="*" element={<Placeholder title="Página no encontrada" phase="ninguna" />} />
      </Route>
    </Routes>
  )
}
