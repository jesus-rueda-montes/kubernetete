import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router'
import { getCatalog } from '../content/loader'
import { dueQueue } from '../engine/srs'
import { BadgeToaster } from './BadgeToaster'
import { useProgress } from '../store/progressStore'

const links = [
  { to: '/', label: 'Inicio' },
  { to: '/itinerarios', label: 'Itinerarios' },
  { to: '/repaso', label: 'Repaso' },
  { to: '/ajustes', label: 'Ajustes' },
]

export function Layout() {
  const progress = useProgress()
  const due = dueQueue(getCatalog(), progress, new Date()).length
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 text-sm sm:text-base">
          <span className="mr-2 w-full font-bold text-sky-400 sm:w-auto">Kubernetete</span>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                isActive ? 'text-sky-300' : 'text-slate-400 hover:text-slate-200'
              }
            >
              {l.label}
              {l.to === '/repaso' && due > 0 && (
                <span className="ml-1.5 rounded-full bg-sky-600 px-1.5 py-0.5 text-xs font-medium text-white" aria-label={`${due} pendientes`}>
                  {due}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
          <Outlet />
        </Suspense>
      </main>
      <BadgeToaster />
    </div>
  )
}
