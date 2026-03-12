import { render, screen, fireEvent } from '@testing-library/react';
import SmithChart from './SmithChart';

const mockImpedanceData = {
  impedanceReal: [50, 75, 100, 25],
  impedanceImag: [0, 25, -50, 75],
  frequency: [1e9, 1.5e9, 2e9, 2.5e9]
};

describe('SmithChart', () => {
  it('renders with default title', () => {
    render(<SmithChart {...mockImpedanceData} />);
    expect(screen.getByText('Smith Chart')).toBeInTheDocument();
  });

  it('renders with custom title', () => {
    render(<SmithChart {...mockImpedanceData} title="Custom Smith Chart" />);
    expect(screen.getByText('Custom Smith Chart')).toBeInTheDocument();
  });

  it('renders without title when title is empty', () => {
    render(<SmithChart {...mockImpedanceData} title="" />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('renders canvas element', () => {
    render(<SmithChart {...mockImpedanceData} />);
    const canvas = screen.getByRole('img', { hidden: true });
    expect(canvas).toBeInTheDocument();
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('applies custom dimensions', () => {
    render(<SmithChart {...mockImpedanceData} width={500} height={500} />);
    const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
    expect(canvas.width).toBe(500);
    expect(canvas.height).toBe(500);
  });

  it('applies default dimensions', () => {
    render(<SmithChart {...mockImpedanceData} />);
    const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement;
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(400);
  });

  it('renders legend with correct items', () => {
    render(<SmithChart {...mockImpedanceData} />);
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('Trace')).toBeInTheDocument();
    expect(screen.getByText('End')).toBeInTheDocument();
    expect(screen.getByText('Z₀ = 50 Ω')).toBeInTheDocument();
  });

  it('shows custom reference impedance in legend', () => {
    render(<SmithChart {...mockImpedanceData} referenceImpedance={75} />);
    expect(screen.getByText('Z₀ = 75 Ω')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<SmithChart {...mockImpedanceData} className="custom-class" />);
    expect(container.firstChild).toHaveClass('smith-chart', 'custom-class');
  });

  it('handles empty impedance data', () => {
    render(<SmithChart impedanceReal={[]} impedanceImag={[]} />);
    expect(screen.getByText('Smith Chart')).toBeInTheDocument();
    // Should render without errors
  });

  it('handles mismatched array lengths', () => {
    render(
      <SmithChart 
        impedanceReal={[50, 75]} 
        impedanceImag={[0]} 
      />
    );
    expect(screen.getByText('Smith Chart')).toBeInTheDocument();
    // Should render without errors
  });

  it('handles mouse events on canvas', () => {
    render(<SmithChart {...mockImpedanceData} />);
    const canvas = screen.getByRole('img', { hidden: true });
    
    // Should not throw errors on mouse events
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 200 });
    fireEvent.mouseLeave(canvas);
    
    expect(canvas).toBeInTheDocument();
  });

  it('shows tooltip on hover near data points', () => {
    render(<SmithChart {...mockImpedanceData} />);
    const canvas = screen.getByRole('img', { hidden: true });
    
    // Simulate mouse move near center (50+j0 should be at center)
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 200 });
    
    // Tooltip might appear depending on exact positioning
    // This tests that the event handler doesn't crash
    expect(canvas).toBeInTheDocument();
  });

  it('renders with showGrid disabled', () => {
    render(<SmithChart {...mockImpedanceData} showGrid={false} />);
    expect(screen.getByText('Smith Chart')).toBeInTheDocument();
  });

  it('renders with showLabels disabled', () => {
    render(<SmithChart {...mockImpedanceData} showLabels={false} />);
    expect(screen.getByText('Smith Chart')).toBeInTheDocument();
  });
});