import { render, screen, fireEvent } from '@testing-library/react';
import AntennaForm from './AntennaForm';

const mockParameters = {
  frequency: 100,
  length: 50,
  radius: 1,
  height: 100,
  material: 'copper'
};

const mockProps = {
  parameters: mockParameters,
  onParametersChange: vi.fn(),
  onSubmit: vi.fn()
};

describe('AntennaForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form title', () => {
    render(<AntennaForm {...mockProps} />);
    expect(screen.getByText('Dipole Antenna Parameters')).toBeInTheDocument();
  });

  it('renders all input fields', () => {
    render(<AntennaForm {...mockProps} />);
    
    expect(screen.getByLabelText('Frequency (MHz)')).toBeInTheDocument();
    expect(screen.getByLabelText('Length (mm)')).toBeInTheDocument();
    expect(screen.getByLabelText('Wire Radius (mm)')).toBeInTheDocument();
    expect(screen.getByLabelText('Height Above Ground (mm)')).toBeInTheDocument();
    expect(screen.getByLabelText('Material')).toBeInTheDocument();
  });

  it('displays current parameter values', () => {
    render(<AntennaForm {...mockProps} />);
    
    expect(screen.getByDisplayValue('100')).toBeInTheDocument(); // frequency
    expect(screen.getByDisplayValue('50')).toBeInTheDocument(); // length
    expect(screen.getByDisplayValue('1')).toBeInTheDocument(); // radius
    expect(screen.getByDisplayValue('copper')).toBeInTheDocument(); // material
  });

  it('calls onParametersChange when input changes', () => {
    render(<AntennaForm {...mockProps} />);
    
    const frequencyInput = screen.getByLabelText('Frequency (MHz)');
    fireEvent.change(frequencyInput, { target: { value: '200' } });
    
    expect(mockProps.onParametersChange).toHaveBeenCalledWith({
      ...mockParameters,
      frequency: 200
    });
  });

  it('calls onSubmit when form is submitted', () => {
    render(<AntennaForm {...mockProps} />);
    
    const submitButton = screen.getByText('Run Simulation');
    fireEvent.click(submitButton);
    
    expect(mockProps.onSubmit).toHaveBeenCalledWith(mockParameters);
  });

  it('disables inputs when simulating', () => {
    render(<AntennaForm {...mockProps} isSimulating={true} />);
    
    expect(screen.getByLabelText('Frequency (MHz)')).toBeDisabled();
    expect(screen.getByLabelText('Length (mm)')).toBeDisabled();
    expect(screen.getByText('Simulating...')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<AntennaForm {...mockProps} className="custom-class" />);
    expect(container.firstChild).toHaveClass('antenna-form', 'custom-class');
  });
});