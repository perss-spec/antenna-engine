import { render, screen } from '@testing-library/react';
import S11Chart from './S11Chart';

const mockData = [
  { frequency: 100, s11_db: -10 },
  { frequency: 200, s11_db: -15 },
  { frequency: 300, s11_db: -20 }
];

describe('S11Chart', () => {
  it('renders chart title', () => {
    render(<S11Chart data={mockData} />);
    expect(screen.getByText('S11 Return Loss')).toBeInTheDocument();
  });

  it('renders with empty data', () => {
    render(<S11Chart data={[]} />);
    expect(screen.getByText('S11 Return Loss')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<S11Chart data={mockData} className="custom-class" />);
    expect(container.firstChild).toHaveClass('s11-chart', 'custom-class');
  });

  it('renders multiple data traces', () => {
    render(
      <S11Chart 
        data={mockData}
        simulationData={mockData}
        touchstoneData={mockData}
      />
    );
    expect(screen.getByText('S11 Return Loss')).toBeInTheDocument();
  });
});