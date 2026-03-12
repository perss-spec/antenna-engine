import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AntennaControls from './AntennaControls';

describe('AntennaControls', () => {
  it('renders length and frequency input fields', () => {
    render(<AntennaControls />);
    
    expect(screen.getByLabelText('Length:')).toBeInTheDocument();
    expect(screen.getByLabelText('Frequency:')).toBeInTheDocument();
  });

  it('renders Calculate button', () => {
    render(<AntennaControls />);
    
    expect(screen.getByRole('button', { name: 'Calculate' })).toBeInTheDocument();
  });

  it('updates length state when input changes', () => {
    render(<AntennaControls />);
    
    const lengthInput = screen.getByLabelText('Length:') as HTMLInputElement;
    fireEvent.change(lengthInput, { target: { value: '10' } });
    
    expect(lengthInput.value).toBe('10');
  });

  it('updates frequency state when input changes', () => {
    render(<AntennaControls />);
    
    const frequencyInput = screen.getByLabelText('Frequency:') as HTMLInputElement;
    fireEvent.change(frequencyInput, { target: { value: '2.4' } });
    
    expect(frequencyInput.value).toBe('2.4');
  });

  it('calls handleCalculate when Calculate button is clicked', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    render(<AntennaControls />);
    
    const calculateButton = screen.getByRole('button', { name: 'Calculate' });
    fireEvent.click(calculateButton);
    
    expect(consoleSpy).toHaveBeenCalledWith('Calculate clicked', { length: 0, frequency: 0 });
    
    consoleSpy.mockRestore();
  });

  it('handles numeric input correctly', () => {
    render(<AntennaControls />);
    
    const lengthInput = screen.getByLabelText('Length:') as HTMLInputElement;
    const frequencyInput = screen.getByLabelText('Frequency:') as HTMLInputElement;
    
    fireEvent.change(lengthInput, { target: { value: '15.5' } });
    fireEvent.change(frequencyInput, { target: { value: '900' } });
    
    expect(lengthInput.value).toBe('15.5');
    expect(frequencyInput.value).toBe('900');
  });
});