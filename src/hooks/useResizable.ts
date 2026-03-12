import { useState, useCallback, useEffect } from 'react';

interface UseResizableOptions {
  initialWidth: number;
  minWidth?: number;
  maxWidth?: number;
  onResize?: (width: number) => void;
}

interface UseResizableReturn {
  width: number;
  isResizing: boolean;
  handleMouseDown: () => void;
  setWidth: (width: number) => void;
}

export const useResizable = ({
  initialWidth,
  minWidth = 100,
  maxWidth = 800,
  onResize
}: UseResizableOptions): UseResizableReturn => {
  const [width, setWidthState] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  const setWidth = useCallback((newWidth: number) => {
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    setWidthState(clampedWidth);
    onResize?.(clampedWidth);
  }, [minWidth, maxWidth, onResize]);

  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    e.preventDefault();
    setWidth(e.clientX);
  }, [isResizing, setWidth]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return {
    width,
    isResizing,
    handleMouseDown,
    setWidth
  };
};