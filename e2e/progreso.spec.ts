import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Flujo completo: leer una lección, aprobar el examen del primer módulo, ver
// que se desbloquea el siguiente y que el progreso sigue ahí tras recargar.

type Option = { id: string; correct: boolean }
type Exercise =
  | { id: string; type: 'quiz'; options: Option[] }
  | { id: string; type: 'command'; accepted: string[] }
  | { id: string; type: 'fill'; blanks: { id: string; accepted: string[] }[] }
  | { id: string; type: 'editor' }

const MODULE = 'kubernetes/l1-arquitectura'
const NEXT = 'kubernetes/l1-pods'
const exercises: Exercise[] = JSON.parse(readFileSync(`content/${MODULE}/exercises.json`, 'utf8')).exercises

/** Responde correctamente la pregunta visible del examen usando las soluciones del contenido. */
async function answerCurrent(page: Page) {
  const id = await page.locator('[data-exercise-id]').getAttribute('data-exercise-id')
  const ex = exercises.find((e) => e.id === id)
  if (!ex) throw new Error(`Pregunta desconocida: ${id}`)
  if (ex.type === 'quiz') {
    const labels = page.locator('fieldset label')
    for (const [i, o] of ex.options.entries()) if (o.correct) await labels.nth(i).locator('input').check()
  } else if (ex.type === 'command') {
    await page.getByLabel('Terminal').fill(ex.accepted[0])
  } else if (ex.type === 'fill') {
    for (const b of ex.blanks) await page.getByLabel(`hueco ${b.id}`).fill(b.accepted[0])
  } else {
    throw new Error(`El test no sabe responder ejercicios de tipo ${ex.type}`)
  }
}

test('leer, aprobar el examen, desbloquear el siguiente módulo y conservar el progreso', async ({ page }) => {
  const [track, slug] = MODULE.split('/')
  const [nextTrack, nextSlug] = NEXT.split('/')

  // El siguiente módulo empieza bloqueado.
  await page.goto(`/#/modulo/${nextTrack}/${nextSlug}/leccion/01-que-es-un-pod`)
  await expect(page.getByText('Módulo bloqueado')).toBeVisible()

  // 1. Leer la primera lección (el cuerpo se descarga bajo demanda).
  await page.goto(`/#/modulo/${track}/${slug}/leccion/01-por-que-kubernetes`)
  await expect(page.getByRole('heading', { name: 'Qué problema resuelve' })).toBeVisible()
  await page.getByRole('button', { name: 'He terminado esta lección' }).click()
  await expect(page.getByText('✓ Lección completada')).toBeVisible()

  // 2. Aprobar el examen.
  await page.goto(`/#/modulo/${track}/${slug}/examen`)
  await page.getByRole('button', { name: 'Empezar examen' }).click()
  const total = Number((await page.getByText(/^Pregunta 1 de \d+$/).textContent())!.match(/de (\d+)/)![1])
  for (let i = 1; i <= total; i++) {
    await expect(page.getByText(`Pregunta ${i} de ${total}`)).toBeVisible()
    await answerCurrent(page)
    if (i < total) await page.getByRole('button', { name: 'Siguiente →' }).click()
  }
  await page.getByRole('button', { name: 'Entregar examen' }).click()
  await expect(page.getByText('100%', { exact: true })).toBeVisible()
  await expect(page.getByText(/¡Aprobado! Has desbloqueado/)).toBeVisible()

  // 3. El siguiente módulo ya está abierto.
  await page.getByRole('link', { name: /^Ir a «/ }).click()
  await expect(page.getByRole('link', { name: /¿Qué es un Pod\?/ })).toBeVisible()

  // 4. Tras recargar, el progreso sigue ahí (IndexedDB).
  await page.reload()
  await expect(page.getByRole('link', { name: /¿Qué es un Pod\?/ })).toBeVisible()
  await page.goto(`/#/modulo/${track}/${slug}`)
  await expect(page.getByText(/Mejor nota: 100%/)).toBeVisible()
  await expect(page.getByText('✓ Leída')).toBeVisible()
})
