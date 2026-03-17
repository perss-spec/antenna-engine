import { render, screen } from '@testing-library/react';
import ImpedanceChart from './ImpedanceChart';

vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ReferenceLine: () => <div />,
}));

const sampleData = [
  { frequency: 400, real: 75, imag: 20 },
  { frequency: 420, real: 60, imag: 10 },
  { frequency: 435, real: 52, imag: -3 },
  { frequency: 450, real: 65, imag: -15 },
  { frequency: 470, real: 90, imag: 35 },
];

describe('ImpedanceChart', () => {
  it('renders "Impedance Z(f)" title', () => {
    render(<ImpedanceChart data={sampleData} />);
    expect(screen.getByText('Impedance Z(f)')).toBeInTheDocument();
  });

  it('renders without crashing with empty data', () => {
    const { container } = render(<ImpedanceChart data={[]} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders with sample data', () => {
    const { container } = render(<ImpedanceChart data={sampleData} />);
    expect(container.firstChild).toBeTruthy();
    expect(screen.getByText('Impedance Z(f)')).toBeInTheDocument();
  });
});
