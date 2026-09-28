import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { ExercisePage } from '../pages/ExercisePage'
import { initialProgress } from '../engine/progress'
import { exportProgress } from '../engine/progressFile'
import { ReviewPage } from '../pages/ReviewPage'
import { SettingsPage } from '../pages/SettingsPage'
import { getCatalog, loadExercises } from '../content/loader'
import { useProgress } from '../store/progressStore'
import { BadgeToaster } from './BadgeToaster'
import { MarkdownView } from './MarkdownView'
afterEach(cleanup)

// El contenido real crece: aprueba los módulos anteriores a l1-pods para que esté desbloqueado.
function resetAndUnlockPods() {
  useProgress.getState().reset()
  for (const m of getCatalog().modules.filter((x) => x.trackId === 'kubernetes')) {
    if (m.ref === 'kubernetes/l1-pods') break
    useProgress.getState().exam(m, 1)
  }
}

describe('glosario', () => {
  const glossary = [
    { term: 'Pod', definition: 'unidad mínima', introducedIn: 'k/m' },
    { term: 'Node', definition: 'una máquina', introducedIn: 'k/m' },
  ]

  test('marca solo la primera aparición, admite plural y no toca código ni títulos', () => {
    const { container } = render(
      <MarkdownView
        glossary={glossary}
        source={'## Pod\n\nUsa `Pod` aquí. Los Pods viven en un Node. Otro Pod y otro Node.'}
      />,
    )
    const marked = [...container.querySelectorAll('[role="button"]')].map((e) => e.textContent)
    expect(marked).toEqual(['Pods', 'Node'])
  })

  test('muestra la definición al pasar el ratón', () => {
    render(<MarkdownView glossary={glossary} source="Un Pod." />)
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Pod' }))
    expect(screen.getByRole('tooltip').textContent).toBe('unidad mínima')
  })
})

describe('insignias y copia de progreso', () => {
  beforeEach(() => useProgress.getState().reset())

  test('ganar una insignia muestra un aviso; importar o borrar no', () => {
    render(<BadgeToaster />)
    act(() => {
      useProgress.getState().lessonRead('kubernetes/l1-pods', '01-que-es-un-pod')
    })
    expect(screen.getByText('¡Nueva insignia!')).toBeTruthy()
    expect(screen.getByText('Primeros pasos')).toBeTruthy()
    cleanup()

    render(<BadgeToaster />)
    act(() => {
      useProgress.getState().reset()
    })
    act(() => {
      useProgress.getState().replace({ ...useProgress.getState(), xp: 5000 })
    })
    expect(screen.queryByText('¡Nueva insignia!')).toBeNull()
  })

  test('importar una copia pide confirmación y reemplaza el progreso', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<SettingsPage />)
    const copy = exportProgress({ ...initialProgress(), xp: 321 }, new Date('2026-09-01T00:00:00Z'))
    const file = new File([copy], 'copia.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Archivo de copia de progreso'), { target: { files: [file] } })
    expect(await screen.findByText('Progreso importado correctamente.')).toBeTruthy()
    expect(confirm).toHaveBeenCalledOnce()
    expect(useProgress.getState().xp).toBe(321)

    const bad = new File(['{"foo":1}'], 'otra.json')
    fireEvent.change(screen.getByLabelText('Archivo de copia de progreso'), { target: { files: [bad] } })
    expect(await screen.findByText(/no es una copia de progreso de Kubernetete/)).toBeTruthy()
    confirm.mockRestore()
  })
})

describe('repaso con flashcards (contenido piloto)', () => {
  beforeEach(resetAndUnlockPods)

  const renderReview = () =>
    render(
      <MemoryRouter>
        <ReviewPage />
      </MemoryRouter>,
    )

  test('sin lecciones terminadas no hay tarjetas y explica cómo conseguirlas', () => {
    renderReview()
    expect(screen.getByText(/No tienes tarjetas pendientes/)).toBeTruthy()
    expect(screen.getByText(/cuando terminas todas sus lecciones/)).toBeTruthy()
  })

  test('mostrar respuesta, valorar; "Otra vez" la repite en la sesión y "Bien" la saca', () => {
    useProgress.getState().lessonRead('kubernetes/l1-pods', '01-que-es-un-pod')
    renderReview()
    expect(screen.getByText('0 hechas · 3 pendientes')).toBeTruthy()

    fireEvent.click(screen.getByText(/Mostrar respuesta/))
    fireEvent.click(screen.getByText('Otra vez'))
    expect(screen.getByText('1 hechas · 3 pendientes')).toBeTruthy() // vuelve al final de la cola

    for (let i = 0; i < 3; i++) {
      fireEvent.keyDown(window, { key: ' ' })
      fireEvent.keyDown(window, { key: '4' }) // Fácil
    }
    expect(screen.getByText(/Sesión terminada! Has repasado 4 tarjetas/)).toBeTruthy()
    expect(Object.keys(useProgress.getState().cards)).toHaveLength(3)
  })
})

