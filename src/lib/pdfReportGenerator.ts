import { jsPDF } from 'jspdf';
import type { AntennaParameters } from '../components/AntennaForm/AntennaForm';
import type { UnifiedSimResults } from './unifiedResults';
import type { AntennaPreset, KBEntry } from './antennaKB';

export interface ReportImages {
  s11?: string | null;
  vswr?: string | null;
  smith?: string | null;
  impedance?: string | null;
}

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// OMD Brand Colors (Premium Dark Theme matching the app)
const COLORS = {
  bg: '#0a0f18',
  surface: '#121a2f',
  primary: '#f8fafc',
  secondary: '#94a3b8',
  accent: '#3b82f6',
  success: '#10b981',
  border: '#1e293b'
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

  const addFooter = (pageNumber: number) => {
    setTextColor(COLORS.secondary);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`PROMIN Antenna Studio \u2014 Report ID: ${Date.now().toString(16).toUpperCase()} \u2014 Sim Time: ${simTimeMs}ms`, MARGIN, PAGE_HEIGHT - 12);
    doc.text(`Page ${pageNumber}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 12, { align: 'right' });
  };

  let pageNum = 1;

  // --- PAGE 1: COVER ---
  setBg(COLORS.bg);
  
  // Large Logo / Branding Area
  doc.setFillColor(...hexToRgb(COLORS.surface));
  doc.rect(0, 0, PAGE_WIDTH, 120, 'F');
  
  // Accent strip
  doc.setFillColor(...hexToRgb(COLORS.accent));
  doc.rect(0, 119, PAGE_WIDTH, 1, 'F');

  setTextColor(COLORS.primary);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  const title = preset ? `${preset.name}` : 'Antenna Simulation';
  doc.text(title, MARGIN, 70);
  
  doc.setFontSize(16);
  setTextColor(COLORS.accent);
  doc.text('ENGINEERING SIMULATION REPORT', MARGIN, 82);

  setTextColor(COLORS.secondary);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, MARGIN, 95);
  doc.text(`Category: ${preset?.category?.toUpperCase() || 'CUSTOM'}`, MARGIN, 102);

  // Executive Summary
  let y = 140;
  setTextColor(COLORS.primary);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('EXECUTIVE SUMMARY', MARGIN, y);
  y += 10;
  
  setTextColor(COLORS.secondary);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const desc = kbEntry?.description || preset?.description || 'A custom antenna simulation run via PROMIN Antenna Studio.';
  const splitDesc = doc.splitTextToSize(desc, CONTENT_WIDTH);
  doc.text(splitDesc, MARGIN, y);
  y += splitDesc.length * 5 + 10;

  // Parameters Table
  doc.setFillColor(...hexToRgb(COLORS.surface));
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 50, 2, 2, 'F');
  
  setTextColor(COLORS.primary);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Physical Parameters', MARGIN + 5, y + 8);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  setTextColor(COLORS.secondary);
  
  const pCol1 = MARGIN + 5;
  const pCol2 = MARGIN + CONTENT_WIDTH / 2;
  
  doc.text(`Center Frequency: ${params.frequency} MHz`, pCol1, y + 18);
  doc.text(`Length: ${params.length} mm`, pCol1, y + 26);
  doc.text(`Radius: ${params.radius} mm`, pCol1, y + 34);
  
  doc.text(`Material: ${params.material.toUpperCase()}`, pCol2, y + 18);
  if (params.substrateEr) doc.text(`Substrate Er: ${params.substrateEr}`, pCol2, y + 26);
  if (params.substrateHeight) doc.text(`Substrate Height: ${params.substrateHeight} mm`, pCol2, y + 34);

  y += 65;

  // Key Metrics
  doc.setFillColor(...hexToRgb(COLORS.surface));
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 35, 2, 2, 'F');
  
  setTextColor(COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.text('Simulation Results', MARGIN + 5, y + 8);
  
  doc.setFont('helvetica', 'normal');
  const formatFreq = (hz: number) => (hz / 1e6).toFixed(2) + ' MHz';
  const rx = MARGIN + 5;
  
  setTextColor(COLORS.secondary);
  doc.text('Resonant Freq:', rx, y + 18);
  doc.text('Min S11:', rx + 45, y + 18);
  doc.text('Bandwidth (-10dB):', rx + 90, y + 18);
  doc.text('Status:', rx + 145, y + 18);
  
  setTextColor(COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.text(`${formatFreq(results.resonantFreq)}`, rx, y + 26);
  
  const s11Col = results.minS11 <= -10 ? COLORS.success : COLORS.primary;
  setTextColor(s11Col);
  doc.text(`${results.minS11.toFixed(2)} dB`, rx + 45, y + 26);
  
  setTextColor(COLORS.primary);
  doc.text(`${formatFreq(results.bandwidth)}`, rx + 90, y + 26);
  
  const status = results.minS11 <= -10 ? 'OPTIMAL' : 'SUBOPTIMAL';
  setTextColor(results.minS11 <= -10 ? COLORS.success : COLORS.secondary);
  doc.text(status, rx + 145, y + 26);

  addFooter(pageNum++);

  // --- PAGE 2: CHARTS (S11 & VSWR) ---
  doc.addPage();
  setBg(COLORS.bg);
  y = addHeader('Return Loss & VSWR Analysis');

  if (images.s11) {
    setTextColor(COLORS.primary);
    doc.setFontSize(12);
    doc.text('S11 Return Loss (dB)', MARGIN, y);
    y += 5;
    const imgProps = doc.getImageProperties(images.s11);
    const imgHeight = (imgProps.height * CONTENT_WIDTH) / imgProps.width;
    doc.addImage(images.s11, 'PNG', MARGIN, y, CONTENT_WIDTH, imgHeight);
    y += imgHeight + 15;
  }

  if (images.vswr) {
    setTextColor(COLORS.primary);
    doc.setFontSize(12);
    doc.text('Voltage Standing Wave Ratio (VSWR)', MARGIN, y);
    y += 5;
    const imgProps = doc.getImageProperties(images.vswr);
    const imgHeight = (imgProps.height * CONTENT_WIDTH) / imgProps.width;
    doc.addImage(images.vswr, 'PNG', MARGIN, y, CONTENT_WIDTH, imgHeight);
  }

  addFooter(pageNum++);

  // --- PAGE 3: IMPEDANCE & SMITH CHART ---
  if (images.impedance || images.smith) {
    doc.addPage();
    setBg(COLORS.bg);
    y = addHeader('Impedance Characteristics');

    if (images.impedance) {
      setTextColor(COLORS.primary);
      doc.setFontSize(12);
      doc.text('Complex Impedance Z(f) (\u2126)', MARGIN, y);
      y += 5;
      const imgProps = doc.getImageProperties(images.impedance);
      const imgHeight = (imgProps.height * (CONTENT_WIDTH)) / imgProps.width;
      doc.addImage(images.impedance, 'PNG', MARGIN, y, CONTENT_WIDTH, imgHeight);
      y += imgHeight + 15;
    }

    if (images.smith) {
      setTextColor(COLORS.primary);
      doc.setFontSize(12);
      doc.text('Smith Chart', MARGIN, y);
      y += 5;
      const imgProps = doc.getImageProperties(images.smith);
      // Smith chart is usually square, we can center it
      const size = Math.min(120, imgProps.height * (CONTENT_WIDTH) / imgProps.width);
      const xOffset = MARGIN + (CONTENT_WIDTH - size) / 2;
      doc.addImage(images.smith, 'PNG', xOffset, y, size, size);
    }
    
    addFooter(pageNum++);
  }

  // --- PAGE 4: DATA TABLE ---
  doc.addPage();
  setBg(COLORS.bg);
  y = addHeader('Sweep Data (Selected Points)');
  
  // Table Header
  doc.setFillColor(...hexToRgb(COLORS.surface));
  doc.rect(MARGIN, y, CONTENT_WIDTH, 10, 'F');
  setTextColor(COLORS.primary);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Freq (MHz)', MARGIN + 5, y + 6);
  doc.text('S11 (dB)', MARGIN + 40, y + 6);
  doc.text('VSWR', MARGIN + 75, y + 6);
  doc.text('Z Real (\u2126)', MARGIN + 110, y + 6);
  doc.text('Z Imag (\u2126)', MARGIN + 145, y + 6);
  
  y += 15;
  doc.setFont('helvetica', 'normal');
  
  // Sub-sample data to fit exactly one page (~40 rows)
  const maxRows = 45;
  const step = Math.max(1, Math.floor(results.frequencies.length / maxRows));
  
  for (let i = 0; i < results.frequencies.length; i += step) {
    if (y > PAGE_HEIGHT - 30) {
      addFooter(pageNum++);
      doc.addPage();
      setBg(COLORS.bg);
      y = addHeader('Sweep Data (Cont.)');
    }
    
    const f = (results.frequencies[i] / 1e6).toFixed(2);
    const s11 = results.s11Db[i].toFixed(2);
    const vswr = results.vswr[i] < 100 ? results.vswr[i].toFixed(2) : '>100';
    const zr = results.impedanceReal[i].toFixed(2);
    const zi = results.impedanceImag[i].toFixed(2);
    
    // Highlight resonant point
    const isRes = (results.frequencies[i] === results.resonantFreq);
    if (isRes) {
      doc.setFillColor(...hexToRgb('#1e40af')); // dark blue highlight
      doc.rect(MARGIN, y - 4, CONTENT_WIDTH, 6, 'F');
      setTextColor(COLORS.primary);
    } else {
      setTextColor(COLORS.secondary);
    }

    doc.text(f, MARGIN + 5, y);
    doc.text(s11, MARGIN + 40, y);
    doc.text(vswr, MARGIN + 75, y);
    doc.text(zr, MARGIN + 110, y);
    doc.text(zi, MARGIN + 145, y);
    
    y += 5;
  }

  addFooter(pageNum);

  // Trigger download
  const filename = `OMD_Report_${preset?.id || 'antenna'}_${Date.now()}.pdf`;
  doc.save(filename);
}
