import { renderHook, act } from '@testing-library/react';
import { useResizable } from './useResizable';

describe('useResizable', () => {
  it('initializes with correct default values', () => {
    const { result } = renderHook(() => useResizable({ initialWidth: 300 }));
    
    expect(result.current.width).toBe(300);
    expect(result.current.isResizing).toBe(false);
    expect(typeof result.current.handleMouseDown).toBe('function');
    expect(typeof result.current.setWidth).toBe('function');
  });

  it('sets resizing state when mouse down is triggered', () => {
    const { result } = renderHook(() => useResizable({ initialWidth: 300 }));
    
    act(() => {
      result.current.handleMouseDown();
    });
    
    expect(result.current.isResizing).toBe(true);
  });

  it('respects min and max width constraints', () => {
    const { result } = renderHook(() => 
      useResizable({ 
        initialWidth: 300, 
        minWidth: 200, 
        maxWidth: 500 
      })
    );
    
    // Test below minimum
    act(() => {
      result.current.setWidth(100);
    });
    expect(result.current.width).toBe(200);
    
    // Test above maximum
    act(() => {
      result.current.setWidth(600);
    });
    expect(result.current.width).toBe(500);
    
    // Test within range
    act(() => {
      result.current.setWidth(350);
    });
    expect(result.current.width).toBe(350);
  });

  it('calls onResize callback when width changes', () => {
    const onResize = vi.fn();
    const { result } = renderHook(() => 
      useResizable({ 
        initialWidth: 300, 
        onResize 
      })
    );
    
    act(() => {
      result.current.setWidth(400);
    });
    
    expect(onResize).toHaveBeenCalledWith(400);
  });

  it('adds and removes event listeners correctly', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    
    const { result, unmount } = renderHook(() => useResizable({ initialWidth: 300 }));
    
    // Start resizing
    act(() => {
      result.current.handleMouseDown();
    });
    
    expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
    
    // Cleanup on unmount
    unmount();
    
    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
    
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('sets body styles during resize', () => {
    const { result } = renderHook(() => useResizable({ initialWidth: 300 }));
    
    act(() => {
      result.current.handleMouseDown();
    });
    
    expect(document.body.style.cursor).toBe('col-resize');
    expect(document.body.style.userSelect).toBe('none');
  });
});