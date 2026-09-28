import { useParams } from 'react-router'
import { findModule, getCatalog } from '../content/loader'
import { lockReasons } from '../engine/progress'
import { useProgress } from '../store/progressStore'

/** Módulo de la URL actual y, si está bloqueado, por qué. */
export function useModuleAccess() {
  const { trackId = '', slug = '' } = useParams()
  const catalog = getCatalog()
  const progress = useProgress()
  const mod = findModule(catalog, trackId, slug)
  const reasons = mod ? lockReasons(catalog, progress, mod) : []
  return { catalog, mod, reasons, locked: reasons.length > 0, progress }
}
