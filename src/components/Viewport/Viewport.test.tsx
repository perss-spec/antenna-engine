import { render, screen, fireEvent } from '@testing-library/react';
import { Viewport } from './Viewport';

describe('Viewport', () => {
  it('renders the viewport structure', () => {
    render(<Viewport />);
    
    expect(screen.getByText('3D Antenna Viewer')).toBeInTheDocument();
    expect(screen.getByText('The 3D visualization will be integrated here')).toBeInTheDocument();
  });

  it('renders toolbar buttons', () => {
    render(<Viewport />);
    
    // Check for toolbar buttons by their title attributes
    expect(screen.getByTitle('Reset View')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom In')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom Out')).toBeInTheDocument();
    expect(screen.getByTitle('Wireframe')).toBeInTheDocument();
    expect(screen.getByTitle('Solid')).toBeInTheDocument();
  });

  it('renders view selector dropdown', () => {
    render(<Viewport />);
    
    const viewSelect = screen.getByDisplayValue('Perspective');
    expect(viewSelect).toBeInTheDocument();
    
    // Check if options exist
    expect(screen.getByText('Top')).toBeInTheDocument();
    expect(screen.getByText('Front')).toBeInTheDocument();
    expect(screen.getByText('Side')).toBeInTheDocument();
  });

  it('renders status bar with metrics', () => {
    render(<Viewport />);
    
    expect(screen.getByText('Mesh:')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Vertices:')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('FPS:')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('renders placeholder features', () => {
    render(<Viewport />);
    
    expect(screen.getByText('• Interactive 3D rotation')).toBeInTheDocument();
    expect(screen.getByText('• Real-time parameter updates')).toBeInTheDocument();
    expect(screen.getByText('• Radiation pattern overlay')).toBeInTheDocument();
  });

  it('allows view selection changes', () => {
    render(<Viewport />);
    
    const viewSelect = screen.getByDisplayValue('Perspective');
    fireEvent.change(viewSelect, { target: { value: 'top' } });
    expect(viewSelect).toHaveValue('top');
  });

  it('toolbar buttons are clickable', () => {
    render(<Viewport />);
    
    const resetButton = screen.getByTitle('Reset View');
    fireEvent.click(resetButton);
    // Button should be clickable (no error thrown)
    expect(resetButton).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    render(
      <Viewport>
        <div data-testid="child-component">Test Child</div>
      </Viewport>
    );
    
    expect(screen.getByTestId('child-component')).toBeInTheDocument();
  });

  it('has proper CSS classes applied', () => {
    render(<Viewport />);
    
    expect(document.querySelector('.viewport')).toBeInTheDocument();
    expect(document.querySelector('.viewport-toolbar')).toBeInTheDocument();
    expect(document.querySelector('.viewport-canvas')).toBeInTheDocument();
    expect(document.querySelector('.viewport-status')).toBeInTheDocument();
  });
});