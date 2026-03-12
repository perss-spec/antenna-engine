import { render } from '@testing-library/react'
import AntennaViewport from './AntennaViewport'

// Mock ResizeObserver for tests
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
})

// Mock WebGL context for tests
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  writable: true,
  value: (contextType: string) => {
    if (contextType === 'webgl' || contextType === 'webgl2') {
      return {
        canvas: {},
        drawingBufferWidth: 800,
        drawingBufferHeight: 600,
        getExtension: () => null,
        getParameter: () => null,
        createShader: () => ({}),
        shaderSource: () => {},
        compileShader: () => {},
        createProgram: () => ({}),
        attachShader: () => {},
        linkProgram: () => {},
        useProgram: () => {},
        createBuffer: () => ({}),
        bindBuffer: () => {},
        bufferData: () => {},
        enableVertexAttribArray: () => {},
        vertexAttribPointer: () => {},
        drawArrays: () => {},
        viewport: () => {},
        clearColor: () => {},
        clear: () => {},
        enable: () => {},
        disable: () => {},
        getShaderParameter: () => true,
        getProgramParameter: () => true,
        getAttribLocation: () => 0,
        getUniformLocation: () => ({}),
        uniform1f: () => {},
        uniform2f: () => {},
        uniform3f: () => {},
        uniform4f: () => {},
        uniformMatrix4fv: () => {},
      }
    }
    return null
  },
})

describe('AntennaViewport', () => {
  it('renders without crashing', () => {
    const { container } = render(<AntennaViewport />)
    expect(container.firstChild).toBeTruthy()
  })

  it('has correct container styling', () => {
    const { container } = render(<AntennaViewport />)
    const viewport = container.firstChild as HTMLElement
    expect(viewport.style.width).toBe('100%')
    expect(viewport.style.height).toBe('100vh')
  })
})