import type { FC } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ExportPanelProps {
  frequencies: number[];
  s11Db: number[];
  s11Real: number[];
  s11Imag: number[];
  impedanceReal: number[];
  impedanceImag: number[];
  disabled?: boolean;
  className?: string;
}

const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const generateS1PContent = (
  frequencies: number[],
  s11Real: number[],
  s11Imag: number[]
): string => {
  const header = `! PROMIN Antenna Studio Export - ${new Date().toISOString()}\n# MHz S RI R 50\n`;
  const data = frequencies
    .map((freq, i) => {
      const freqMhz = (freq / 1e6).toFixed(6);
      const real = (s11Real[i] ?? 0).toFixed(8);
      const imag = (s11Imag[i] ?? 0).toFixed(8);
      return `${freqMhz} ${real} ${imag}`;
    })
    .join('\n');
  return header + data;
};

const generateCSVContent = (
  frequencies: number[],
  s11Db: number[],
  s11Real: number[],
  s11Imag: number[],
  impedanceReal: number[],
  impedanceImag: number[]
): string => {
  const header = 'Frequency (MHz),S11 (dB),S11 Real,S11 Imag,Impedance Real (Ohm),Impedance Imag (Ohm)\n';
  const data = frequencies
    .map((freq, i) => {
      const freqMhz = (freq / 1e6).toFixed(3);
      const db = (s11Db[i] ?? 0).toFixed(3);
      const s_real = (s11Real[i] ?? 0).toFixed(5);
      const s_imag = (s11Imag[i] ?? 0).toFixed(5);
      const z_real = (impedanceReal[i] ?? 0).toFixed(3);
      const z_imag = (impedanceImag[i] ?? 0).toFixed(3);
      return `${freqMhz},${db},${s_real},${s_imag},${z_real},${z_imag}`;
    })
    .join('\n');
  return header + data;
};

const ExportPanel: FC<ExportPanelProps> = ({
  frequencies,
  s11Db,
  s11Real,
  s11Imag,
  impedanceReal,
  impedanceImag,
  disabled = false,
  className,
}) => {
  const handleExportS1P = () => {
    const content = generateS1PContent(frequencies, s11Real, s11Imag);
    downloadFile(content, `promin_export_${Date.now()}.s1p`, 'application/touchstone');
  };

  const handleExportCSV = () => {
    const content = generateCSVContent(
      frequencies,
      s11Db,
      s11Real,
      s11Imag,
      impedanceReal,
      impedanceImag
    );
    downloadFile(content, `promin_export_${Date.now()}.csv`, 'text/csv;charset=utf-8;');
  };

  const isExportDisabled = disabled || frequencies.length === 0;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button onClick={handleExportS1P} disabled={isExportDisabled} variant="outline" size="sm" className="flex-1">
        <Download className="h-3 w-3 mr-1.5" />
        Export S1P
      </Button>
      <Button onClick={handleExportCSV} disabled={isExportDisabled} variant="outline" size="sm" className="flex-1">
        <Download className="h-3 w-3 mr-1.5" />
        Export CSV
      </Button>
    </div>
  );
};

export default ExportPanel;
