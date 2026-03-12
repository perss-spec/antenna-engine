import type { FC, ComponentType } from 'react';
import { Pencil, Zap, BarChart3, Download, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const navItems: readonly NavItem[] = [
  { id: 'design', label: 'Design', icon: Pencil },
  { id: 'simulate', label: 'Simulate', icon: Zap },
  { id: 'results', label: 'Results', icon: BarChart3 },
  { id: 'export', label: 'Export', icon: Download },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export interface SidebarNavProps {
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
  className?: string;
}

const SidebarNav: FC<SidebarNavProps> = ({ activeSection, onSectionChange, className }) => {
  return (
    <nav className={cn('flex flex-col gap-1 p-2 bg-surface border-r border-border', className)}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeSection === item.id;
        return (
          <Button
            key={item.id}
            variant={isActive ? 'default' : 'ghost'}
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => onSectionChange(item.id)}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Button>
        );
      })}
    </nav>
  );
};

export default SidebarNav;
