import { ReactNode } from "react";
import { CompanyLogo } from "@/components/CompanyLogo";

export interface SidebarNavItem {
  path: string;
  label: string;
  icon: ReactNode;
}

interface SidebarProps {
  navItems: SidebarNavItem[];
  activePath: string;
  onNavigate: (path: string) => void;
  companyName?: string | null;
  productName: string;
  userName?: string;
  liveLabel: string;
}

// Dashboard-ийн "Page" товчоор идэвхжүүлдэг хажуугийн навигацийн загвар —
// одоо байгаа дээд талын мөр хэлбэрийн навигацийн орлуулга (зөвхөн
// байршил, өнгө/үг хэвээрээ — src/lib/layoutMode.ts-ээр удирддаг).
export function Sidebar({ navItems, activePath, onNavigate, companyName, productName, userName, liveLabel }: SidebarProps) {
  const initials = (userName || "?").trim().slice(0, 1).toUpperCase();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border/50 bg-card/40 backdrop-blur-sm min-h-screen sticky top-0">
      <div className="px-4 py-5 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <CompanyLogo name={companyName} size={40} className="!min-h-0 !py-1.5 !px-2.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{productName}</p>
            <span className="inline-flex items-center gap-1 text-[10px] text-positive">
              <span className="live-dot" /> {liveLabel}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const active = activePath === item.path;
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                active
                  ? "nav-pill-active font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {userName && (
        <div className="px-4 py-3.5 border-t border-border/50 flex items-center gap-2.5">
          <span className="w-8 h-8 shrink-0 rounded-full bg-positive/15 text-positive flex items-center justify-center text-xs font-semibold">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">{userName}</p>
            <span className="inline-flex items-center gap-1 text-[10px] text-positive">
              <span className="live-dot" /> {liveLabel}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
