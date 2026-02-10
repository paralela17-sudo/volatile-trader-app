import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
interface StatsCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: "up" | "down";
  trendValue?: string;
}
export const StatsCard = ({
  title,
  value,
  icon,
  trend,
  trendValue
}: StatsCardProps) => {
  return (
    <Card className="p-6 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          {icon}
        </div>
        <p className="text-3xl font-bold text-primary">{value}</p>
        {trend && trendValue && (
          <div className={`flex items-center gap-1 text-sm ${trend === "up" ? "text-success" : "text-danger"}`}>
            {trend === "up" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
    </Card>
  );
};