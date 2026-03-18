import { jsPDF } from 'jspdf';
import type { AntennaParameters } from '../components/AntennaForm/AntennaForm';
import type { UnifiedSimResults } from './unifiedResults';
import type { AntennaPreset, KBEntry } from './antennaKB';

export interface ReportImages {
  s11?: string | null;
  vswr?: string | null;
  smith?: string | null;
  impedance?: string | null;
  threeD?: string | null;
  radiation?: string | null;
}

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// OMD Brand Colors (Premium Dark Theme)
const COLORS = {
  bg: '#0a0f18',
  surface: '#121a2f',
  primary: '#f8fafc',
  secondary: '#94a3b8',
  accent: '#3b82f6',
  success: '#10b981',
  border: '#1e293b',
  tableHeader: '#1e293b',
  tableRowAlt: '#0f172a'
};

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.substring(1);
  const rgb = parseInt(c, 16);
  return [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255];
}

export async function generatePdfReport(
  params: AntennaParameters,
  results: UnifiedSimResults,
  preset: AntennaPreset | undefined,
  kbEntry: KBEntry | undefined,
  images: ReportImages,
  simTimeMs: number
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  const setBg = (color: string) => {
    doc.setFillColor(...hexToRgb(color));
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');
  };

  const setTextColor = (color: string) => doc.setTextColor(...hexToRgb(color));
  
  const addHeader = (title: string, yPos: number = MARGIN) => {
    setTextColor(COLORS.accent);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('OMD ENGINEERING', MARGIN, yPos);
    
    setTextColor(COLORS.primary);
    doc.setFontSize(18);
    doc.text(title, MARGIN, yPos + 8);
    
    doc.setDrawColor(...hexToRgb(COLORS.border));
    doc.setLineWidth(0.5);
    doc.line(MARGIN, yPos + 12, PAGE_WIDTH - MARGIN, yPos + 12);
    
    return yPos + 22;
  };

  const addSectionHeader = (number: string, title: string, yPos: number) => {
    doc.setFillColor(...hexToRgb(COLORS.surface));
    doc.rect(MARGIN, yPos, CONTENT_WIDTH, 10, 'F');
    
    doc.setFillColor(...hexToRgb(COLORS.accent));
    doc.rect(MARGIN, yPos, 3, 10, 'F'); // left accent bar
    
    setTextColor(COLORS.primary);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${number}. ${title.toUpperCase()}`, MARGIN + 6, yPos + 6.5);
    
    return yPos + 16;
  };

  const addFigureCaption = (figureNum: number, text: string, yPos: number) => {
    setTextColor(COLORS.secondary);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    const fullText = `Figure ${figureNum}: ${text}`;
    const txtWidth = doc.getTextWidth(fullText);
    doc.text(fullText, (PAGE_WIDTH - txtWidth) / 2, yPos);
    return yPos + 8;
  };

  const addFooter = (pageNumber: number) => {
    setTextColor(COLORS.secondary);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setDrawColor(...hexToRgb(COLORS.border));
    doc.setLineWidth(0.5);
    doc.line(MARGIN, PAGE_HEIGHT - 16, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 16);
    
    doc.text(`PROMIN Antenna Studio \u2014 Report ID: ${Date.now().toString(16).toUpperCase()} \u2014 Sim Time: ${simTimeMs}ms`, MARGIN, PAGE_HEIGHT - 10);
    doc.text(`Page ${pageNumber}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10, { align: 'right' });
    
    doc.setFontSize(7);
    doc.text('OMD Confidential & Proprietary', PAGE_WIDTH / 2, PAGE_HEIGHT - 6, { align: 'center' });
  };

  let pageNum = 1;
  let figNum = 1;

  // --- PAGE 1: COVER & OVERVIEW ---
  setBg(COLORS.bg);
  
  // Large Logo / Branding Area
  doc.setFillColor(...hexToRgb(COLORS.surface));
  doc.rect(0, 0, PAGE_WIDTH, 120, 'F');
  
  // Accent strip
  doc.setFillColor(...hexToRgb(COLORS.accent));
  doc.rect(0, 119, PAGE_WIDTH, 1, 'F');

  setTextColor(COLORS.primary);
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  const title = preset ? `${preset.name}` : 'Antenna Simulation';
  doc.text(title, MARGIN, 65);
  
  doc.setFontSize(16);
  setTextColor(COLORS.accent);
  doc.text('ENGINEERING DESIGN REPORT', MARGIN, 78);

  setTextColor(COLORS.secondary);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, MARGIN, 95);
  doc.text(`Category: ${preset?.category?.toUpperCase() || 'CUSTOM'}`, MARGIN, 102);

  // Section 1: General Info
  let y = 135;
  y = addSectionHeader('1', 'General Information', y);
  
  setTextColor(COLORS.secondary);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const desc = kbEntry?.description || preset?.description || 'A custom antenna simulation run via PROMIN Antenna Studio.';
  const splitDesc = doc.splitTextToSize(desc, CONTENT_WIDTH);
  doc.text(splitDesc, MARGIN, y);
  y += splitDesc.length * 5 + 8;

  // Section 2: Physical Parameters
  y = addSectionHeader('2', 'Physical Parameters', y);
  
  // Draw Styled Table for Params
  doc.setFontSize(10);
  const startY = y;
  
  const drawRow = (label: string, value: string, rowY: number, alt: boolean) => {
    if (alt) {
      doc.setFillColor(...hexToRgb(COLORS.tableRowAlt));
      doc.rect(MARGIN, rowY, CONTENT_WIDTH, 8, 'F');
    }
    setTextColor(COLORS.secondary);
    doc.setFont('helvetica', 'bold');
    doc.text(label, MARGIN + 4, rowY + 5.5);
    setTextColor(COLORS.primary);
    doc.setFont('helvetica', 'normal');
    const valWidth = doc.getTextWidth(value);
    doc.text(value, MARGIN + CONTENT_WIDTH - valWidth - 4, rowY + 5.5);
    return rowY + 8;
  };
  
  y = drawRow('Center Frequency', `${params.frequency} MHz`, y, false);
  y = drawRow('Length / Diameter', `${params.length} mm`, y, true);
  y = drawRow('Radius / Width', `${params.radius} mm`, y, false);
  y = drawRow('Conductor Material', params.material.toUpperCase(), y, true);
  if (params.substrateEr) y = drawRow('Substrate Permittivity (Er)', `${params.substrateEr}`, y, false);
  if (params.substrateHeight) y = drawRow('Substrate Height (h)', `${params.substrateHeight} mm`, y, params.substrateEr ? true : false);
  
  doc.setDrawColor(...hexToRgb(COLORS.border));
  doc.rect(MARGIN, startY, CONTENT_WIDTH, y - startY); // outer box
  
  y += 10;

  // Section 3: Performance Summary
  y = addSectionHeader('3', 'Design Objectives & Performance', y);
  
  const pStartY = y;
  const formatFreq = (hz: number) => (hz / 1e6).toFixed(2) + ' MHz';
  
  y = drawRow('Resonant Frequency', formatFreq(results.resonantFreq), y, false);
  
  // Custom colored S11 row
  doc.setFillColor(...hexToRgb(COLORS.tableRowAlt));
  doc.rect(MARGIN, y, CONTENT_WIDTH, 8, 'F');
  setTextColor(COLORS.secondary);
  doc.setFont('helvetica', 'bold');
  doc.text('Minimum S11 Return Loss', MARGIN + 4, y + 5.5);
  doc.setFont('helvetica', 'normal');
  const s11Col = results.minS11 <= -10 ? COLORS.success : COLORS.primary;
  setTextColor(s11Col);
  const s11Tx = `${results.minS11.toFixed(2)} dB`;
  const s11TxW = doc.getTextWidth(s11Tx);
  doc.text(s11Tx, MARGIN + CONTENT_WIDTH - s11TxW - 4, y + 5.5);
  y += 8;
  
  y = drawRow('Operational Bandwidth (-10dB)', formatFreq(results.bandwidth), y, false);
  
  // Custom colored Status row
  doc.setFillColor(...hexToRgb(COLORS.tableRowAlt));
  doc.rect(MARGIN, y, CONTENT_WIDTH, 8, 'F');
  setTextColor(COLORS.secondary);
  doc.setFont('helvetica', 'bold');
  doc.text('System Status', MARGIN + 4, y + 5.5);
  doc.setFont('helvetica', 'normal');
  const status = results.minS11 <= -10 ? 'OPTIMAL' : 'SUBOPTIMAL';
  setTextColor(results.minS11 <= -10 ? COLORS.success : COLORS.secondary);
  const stTxW = doc.getTextWidth(status);
  doc.text(status, MARGIN + CONTENT_WIDTH - stTxW - 4, y + 5.5);
  y += 8;

  doc.setDrawColor(...hexToRgb(COLORS.border));
  doc.rect(MARGIN, pStartY, CONTENT_WIDTH, y - pStartY); // outer box

  addFooter(pageNum++);

  // --- PAGE 2: 3D MODEL & RADIATION (Optional) ---
  if (images.threeD || images.radiation) {
    doc.addPage();
    setBg(COLORS.bg);
    y = addHeader('Antenna Geometry & Radiation');
    y = addSectionHeader('4', '3D Visualizations', y);

    if (images.threeD) {
      const imgProps = doc.getImageProperties(images.threeD);
      const sizeLimit = 120; // maximum height
      let imgWidth = CONTENT_WIDTH;
      let imgHeight = (imgProps.height * CONTENT_WIDTH) / imgProps.width;
      if (imgHeight > sizeLimit) {
        imgHeight = sizeLimit;
        imgWidth = (imgProps.width * sizeLimit) / imgProps.height;
      }
      doc.addImage(images.threeD, 'JPEG', MARGIN + (CONTENT_WIDTH - imgWidth)/2, y, imgWidth, imgHeight);
      y += imgHeight + 4;
      y = addFigureCaption(figNum++, '3D Antenna Geometry Overview', y);
      y += 8;
    }

    if (images.radiation) {
      const imgProps = doc.getImageProperties(images.radiation);
      const sizeLimit = 120; // max height
      let imgWidth = CONTENT_WIDTH;
      let imgHeight = (imgProps.height * CONTENT_WIDTH) / imgProps.width;
      if (imgHeight > sizeLimit) {
        imgHeight = sizeLimit;
        imgWidth = (imgProps.width * sizeLimit) / imgProps.height;
      }
      doc.addImage(images.radiation, 'JPEG', MARGIN + (CONTENT_WIDTH - imgWidth)/2, y, imgWidth, imgHeight);
      y += imgHeight + 4;
      y = addFigureCaption(figNum++, '3D Far-field Radiation Pattern (Directivity/Gain)', y);
    }

    addFooter(pageNum++);
  }

  // --- PAGE 3: CHARTS (S11 & VSWR) ---
  doc.addPage();
  setBg(COLORS.bg);
  y = addHeader('Reflection & VSWR Characteristics');
  y = addSectionHeader('5', 'S-Parameter Analysis', y);

  if (images.s11) {
    const imgProps = doc.getImageProperties(images.s11);
    const imgHeight = Math.min((imgProps.height * CONTENT_WIDTH) / imgProps.width, 100);
    const imgWidth = (imgProps.width * imgHeight) / imgProps.height;
    doc.addImage(images.s11, 'JPEG', MARGIN + (CONTENT_WIDTH - imgWidth)/2, y, imgWidth, imgHeight);
    y += imgHeight + 4;
    y = addFigureCaption(figNum++, 'Input Reflection Coefficient (S11) vs Frequency', y);
    y += 8;
  }

  if (images.vswr) {
    const imgProps = doc.getImageProperties(images.vswr);
    const imgHeight = Math.min((imgProps.height * CONTENT_WIDTH) / imgProps.width, 100);
    const imgWidth = (imgProps.width * imgHeight) / imgProps.height;
    doc.addImage(images.vswr, 'JPEG', MARGIN + (CONTENT_WIDTH - imgWidth)/2, y, imgWidth, imgHeight);
    y += imgHeight + 4;
    y = addFigureCaption(figNum++, 'Voltage Standing Wave Ratio (VSWR)', y);
  }

  addFooter(pageNum++);

  // --- PAGE 4: IMPEDANCE & SMITH CHART ---
  if (images.impedance || images.smith) {
    doc.addPage();
    setBg(COLORS.bg);
    y = addHeader('Impedance & Smith Chart');
    y = addSectionHeader('6', 'Complex Impedance', y);

    if (images.impedance) {
      const imgProps = doc.getImageProperties(images.impedance);
      const imgHeight = Math.min((imgProps.height * CONTENT_WIDTH) / imgProps.width, 95);
      const imgWidth = (imgProps.width * imgHeight) / imgProps.height;
      doc.addImage(images.impedance, 'JPEG', MARGIN + (CONTENT_WIDTH - imgWidth)/2, y, imgWidth, imgHeight);
      y += imgHeight + 4;
      y = addFigureCaption(figNum++, 'Complex Impedance Z(f) (Real & Imaginary)', y);
      y += 8;
    }

    if (images.smith) {
      const imgProps = doc.getImageProperties(images.smith);
      const size = Math.min(110, imgProps.height * (CONTENT_WIDTH) / imgProps.width);
      const xOffset = MARGIN + (CONTENT_WIDTH - size) / 2;
      doc.addImage(images.smith, 'JPEG', xOffset, y, size, size);
      y += size + 4;
      y = addFigureCaption(figNum++, 'Smith Chart Reflection Tracking', y);
    }
    
    addFooter(pageNum++);
  }

  // --- PAGE 5: DATA TABLE APPENDIX ---
  doc.addPage();
  setBg(COLORS.bg);
  y = addHeader('Appendix A: Simulation Data Table');
  
  // Table Header Layout
  doc.setFillColor(...hexToRgb(COLORS.tableHeader));
  doc.rect(MARGIN, y, CONTENT_WIDTH, 10, 'F');
  setTextColor(COLORS.primary);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const cols = [
    { label: 'Freq (MHz)', x: MARGIN + 5 },
    { label: 'S11 (dB)', x: MARGIN + 40 },
    { label: 'VSWR', x: MARGIN + 75 },
    { label: 'Z Real (\u2126)', x: MARGIN + 110 },
    { label: 'Z Imag (\u2126)', x: MARGIN + 145 }
  ];
  cols.forEach(col => doc.text(col.label, col.x, y + 6.5));
  
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  // Sub-sample data to fit exactly one page (~40 rows)
  const maxRows = 43;
  const step = Math.max(1, Math.floor(results.frequencies.length / maxRows));
  let isAltRow = true;
  
  for (let i = 0; i < results.frequencies.length; i += step) {
    if (y > PAGE_HEIGHT - 30) {
      addFooter(pageNum++);
      doc.addPage();
      setBg(COLORS.bg);
      y = addHeader('Appendix A: Sweep Data (Cont.)');
      
      // Reprint header
      doc.setFillColor(...hexToRgb(COLORS.tableHeader));
      doc.rect(MARGIN, y, CONTENT_WIDTH, 10, 'F');
      setTextColor(COLORS.primary);
      doc.setFont('helvetica', 'bold');
      cols.forEach(col => doc.text(col.label, col.x, y + 6.5));
      y += 10;
      doc.setFont('helvetica', 'normal');
      isAltRow = true;
    }
    
    if (isAltRow) {
      doc.setFillColor(...hexToRgb(COLORS.tableRowAlt));
      doc.rect(MARGIN, y, CONTENT_WIDTH, 6, 'F');
    }
    isAltRow = !isAltRow;

    const f = (results.frequencies[i] / 1e6).toFixed(2);
    const s11 = results.s11Db[i].toFixed(2);
    const vswr = results.vswr[i] < 100 ? results.vswr[i].toFixed(2) : '>100';
    const zr = results.impedanceReal[i].toFixed(2);
    const zi = results.impedanceImag[i].toFixed(2);
    
    // Highlight resonant point
    const isRes = (results.frequencies[i] === results.resonantFreq);
    if (isRes) {
      doc.setFillColor(...hexToRgb('#1e40af')); // dark blue highlight
      doc.rect(MARGIN, y, CONTENT_WIDTH, 6, 'F');
      setTextColor(COLORS.primary);
      doc.setFont('helvetica', 'bold');
    } else {
      setTextColor(COLORS.secondary);
      doc.setFont('helvetica', 'normal');
    }

    doc.text(f, cols[0].x, y + 4);
    doc.text(s11, cols[1].x, y + 4);
    doc.text(vswr, cols[2].x, y + 4);
    doc.text(zr, cols[3].x, y + 4);
    doc.text(zi, cols[4].x, y + 4);
    
    y += 6;
  }

  addFooter(pageNum);

  // Trigger download
  const filename = `OMD_Report_${preset?.id || 'antenna'}_${Date.now()}.pdf`;
  doc.save(filename);
}
