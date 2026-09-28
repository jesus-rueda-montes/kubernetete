import { cliOf, getCliSpec, loadCliSpecsFor } from '../content/loader'
import type { Exercise } from '../content/schema'
import { grade, needsHcl, type Answer, type CliSpecLookup, type GradeResult } from '../engine/grade'
import { getHclParser } from './hclLoader'

/** Corrige uno o varios ejercicios cargando antes lo que haga falta (parser HCL, especificaciones de CLI). */
export async function gradeAll(items: { ex: Exercise; answer: Answer }[]): Promise<GradeResult[]> {
  const [hcl] = await Promise.all([
    items.some((i) => needsHcl(i.ex)) ? getHclParser() : undefined,
    loadCliSpecsFor(items.map((i) => i.ex)),
  ])
  const specs: CliSpecLookup = {}
  for (const { ex } of items) {
    const spec = getCliSpec(cliOf(ex) ?? '')
    if (spec) specs[spec.cli] = spec
  }
  return items.map(({ ex, answer }) => grade(ex, answer, { specs, hcl }))
}

export async function gradeExercise(ex: Exercise, answer: Answer): Promise<GradeResult> {
  return (await gradeAll([{ ex, answer }]))[0]
}
