import { render } from '@testing-library/react'
import AntennaViewport from './AntennaViewport'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
})

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-canvas">{children}</div>
  ),
}))

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  Grid: () => <div data-testid="grid" />,
}))

vi.mock('./DipoleModel', () => ({
  DipoleModel: () => <div data-testid="dipole-model" />,
}))

vi.mock('./MonopoleModel', () => ({
  MonopoleModel: () => <div data-testid="monopole-model" />,
}))

vi.mock('./PatchModel', () => ({
  PatchModel: () => <div data-testid="patch-model" />,
}))

vi.mock('./QfhModel', () => ({
  QfhModel: () => <div data-testid="qfh-model" />,
}))

describe('AntennaViewport', () => {
  it('renders without crashing', () => {
    const { container } = render(<AntennaViewport />)
    expect(container.firstChild).toBeTruthy()
  })

  it('has relative positioning', () => {
    const { container } = render(<AntennaViewport />)
    const viewport = container.firstChild as HTMLElement
    expect(viewport.className).toContain('relative')
  })
})
