import { render, screen } from '@testing-library/react';
import S11Chart from './S11Chart';

const mockData = [
  { frequency: 400e6, s11_db: -5.2 },
  { frequency: 435e6, s11_db: -15.8 },
  { frequency: 450e6, s11_db: -12.1 },
  { frequency: 470e6, s11_db: -8.3 }
];

describe('S11Chart', () => {
  it('renders chart with title', () => {
    render(<S11Chart data={mockData} title="Test S11 Chart" />);
    expect(screen.getByText('Test S11 Chart')).toBeInTheDocument();
  });

  it('renders with default title when none provided', () => {
    render(<S11Chart data={mockData} />);
    expect(screen.getByText('S11 Return Loss')).toBeInTheDocument();
  });

  it('renders without title when title is empty string', () => {
    render(<S11Chart data={mockData} title="" />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('renders chart container', () => {
    render(<S11Chart data={mockData} />);
    const container = screen.getByRole('img', { hidden: true }).closest('.s11-chart-container');
    expect(container).toBeInTheDocument();
  });

  it('handles empty data gracefully', () => {
    render(<S11Chart data={[]} />);
    expect(screen.getByText('S11 Return Loss')).toBeInTheDocument();
  });

  it('applies custom height', () => {
    const { container } = render(<S11Chart data={mockData} height={300} />);
    const responsiveContainer = container.querySelector('.recharts-responsive-container');
    expect(responsiveContainer).toHaveStyle('height: 300px');
  });

  it('renders reference lines when provided', () => {
    const referenceLines = [
      { frequency: 435e6, label: 'Resonance' },
      { s11: -10, label: '-10 dB' }
    ];
    
    render(
      <S11Chart 
        data={mockData} 
        referenceLines={referenceLines}
      />
    );
    
    // Chart should render without errors
    expect(screen.getByText('S11 Return Loss')).toBeInTheDocument();
  });
});