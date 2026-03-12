import { render, screen } from '@testing-library/react';
import S11Chart from './S11Chart';
import type { S11Trace } from './S11Chart';

// Mock recharts to avoid canvas issues in tests
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: ({ dataKey, name }: any) => <div data-testid={`line-${dataKey}`}>{name}</div>,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  ReferenceLine: ({ label }: any) => <div data-testid="reference-line">{label?.value}</div>
}));

const mockTrace: S11Trace = {
  id: 'sim1',
  name: 'QFH Simulation',
  data: [
    { frequency: 400e6, s11_db: -15.2, phase: 45 },
    { frequency: 450e6, s11_db: -25.8, phase: 90 },
    { frequency: 500e6, s11_db: -18.1, phase: 135 }
  ],
  color: '#2196F3',
  type: 'simulation'
};

const mockTouchstoneTrace: S11Trace = {
  id: 'ts1',
  name: 'Measured Data',
  data: [
    { frequency: 400e6, s11_db: -12.5 },
    { frequency: 450e6, s11_db: -22.3 },
    { frequency: 500e6, s11_db: -16.8 }
  ],
  color: '#FF9800',
  type: 'touchstone'
};

describe('S11Chart', () => {
  it('renders chart title', () => {
    render(<S11Chart traces={[]} frequencyUnit="MHz" />);
    expect(screen.getByText('S11 Return Loss')).toBeInTheDocument();
  });

  it('shows empty state when no traces provided', () => {
    render(<S11Chart traces={[]} frequencyUnit="MHz" />);
    expect(screen.getByText('No simulation data available')).toBeInTheDocument();
    expect(screen.getByText('Run a simulation or import Touchstone data to view S11 response')).toBeInTheDocument();
  });

  it('renders chart components when traces are provided', () => {
    render(<S11Chart traces={[mockTrace]} frequencyUnit="MHz" />);
    
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });

  it('displays trace legend with correct information', () => {
    render(<S11Chart traces={[mockTrace, mockTouchstoneTrace]} frequencyUnit="MHz" />);
    
    expect(screen.getByText('QFH Simulation')).toBeInTheDocument();
    expect(screen.getByText('(simulation)')).toBeInTheDocument();
    expect(screen.getByText('Measured Data')).toBeInTheDocument();
    expect(screen.getByText('(touchstone)')).toBeInTheDocument();
  });

  it('renders S11 magnitude lines for each trace', () => {
    render(<S11Chart traces={[mockTrace, mockTouchstoneTrace]} frequencyUnit="MHz" />);
    
    expect(screen.getByTestId('line-sim1_s11')).toBeInTheDocument();
    expect(screen.getByTestId('line-ts1_s11')).toBeInTheDocument();
  });

  it('renders phase lines when showPhase is enabled', () => {
    render(<S11Chart traces={[mockTrace]} frequencyUnit="MHz" showPhase={true} />);
    
    expect(screen.getByTestId('line-sim1_s11')).toBeInTheDocument();
    expect(screen.getByTestId('line-sim1_phase')).toBeInTheDocument();
  });

  it('does not render phase lines when showPhase is disabled', () => {
    render(<S11Chart traces={[mockTrace]} frequencyUnit="MHz" showPhase={false} />);
    
    expect(screen.getByTestId('line-sim1_s11')).toBeInTheDocument();
    expect(screen.queryByTestId('line-sim1_phase')).not.toBeInTheDocument();
  });

  it('renders resonant frequency marker when provided', () => {
    const markers = { resonantFreq: 450e6 };
    render(<S11Chart traces={[mockTrace]} frequencyUnit="MHz" markers={markers} />);
    
    expect(screen.getByText('Resonant')).toBeInTheDocument();
  });

  it('renders bandwidth markers when provided', () => {
    const markers = { bandwidth: { start: 430e6, end: 470e6 } };
    render(<S11Chart traces={[mockTrace]} frequencyUnit="MHz" markers={markers} />);
    
    expect(screen.getByText('BW Start')).toBeInTheDocument();
    expect(screen.getByText('BW End')).toBeInTheDocument();
  });

  it('renders -10dB reference line', () => {
    render(<S11Chart traces={[mockTrace]} frequencyUnit="MHz" />);
    
    expect(screen.getByText('-10dB')).toBeInTheDocument();
  });

  it('handles different frequency units', () => {
    const { rerender } = render(<S11Chart traces={[mockTrace]} frequencyUnit="MHz" />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    
    rerender(<S11Chart traces={[mockTrace]} frequencyUnit="GHz" />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('handles empty trace data gracefully', () => {
    const emptyTrace: S11Trace = {
      id: 'empty',
      name: 'Empty Trace',
      data: [],
      color: '#000000',
      type: 'simulation'
    };
    
    render(<S11Chart traces={[emptyTrace]} frequencyUnit="MHz" />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByText('Empty Trace')).toBeInTheDocument();
  });
});