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
  return;
};