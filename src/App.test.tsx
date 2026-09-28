import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import App from './App'

test('renderiza la portada dentro del layout', async () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  )
  expect(await screen.findByRole('heading', { name: /Bienvenido a Kubernetete/ })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Itinerarios' })).toBeTruthy()
})
