import { render, screen } from '@testing-library/react';
import S11Chart from './S11Chart';

const mockData = [
  { frequency: 1e9, s11_db: -10 },
  { frequency: 1.5e9, s11_db: -15 },
  { frequency: 2e9, s11_db: -8 }
];

const mockTouchstoneData = [
  { frequency: 1e9, s11_db: -12 },
  { frequency: 1.5e9, s11_db: -18 },
  { frequency: 2e9, s11_db: -6 }
];

describe('S11Chart', () => {
  it('renders with default title', () => {
    render(<S11Chart data={mockData} />);
    expect(screen.getByText('S11 Return Loss')).toBeInTheDocument();
  });

  it('renders with custom title', () => {
    render(<S11Chart data={mockData} title="Custom S11 Chart" />);
    expect(screen.getByText('Custom S11 Chart')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <S11Chart data={mockData} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('s11-chart', 'custom-class');
  });

  it('renders chart with simulation data', () => {
    render(<S11Chart data={mockData} />);
    // Check that recharts container is rendered
    expect(document.querySelector('.recharts-wrapper')).toBeInTheDocument();
  });

  it('renders both simulation and touchstone data when provided', () => {
    render(
      <S11Chart 
        data={mockData} 
        touchstoneData={mockTouchstoneData} 
      />
    );
    // Both lines should be present in the legend
    expect(screen.getByText('Simulation')).toBeInTheDocument();
    expect(screen.getByText('Touchstone')).toBeInTheDocument();
  });

  it('handles empty data gracefully', () => {
    render(<S11Chart data={[]} />);
    expect(screen.getByText('S11 Return Loss')).toBeInTheDocument();
    expect(document.querySelector('.recharts-wrapper')).toBeInTheDocument();
  });
});