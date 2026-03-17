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

// Mock CSS import
vi.mock('../SolverPanel.css', () => ({}));

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

  it('solver type radio buttons work', () => {
    render(<I18nProvider><SolverPanel {...defaultProps} /></I18nProvider>);

    const radios = screen.getAllByRole('radio');
    const momWire = radios.find(r => (r as HTMLInputElement).value === 'MoM Wire') as HTMLInputElement;
    const momSurface = radios.find(r => (r as HTMLInputElement).value === 'MoM Surface') as HTMLInputElement;
    const fdtd = radios.find(r => (r as HTMLInputElement).value === 'FDTD') as HTMLInputElement;

    expect(momWire.checked).toBe(true);
    fireEvent.click(fdtd);
    expect(fdtd.checked).toBe(true);
    fireEvent.click(momSurface);
    expect(momSurface.checked).toBe(true);
  });

  it('frequency mode switching works', () => {
    render(<I18nProvider><SolverPanel {...defaultProps} /></I18nProvider>);

    const radios = screen.getAllByRole('radio');
    const singleRadio = radios.find(r => (r as HTMLInputElement).value === 'single') as HTMLInputElement;
    const sweepRadio = radios.find(r => (r as HTMLInputElement).value === 'sweep') as HTMLInputElement;
    const presetRadio = radios.find(r => (r as HTMLInputElement).value === 'preset') as HTMLInputElement;

    // Default is sweep now
    expect(sweepRadio.checked).toBe(true);

    // Switch to single
    fireEvent.click(singleRadio);
    expect(singleRadio.checked).toBe(true);

    // Switch to preset — should show Band selector
    fireEvent.click(presetRadio);
    expect(presetRadio.checked).toBe(true);
    expect(screen.getByText(/^Band:/)).toBeInTheDocument();
  });

  it('local fallback works when server is unavailable', async () => {
    (api.isServerAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    // Use single mode to test onSolveComplete
    render(<I18nProvider><SolverPanel {...defaultProps} /></I18nProvider>);

    // Switch to single mode
    const radios = screen.getAllByRole('radio');
    const singleRadio = radios.find(r => (r as HTMLInputElement).value === 'single') as HTMLInputElement;
    fireEvent.click(singleRadio);

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
