import type { FC, ReactNode } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: string;
  unit: string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
}

const TrendIndicator: FC<Pick<StatCardProps, 'trend' | 'trendValue'>> = ({ trend, trendValue }) => {
  if (!trend || trend === 'neutral' || !trendValue) {
    return null;
  }

  const isUp = trend === 'up';
  const TrendIcon = isUp ? ArrowUp : ArrowDown;
  const trendColor = isUp ? 'text-success' : 'text-error';

  return (
    <div className={cn('flex items-center gap-1 text-xs font-medium', trendColor)}>
      <TrendIcon className="h-3 w-3" />
      <span>{trendValue}</span>
    </div>
  );
};

const StatCard: FC<StatCardProps> = ({
  label,
  value,
  unit,
  icon,
  trend,
  trendValue,
  className,
}) => {
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="text-sm font-medium text-text-muted">{label}</div>
        <span className="text-text-muted">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-text tabular-nums">{value}</span>
          <span className="text-sm text-text-muted">{unit}</span>
        </div>
        {trend && trendValue && (
          <div className="mt-1">
            <TrendIndicator trend={trend} trendValue={trendValue} />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StatCard;
