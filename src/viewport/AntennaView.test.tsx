import { render, screen } from '@testing-library/react';
import { AntennaView } from './AntennaView';

// Mock Three.js canvas to avoid WebGL context issues in tests
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-canvas">{children}</div>
  )
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  Grid: () => <div data-testid="grid" />,
  Box: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="box">{children}</div>
  )
}));

describe('AntennaView', () => {
  it('renders without errors', () => {
    render(<AntennaView />);
    expect(screen.getByTestId('mock-canvas')).toBeInTheDocument();
  });

  it('applies custom dimensions', () => {
    render(<AntennaView width={800} height={600} />);
    const container = screen.getByTestId('mock-canvas').parentElement;
    expect(container).toHaveStyle('width: 800px');
    expect(container).toHaveStyle('height: 600px');
  });

  it('applies default dimensions when none provided', () => {
    render(<AntennaView />);
    const container = screen.getByTestId('mock-canvas').parentElement;
    expect(container).toHaveStyle('width: 100%');
    expect(container).toHaveStyle('height: 400px');
  });

  it('includes camera controls', () => {
    render(<AntennaView />);
    expect(screen.getByTestId('orbit-controls')).toBeInTheDocument();
  });

  it('includes grid and antenna geometry', () => {
    render(<AntennaView />);
    expect(screen.getByTestId('grid')).toBeInTheDocument();
    expect(screen.getByTestId('box')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<AntennaView className="custom-class" />);
    const container = screen.getByTestId('mock-canvas').parentElement;
    expect(container).toHaveClass('antenna-view', 'custom-class');
  });
});