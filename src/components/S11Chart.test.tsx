import { render } from '@testing-library/react';
import S11Chart from './S11Chart/S11Chart';

// Mock recharts to avoid canvas rendering issues in jsdom
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
  ReferenceDot: () => <div />,
  ReferenceArea: () => <div />,
  Label: () => <div />,
}));

const mockData = [
  { frequency: 400e6, s11_db: -5.2 },
  { frequency: 435e6, s11_db: -15.8 },
  { frequency: 450e6, s11_db: -12.1 },
  { frequency: 470e6, s11_db: -8.3 },
];

describe('S11Chart', () => {
  it('renders without crashing', () => {
    const { container } = render(<S11Chart data={mockData} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('handles empty data', () => {
    const { container } = render(<S11Chart data={[]} />);
    expect(container.firstChild).toBeTruthy();
  });
});
