import { render, screen } from '@testing-library/react';
import VswrChart from './VswrChart';

vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ReferenceLine: () => <div />,
}));

const sampleData = [
  { frequency: 400, vswr: 3.57 },
  { frequency: 420, vswr: 2.1 },
  { frequency: 435, vswr: 1.22 },
  { frequency: 450, vswr: 1.85 },
  { frequency: 470, vswr: 2.32 },
];

describe('VswrChart', () => {
  it('renders VSWR title', () => {
    render(<VswrChart data={sampleData} />);
    expect(screen.getByText('VSWR')).toBeInTheDocument();
  });

  it('renders without crashing with empty data', () => {
    const { container } = render(<VswrChart data={[]} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders with sample data', () => {
    const { container } = render(<VswrChart data={sampleData} />);
    expect(container.firstChild).toBeTruthy();
    expect(screen.getByText('VSWR')).toBeInTheDocument();
  });
});
