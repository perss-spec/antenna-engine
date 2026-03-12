import { render, screen, fireEvent } from '@testing-library/react';
import { MainLayout } from './MainLayout';

describe('MainLayout', () => {
  it('renders the main layout structure', () => {
    render(<MainLayout />);
    
    expect(screen.getByText('Antenna Parameters')).toBeInTheDocument();
    expect(screen.getByText('3D Viewport')).toBeInTheDocument();
    expect(screen.getByText('Geometry')).toBeInTheDocument();
    expect(screen.getByText('Material Properties')).toBeInTheDocument();
    expect(screen.getByText('Simulation Settings')).toBeInTheDocument();
  });

  it('renders viewport controls', () => {
    render(<MainLayout />);
    
    expect(screen.getByText('Reset View')).toBeInTheDocument();
    expect(screen.getByText('Wireframe')).toBeInTheDocument();
    expect(screen.getByText('Solid')).toBeInTheDocument();
  });

  it('renders placeholder content', () => {
    render(<MainLayout />);
    
    expect(screen.getByText('Parameter controls coming soon...')).toBeInTheDocument();
    expect(screen.getByText('3D Antenna Visualization')).toBeInTheDocument();
    expect(screen.getByText('WebGPU integration coming soon...')).toBeInTheDocument();
  });

  it('renders custom children in viewport', () => {
    const customContent = <div data-testid="custom-viewport">Custom 3D Content</div>;
    render(<MainLayout>{customContent}</MainLayout>);
    
    expect(screen.getByTestId('custom-viewport')).toBeInTheDocument();
    expect(screen.getByText('Custom 3D Content')).toBeInTheDocument();
    expect(screen.queryByText('3D Antenna Visualization')).not.toBeInTheDocument();
  });

  it('has resizable panel functionality', () => {
    render(<MainLayout />);
    
    const resizeHandle = document.querySelector('.resize-handle');
    expect(resizeHandle).toBeInTheDocument();
    
    // Test mouse down event
    if (resizeHandle) {
      fireEvent.mouseDown(resizeHandle);
      expect(resizeHandle).toHaveClass('resizing');
    }
  });

  it('applies correct CSS classes', () => {
    render(<MainLayout />);
    
    const mainLayout = document.querySelector('.main-layout');
    const parameterPanel = document.querySelector('.parameter-panel');
    const viewportContainer = document.querySelector('.viewport-container');
    
    expect(mainLayout).toBeInTheDocument();
    expect(parameterPanel).toBeInTheDocument();
    expect(viewportContainer).toBeInTheDocument();
  });

  it('has proper accessibility structure', () => {
    render(<MainLayout />);
    
    const headings = screen.getAllByRole('heading');
    expect(headings).toHaveLength(5); // Main headings + section headings
    
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3); // Viewport control buttons
  });
});