import html2canvas from 'html2canvas';

export async function captureElementAsImage(elementId: string, scale: number = 2): Promise<string | null> {
  const element = document.getElementById(elementId);
  if (!element) return null;

  try {
    // We capture the element and ensure backgrounds are handled correctly for dark mode
    const canvas = await html2canvas(element, {
      scale: scale, // Higher scale for better PDF print quality
      useCORS: true,
      logging: false,
      backgroundColor: '#0a1628', // OMD base dark color or transparent
      // html2canvas sometimes struggles with SVGs, we ensure svg renders happen
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.getElementById(elementId);
        if (clonedEl) {
          // Adjust any styles specifically for capture if needed
          clonedEl.style.transform = 'none';
        }
      }
    });

    // Use JPEG with 0.85 quality to massively shrink PDF sizes
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch (error) {
    console.error(`Failed to capture element ${elementId}:`, error);
    return null;
  }
}
