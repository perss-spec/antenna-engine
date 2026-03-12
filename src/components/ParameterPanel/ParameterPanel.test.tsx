import { render, screen, fireEvent } from '@testing-library/react';
import ParameterPanel from './ParameterPanel';

describe('ParameterPanel', () => {
  it('renders parameter panel with title', () => {
    render(<ParameterPanel />);
    expect(screen.getByText('Antenna Parameters')).toBeInTheDocument();
  });

  it('renders basic parameter inputs', () => {
    render(<ParameterPanel />);
    
    expect(screen.getByLabelText('Frequency (GHz)')).toBeInTheDocument();
    expect(screen.getByLabelText('Power (dBm)')).toBeInTheDocument();
    expect(screen.getByLabelText('Gain (dBi)')).toBeInTheDocument();
  });

  it('renders frequency sweep controls', () => {
    render(<ParameterPanel />);
    
    expect(screen.getByLabelText('Enable frequency sweep')).toBeInTheDocument();
    expect(screen.getByText('Enable Frequency Sweep')).toBeInTheDocument();
  });

  it('shows sweep range inputs when frequency sweep is enabled', () => {
    render(<ParameterPanel />);
    
    const checkbox = screen.getByLabelText('Enable frequency sweep');
    fireEvent.click(checkbox);
    
    expect(screen.getByLabelText('Start Frequency (GHz)')).toBeInTheDocument();
    expect(screen.getByLabelText('End Frequency (GHz)')).toBeInTheDocument();
  });

  it('hides sweep range inputs when frequency sweep is disabled', () => {
    render(<ParameterPanel />);
    
    const checkbox = screen.getByLabelText('Enable frequency sweep');
    
    // Enable first
    fireEvent.click(checkbox);
    expect(screen.getByLabelText('Start Frequency (GHz)')).toBeInTheDocument();
    
    // Then disable
    fireEvent.click(checkbox);
    expect(screen.queryByLabelText('Start Frequency (GHz)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('End Frequency (GHz)')).not.toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(<ParameterPanel />);
    
    expect(screen.getByText('Run Simulation')).toBeInTheDocument();
    expect(screen.getByText('Reset Parameters')).toBeInTheDocument();
  });

  it('updates frequency input value', () => {
    render(<ParameterPanel />);
    
    const frequencyInput = screen.getByLabelText('Frequency (GHz)') as HTMLInputElement;
    fireEvent.change(frequencyInput, { target: { value: '5.8' } });
    
    expect(frequencyInput.value).toBe('5.8');
  });

  it('updates power input value', () => {
    render(<ParameterPanel />);
    
    const powerInput = screen.getByLabelText('Power (dBm)') as HTMLInputElement;
    fireEvent.change(powerInput, { target: { value: '20' } });
    
    expect(powerInput.value).toBe('20');
  });

  it('updates gain input value', () => {
    render(<ParameterPanel />);
    
    const gainInput = screen.getByLabelText('Gain (dBi)') as HTMLInputElement;
    fireEvent.change(gainInput, { target: { value: '10' } });
    
    expect(gainInput.value).toBe('10');
  });

  it('toggles frequency sweep checkbox', () => {
    render(<ParameterPanel />);
    
    const checkbox = screen.getByLabelText('Enable frequency sweep') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it('updates sweep range inputs when visible', () => {
    render(<ParameterPanel />);
    
    const checkbox = screen.getByLabelText('Enable frequency sweep');
    fireEvent.click(checkbox);
    
    const startInput = screen.getByLabelText('Start Frequency (GHz)') as HTMLInputElement;
    const endInput = screen.getByLabelText('End Frequency (GHz)') as HTMLInputElement;
    
    fireEvent.change(startInput, { target: { value: '1.5' } });
    fireEvent.change(endInput, { target: { value: '4.0' } });
    
    expect(startInput.value).toBe('1.5');
    expect(endInput.value).toBe('4.0');
  });

  it('resets parameters when reset button is clicked', () => {
    render(<ParameterPanel />);
    
    // Change some values
    const frequencyInput = screen.getByLabelText('Frequency (GHz)') as HTMLInputElement;
    const powerInput = screen.getByLabelText('Power (dBm)') as HTMLInputElement;
    const checkbox = screen.getByLabelText('Enable frequency sweep') as HTMLInputElement;
    
    fireEvent.change(frequencyInput, { target: { value: '5.8' } });
    fireEvent.change(powerInput, { target: { value: '20' } });
    fireEvent.click(checkbox);
    
    // Reset
    const resetButton = screen.getByText('Reset Parameters');
    fireEvent.click(resetButton);
    
    // Check values are reset
    expect(frequencyInput.value).toBe('2.4');
    expect(powerInput.value).toBe('10');
    expect(checkbox.checked).toBe(false);
  });

  it('applies custom className', () => {
    const { container } = render(<ParameterPanel className="custom-class" />);
    const panel = container.firstChild as HTMLElement;
    expect(panel.className).toContain('custom-class');
  });

  it('renders children when provided', () => {
    render(
      <ParameterPanel>
        <div data-testid="child-content">Child content</div>
      </ParameterPanel>
    );
    
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });
});