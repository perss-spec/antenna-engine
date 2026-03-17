import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SolverPanel } from '../SolverPanel';

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

// Mock CSS import
vi.mock('../SolverPanel.css', () => ({}));

import { api } from '@/lib/api';

const defaultProps = {
  antennaType: 'dipole',
  antennaParams: { length: 0.0625 },
  onSolveComplete: vi.fn(),
  onSweepComplete: vi.fn(),
};

describe('SolverPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.isServerAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(false);
  });

  it('renders without crashing', () => {
    render(<SolverPanel {...defaultProps} />);
    expect(screen.getByText('Solver Configuration')).toBeInTheDocument();
  });

  it('shows "Run Solver" button', () => {
    render(<SolverPanel {...defaultProps} />);
    const button = screen.getByRole('button', { name: /run solver/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('clicking "Run Solver" triggers computation and shows results', async () => {
    render(<SolverPanel {...defaultProps} />);

    const button = screen.getByRole('button', { name: /run solver/i });
    fireEvent.click(button);

    // Wait for the local solver to complete and results to appear
    await waitFor(() => {
      expect(screen.getByText('Simulation Results')).toBeInTheDocument();
    });

    // Check that result values are displayed (impedance, S11, VSWR)
    expect(screen.getByText('Z_in:')).toBeInTheDocument();
    expect(screen.getByText('S11:')).toBeInTheDocument();
    expect(screen.getByText('VSWR:')).toBeInTheDocument();

    // Callback should have been called
    expect(defaultProps.onSolveComplete).toHaveBeenCalledTimes(1);
    const result = defaultProps.onSolveComplete.mock.calls[0][0];
    expect(result.impedance.real).toBe(73);
    expect(result.impedance.imag).toBe(42.5);
    expect(typeof result.s11_db).toBe('number');
    expect(typeof result.vswr).toBe('number');
  });

  it('solver type radio buttons work', () => {
    render(<SolverPanel {...defaultProps} />);

    const radios = screen.getAllByRole('radio');
    const momWire = radios.find(r => (r as HTMLInputElement).value === 'MoM Wire') as HTMLInputElement;
    const momSurface = radios.find(r => (r as HTMLInputElement).value === 'MoM Surface') as HTMLInputElement;
    const fdtd = radios.find(r => (r as HTMLInputElement).value === 'FDTD') as HTMLInputElement;

    expect(momWire).toBeDefined();
    expect(momSurface).toBeDefined();
    expect(fdtd).toBeDefined();

    // Default is MoM Wire
    expect(momWire.checked).toBe(true);

    // Switch to FDTD
    fireEvent.click(fdtd);
    expect(fdtd.checked).toBe(true);
    expect(momWire.checked).toBe(false);

    // Switch to MoM Surface
    fireEvent.click(momSurface);
    expect(momSurface.checked).toBe(true);
  });

  it('frequency mode switching works', () => {
    render(<SolverPanel {...defaultProps} />);

    const radios = screen.getAllByRole('radio');
    const singleRadio = radios.find(r => (r as HTMLInputElement).value === 'single') as HTMLInputElement;
    const sweepRadio = radios.find(r => (r as HTMLInputElement).value === 'sweep') as HTMLInputElement;
    const presetRadio = radios.find(r => (r as HTMLInputElement).value === 'preset') as HTMLInputElement;

    // Default is single
    expect(singleRadio.checked).toBe(true);

    // Switch to sweep — should show Start/End inputs
    fireEvent.click(sweepRadio);
    expect(sweepRadio.checked).toBe(true);
    expect(screen.getByText(/Start \(Hz\):/)).toBeInTheDocument();
    expect(screen.getByText(/End \(Hz\):/)).toBeInTheDocument();

    // Switch to preset — should show Band selector
    fireEvent.click(presetRadio);
    expect(presetRadio.checked).toBe(true);
    expect(screen.getByText('Band:')).toBeInTheDocument();
  });

  it('local fallback works when server is unavailable', async () => {
    (api.isServerAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    render(<SolverPanel {...defaultProps} />);

    const button = screen.getByRole('button', { name: /run solver/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Simulation Results')).toBeInTheDocument();
    });

    // api.solve should NOT have been called (server unavailable → local fallback)
    expect(api.solve).not.toHaveBeenCalled();

    // But results should still be shown from localSolve
    expect(defaultProps.onSolveComplete).toHaveBeenCalledTimes(1);
    const result = defaultProps.onSolveComplete.mock.calls[0][0];
    expect(result.impedance.real).toBe(73);
    expect(result.impedance.imag).toBe(42.5);
  });
});