describe('práctica de un ejercicio (contenido piloto)', () => {
  // La primera descarga de los ejercicios y las specs es lenta en Vitest: se hace antes.
  beforeAll(async () => {
    await loadExercises(getCatalog().modules.find((m) => m.ref === 'kubernetes/l1-pods')!)
  }, 30_000)
  beforeEach(resetAndUnlockPods)

  // Los ejercicios se descargan bajo demanda: se espera a que termine la carga.
  const renderExercise = async (id: string) => {
    render(
      <MemoryRouter initialEntries={[`/modulo/kubernetes/l1-pods/ejercicio/${id}`]}>
        <Routes>
          <Route path="modulo/:trackId/:slug/ejercicio/:exerciseId" element={<ExercisePage />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.queryByText(/Cargando el ejercicio/)).toBeNull())
  }

  test('fallar, pedir pistas y ver la solución no penaliza; acertar da XP', async () => {
    const xpBefore = useProgress.getState().xp
    await renderExercise('pod-red-compartida')

    fireEvent.click(screen.getByText('Ver pista 1 de 2'))
    fireEvent.click(screen.getByText('Ver pista 2 de 2'))
    expect(screen.getByText('No hay más pistas')).toBeTruthy()

    fireEvent.click(screen.getByLabelText(/Por la IP del Node/))
    fireEvent.click(screen.getByText('Comprobar'))
    expect(await screen.findByText(/No es correcto todavía/)).toBeTruthy()
    fireEvent.click(screen.getByText('Ver solución explicada'))
    expect(screen.getByText('Solución explicada')).toBeTruthy()

    fireEvent.click(screen.getByText('Intentar de nuevo'))
    fireEvent.click(screen.getByLabelText(/localhost/))
    fireEvent.click(screen.getByText('Comprobar'))
    expect(await screen.findByText('¡Correcto!')).toBeTruthy()

    const s = useProgress.getState()
    expect(s.xp - xpBefore).toBe(10)
    expect(s.exercises['kubernetes/l1-pods#pod-red-compartida']).toEqual({ solved: true, attempts: 2, hintsUsed: 2 })
  })

  test('comando: Tab autocompleta, un error explica el motivo y el acierto muestra la salida', async () => {
    await renderExercise('listar-pods')
    const input = screen.getByLabelText('Terminal') as HTMLInputElement

    fireEvent.change(input, { target: { value: 'kubectl ge' } })
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(input.value).toBe('kubectl get ')
    fireEvent.change(input, { target: { value: 'kubectl get conf' } })
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(input.value).toBe('kubectl get configmaps ')

    // Al escribir "--" aparece la lista de flags con descripción
    fireEvent.change(input, { target: { value: 'kubectl get pods --sh' } })
    expect(screen.getByRole('option', { name: /--show-labels/ })).toBeTruthy()

    fireEvent.change(input, { target: { value: 'kubectl get pods --imagen' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText(/flag desconocido: --imagen/)).toBeTruthy()

    fireEvent.click(screen.getByText('Intentar de nuevo'))
    fireEvent.change(screen.getByLabelText('Terminal'), { target: { value: 'kubectl get po' } })
    fireEvent.keyDown(screen.getByLabelText('Terminal'), { key: 'Enter' })
    expect(await screen.findByText('¡Correcto!')).toBeTruthy()
    expect(screen.getByText(/web 1\/1 Running/)).toBeTruthy()
  })

  test('rellenar huecos: Tab completa usando el contexto del comando', async () => {
    await renderExercise('crear-pod-run')
    const verbo = screen.getByLabelText('hueco verbo') as HTMLInputElement
    fireEvent.change(verbo, { target: { value: 'ru' } })
    fireEvent.keyDown(verbo, { key: 'Tab' })
    expect(verbo.value).toBe('run')
    const flag = screen.getByLabelText('hueco flag') as HTMLInputElement
    fireEvent.change(flag, { target: { value: 'im' } })
    fireEvent.keyDown(flag, { key: 'Tab' })
    expect(flag.value).toBe('image')
  })

  test('rellenar huecos marca cada hueco', async () => {
    await renderExercise('crear-pod-run')
    fireEvent.change(screen.getByLabelText('hueco verbo'), { target: { value: 'run' } })
    fireEvent.change(screen.getByLabelText('hueco flag'), { target: { value: 'img' } })
    fireEvent.click(screen.getByText('Comprobar'))
    await screen.findByText(/No es correcto todavía/)
    expect(screen.getByLabelText('hueco verbo').className).toMatch(/emerald/)
    expect(screen.getByLabelText('hueco flag').className).toMatch(/red/)
  })
})
