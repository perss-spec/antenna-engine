export interface SchematicProps {
  params: Record<string, number>;
  frequency: number; // Hz
  width?: number;
  height?: number;
}

export interface DimensionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  color?: string;
  offset?: number;
}
