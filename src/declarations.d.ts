// Module declarations for packages without type definitions

declare module 'react-chartjs-2' {
  import { ComponentType } from 'react';
  export const Line: ComponentType<{ data: unknown; options?: unknown }>;
  export const Bar: ComponentType<{ data: unknown; options?: unknown }>;
  export const Pie: ComponentType<{ data: unknown; options?: unknown }>;
}

declare module 'chart.js' {
  export const Chart: {
    register: (...args: unknown[]) => void;
  };
  export { Chart as ChartJS };
  export const CategoryScale: unknown;
  export const LinearScale: unknown;
  export const PointElement: unknown;
  export const LineElement: unknown;
  export const Title: unknown;
  export const Tooltip: unknown;
  export const Legend: unknown;
}

declare module '@radix-ui/react-slot' {
  import { ComponentType, PropsWithChildren, HTMLAttributes } from 'react';
  export const Slot: ComponentType<PropsWithChildren<HTMLAttributes<HTMLElement>> & { ref?: unknown }>;
}

declare module '@radix-ui/react-label' {
  import { ComponentType, LabelHTMLAttributes, ForwardRefExoticComponent, RefAttributes } from 'react';
  export const Root: ForwardRefExoticComponent<LabelHTMLAttributes<HTMLLabelElement> & RefAttributes<HTMLLabelElement>>;
}

declare module '@radix-ui/react-select' {
  import { ComponentType, ReactNode, HTMLAttributes, ForwardRefExoticComponent, RefAttributes, ButtonHTMLAttributes, SelectHTMLAttributes } from 'react';
  export const Root: ComponentType<SelectHTMLAttributes<HTMLSelectElement> & { value?: string; onValueChange?: (value: string) => void; children?: ReactNode; [key: string]: unknown }>;
  export const Group: ComponentType<{ children?: ReactNode }>;
  export const Value: ComponentType<{ placeholder?: string }>;
  export const Trigger: ForwardRefExoticComponent<ButtonHTMLAttributes<HTMLButtonElement> & { className?: string; children?: ReactNode } & RefAttributes<HTMLButtonElement>>;
  export const Icon: ComponentType<{ asChild?: boolean; children?: ReactNode }>;
  export const Portal: ComponentType<{ children?: ReactNode }>;
  export const Content: ForwardRefExoticComponent<HTMLAttributes<HTMLDivElement> & { position?: string; className?: string; children?: ReactNode } & RefAttributes<HTMLDivElement>>;
  export const Viewport: ComponentType<{ className?: string; children?: ReactNode }>;
  export const Label: ForwardRefExoticComponent<HTMLAttributes<HTMLDivElement> & { className?: string } & RefAttributes<HTMLDivElement>>;
  export const Item: ForwardRefExoticComponent<HTMLAttributes<HTMLDivElement> & { value: string; className?: string; children?: ReactNode; disabled?: boolean } & RefAttributes<HTMLDivElement>>;
  export const ItemIndicator: ComponentType<{ children?: ReactNode }>;
  export const ItemText: ComponentType<{ children?: ReactNode }>;
  export const Separator: ForwardRefExoticComponent<HTMLAttributes<HTMLDivElement> & { className?: string } & RefAttributes<HTMLDivElement>>;
}
