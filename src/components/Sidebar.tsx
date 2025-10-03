import { Home, TrendingUp, BarChart3, Users, Bell, Settings, UserCog } from "lucide-react";
import { NavLink } from "react-router-dom";
import evolonLogo from "@/assets/evolon-logo.jpg";

const navigation = [
  { name: "Dashboard", icon: Home, href: "/" },
  { name: "Overview", icon: TrendingUp, href: "/overview" },
  { name: "Analytics", icon: BarChart3, href: "/analytics" },
  { name: "Statistics", icon: BarChart3, href: "/statistics" },
  { name: "Users", icon: Users, href: "/users" },
  { name: "Notifications", icon: Bell, href: "/notifications" },
  { name: "Settings", icon: Settings, href: "/settings" },
  { name: "Admin", icon: UserCog, href: "/admin" },
];

export const Sidebar = () => {
  return (
    <aside className="w-64 min-h-screen bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-primary/10">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-xl">
            E
          </div>
        </div>
        <span className="text-2xl font-bold text-primary">Evolón Bot</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {navigation.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.href}
                end
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-primary/10 text-primary shadow-glow-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};
