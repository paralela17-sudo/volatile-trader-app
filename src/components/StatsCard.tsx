import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: "up" | "down";
  trendValue?: string;
}

export const StatsCard = ({ title, value, icon, trend, trendValue }: StatsCardProps) => {
  return (
    <Card className="p-6 bg-gradient-card border-border hover:border-primary transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-3xl font-bold tracking-tight font-mono">{value}</p>
          {trendValue && trend && (
            <div className={`flex items-center gap-1 text-sm ${trend === 'up' ? 'text-success' : 'text-danger'}`}>
              {trend === 'up' ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        <div className="p-3 rounded-lg bg-secondary/50">
          {icon}
        </div>
      </div>
    </Card>
  );
};
