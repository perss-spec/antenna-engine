import { render, screen } from '@testing-library/react';
import { AntennaView } from './AntennaView';
import type { ViewportAntennaGeometry } from './types';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-canvas">{children}</div>
  ),
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  Grid: () => <div data-testid="grid" />,
  Box: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="box">{children}</div>
  ),
  Html: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="html">{children}</div>
  ),
}));

vi.mock('./components/AntennaRenderer', () => ({
  AntennaRenderer: () => <div data-testid="antenna-renderer" />,
}));

vi.mock('./components/RadiationPattern', () => ({
  RadiationPattern: () => <div data-testid="radiation-pattern" />,
}));

vi.mock('./components/FrequencySweep', () => ({
  FrequencySweep: () => <div data-testid="frequency-sweep" />,
}));

const mockGeometry: ViewportAntennaGeometry = {
  elements: [],
  feedPoints: [],
  boundingBox: { min: [0, 0, 0], max: [1, 1, 1] },
};

describe('AntennaView', () => {
  it('renders without errors', () => {
    render(<AntennaView geometry={mockGeometry} />);
    expect(screen.getByTestId('mock-canvas')).toBeInTheDocument();
  });

  it('renders with custom className', () => {
    const { container } = render(<AntennaView geometry={mockGeometry} className="custom" />);
    expect(container.firstChild).toBeTruthy();
  });
});
