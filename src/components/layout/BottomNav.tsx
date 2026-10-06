import { Link, useLocation } from "react-router-dom";
import { Home, Package, Heart, User, MessageCircle } from "lucide-react";
import { useConversations } from "@/hooks/useChat";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Package, label: "Orders", href: "/orders" },
  { icon: MessageCircle, label: "Messages", href: "/messages" },
  { icon: Heart, label: "Favorites", href: "/wishlist" },
  { icon: User, label: "Profile", href: "/profile" },
];

export function BottomNav() {
  const location = useLocation();
  const { unreadCount } = useConversations();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background safe-area-bottom">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span className="relative">
                <item.icon className={cn("h-5 w-5", isActive && "fill-primary/20")} />
                {item.href === "/messages" && unreadCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 min-w-[16px] rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-4 text-primary-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
