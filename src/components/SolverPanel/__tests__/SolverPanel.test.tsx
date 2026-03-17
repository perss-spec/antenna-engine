import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SolverPanel } from '../SolverPanel';
import { I18nProvider } from '@/lib/i18n';

vi.mock('@/lib/api', () => ({
  api: {
    isServerAvailable: vi.fn().mockResolvedValue(false),
    solve: vi.fn(),
    sweep: vi.fn(),
    submitMomJob: vi.fn(),
    waitForJob: vi.fn(),
    getJobStatus: vi.fn(),
    resetCache: vi.fn(),
  },
}));

vi.mock('@/lib/impedanceSolver', () => ({
  solveByCategory: vi.fn().mockReturnValue([73, 42.5]),
}));

vi.mock('@/lib/antennaKB', () => ({
  getCategoryForId: vi.fn().mockReturnValue('wire'),
}));

vi.mock('@/lib/gainCalculator', () => ({
  analyticalGain: vi.fn().mockReturnValue(2.15),
}));

import { api } from '@/lib/api';

const defaultProps = {
  antennaType: 'dipole',
  antennaParams: { length_m: 0.0625 },
  frequency: 2400, // MHz
  onSolveComplete: vi.fn(),
  onSweepComplete: vi.fn(),
};

describe('SolverPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.isServerAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(false);
  });

  it('renders without crashing', () => {
    render(<I18nProvider><SolverPanel {...defaultProps} /></I18nProvider>);
    expect(screen.getByText('Solver Configuration')).toBeInTheDocument();
  });

  it('shows "Run Solver" button', () => {
    render(<I18nProvider><SolverPanel {...defaultProps} /></I18nProvider>);
    const button = screen.getByRole('button', { name: /run solver/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('clicking "Run Solver" triggers sweep and calls onSweepComplete', async () => {
    render(<I18nProvider><SolverPanel {...defaultProps} /></I18nProvider>);

    const button = screen.getByRole('button', { name: /run solver/i });
    fireEvent.click(button);

    // Default mode is sweep, so onSweepComplete should be called
    await waitFor(() => {
      expect(defaultProps.onSweepComplete).toHaveBeenCalledTimes(1);
    });

    const sweep = defaultProps.onSweepComplete.mock.calls[0][0];
    expect(sweep.frequencies.length).toBeGreaterThan(1);
    expect(sweep.results.length).toBe(sweep.frequencies.length);
  });

  it('solver type buttons work', () => {
    render(<I18nProvider><SolverPanel {...defaultProps} /></I18nProvider>);

    const momWire = screen.getByRole('button', { name: 'MoM Wire' });
    const momSurface = screen.getByRole('button', { name: 'MoM Surface' });
    const fdtd = screen.getByRole('button', { name: 'FDTD' });

    expect(momWire).toHaveClass('bg-accent');
    fireEvent.click(fdtd);
    expect(fdtd).toHaveClass('bg-accent');
    fireEvent.click(momSurface);
    expect(momSurface).toHaveClass('bg-accent');
  });

  it('frequency mode switching works', () => {
    render(<I18nProvider><SolverPanel {...defaultProps} /></I18nProvider>);

    const singleButton = screen.getByRole('button', { name: /single frequency/i });
    const sweepButton = screen.getByRole('button', { name: /frequency sweep/i });
    const presetButton = screen.getByRole('button', { name: /preset band/i });

    expect(sweepButton).toHaveClass('bg-accent');

    // Switch to single
    fireEvent.click(singleButton);
    expect(singleButton).toHaveClass('bg-accent');

    // Switch to preset — should show Band selector
    fireEvent.click(presetButton);
    expect(presetButton).toHaveClass('bg-accent');
    expect(screen.getByText(/^Band:/)).toBeInTheDocument();
  });

  it('local fallback works when server is unavailable', async () => {
    (api.isServerAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    // Use single mode to test onSolveComplete
    render(<I18nProvider><SolverPanel {...defaultProps} /></I18nProvider>);

    // Switch to single mode
    const singleButton = screen.getByRole('button', { name: /single frequency/i });
    fireEvent.click(singleButton);

    const button = screen.getByRole('button', { name: /run solver/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Simulation Results')).toBeInTheDocument();
    });

    expect(api.solve).not.toHaveBeenCalled();
    expect(defaultProps.onSolveComplete).toHaveBeenCalledTimes(1);
    const result = defaultProps.onSolveComplete.mock.calls[0][0];
    expect(result.impedance.real).toBe(73);
    expect(result.impedance.imag).toBe(42.5);
  });
});
