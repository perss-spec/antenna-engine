import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AntennaForm from './AntennaForm';
import type { DipoleParams } from './AntennaForm';

const mockOnSubmit = vi.fn();

const defaultProps = {
  onSubmit: mockOnSubmit
};

describe('AntennaForm', () => {
  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('renders with default values', () => {
    render(<AntennaForm {...defaultProps} />);
    
    expect(screen.getByDisplayValue('0.15')).toBeInTheDocument(); // length
    expect(screen.getByDisplayValue('0.001')).toBeInTheDocument(); // radius
    expect(screen.getByDisplayValue('1000000000')).toBeInTheDocument(); // frequency
    expect(screen.getByDisplayValue('21')).toBeInTheDocument(); // segments
  });

  it('renders with initial params', () => {
    const initialParams = {
      length: 0.3,
      frequency: 2e9
    };
    
    render(<AntennaForm {...defaultProps} initialParams={initialParams} />);
    
    expect(screen.getByDisplayValue('0.3')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2000000000')).toBeInTheDocument();
  });

  it('displays frequency in human-readable format', () => {
    render(<AntennaForm {...defaultProps} />);
    expect(screen.getByText('1.00 GHz')).toBeInTheDocument();
  });

  it('validates length input', async () => {
    const user = userEvent.setup();
    render(<AntennaForm {...defaultProps} />);
    
    const lengthInput = screen.getByLabelText('Length (m)');
    
    // Test negative length
    await user.clear(lengthInput);
    await user.type(lengthInput, '-1');
    fireEvent.blur(lengthInput);
    
    expect(screen.getByText('Length must be positive')).toBeInTheDocument();
  });

  it('validates radius vs length relationship', async () => {
    const user = userEvent.setup();
    render(<AntennaForm {...defaultProps} />);
    
    const lengthInput = screen.getByLabelText('Length (m)');
    const radiusInput = screen.getByLabelText('Wire Radius (m)');
    
    // Set radius larger than half the length
    await user.clear(lengthInput);
    await user.type(lengthInput, '0.1');
    await user.clear(radiusInput);
    await user.type(radiusInput, '0.06');
    
    fireEvent.submit(screen.getByRole('button', { name: /run simulation/i }));
    
    await waitFor(() => {
      expect(screen.getByText('Radius must be less than half the length')).toBeInTheDocument();
    });
  });

  it('validates segments to be odd', async () => {
    const user = userEvent.setup();
    render(<AntennaForm {...defaultProps} />);
    
    const segmentsInput = screen.getByLabelText('Segments (odd number)');
    
    await user.clear(segmentsInput);
    await user.type(segmentsInput, '20');
    
    fireEvent.submit(screen.getByRole('button', { name: /run simulation/i }));
    
    await waitFor(() => {
      expect(screen.getByText('Segments must be odd for center feed')).toBeInTheDocument();
    });
  });

  it('submits valid form data', async () => {
    const user = userEvent.setup();
    render(<AntennaForm {...defaultProps} />);
    
    const submitButton = screen.getByRole('button', { name: /run simulation/i });
    await user.click(submitButton);
    
    expect(mockOnSubmit).toHaveBeenCalledWith({
      length: 0.15,
      radius: 0.001,
      frequency: 1000000000,
      segments: 21
    });
  });

  it('disables form when simulating', () => {
    render(<AntennaForm {...defaultProps} isSimulating={true} />);
    
    const lengthInput = screen.getByLabelText('Length (m)');
    const submitButton = screen.getByRole('button', { name: /simulating/i });
    
    expect(lengthInput).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });

  it('prevents submission with validation errors', async () => {
    const user = userEvent.setup();
    render(<AntennaForm {...defaultProps} />);
    
    const lengthInput = screen.getByLabelText('Length (m)');
    
    // Set invalid length
    await user.clear(lengthInput);
    await user.type(lengthInput, '0');
    
    const submitButton = screen.getByRole('button', { name: /run simulation/i });
    await user.click(submitButton);
    
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    const { container } = render(
      <AntennaForm {...defaultProps} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('antenna-form', 'custom-class');
  });
});