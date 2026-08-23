import {
  BarChart2, TableIcon, Package, Box, Receipt, ArrowLeftRight,
  Users, HardHat, Handshake, ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n/dictionary-type";

export interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
}

// Цэс бүх 10 хуудсанд өмнө нь тус тусдаа давхардуулан бичигдсэн байсныг
// нэг эх сурвалж болгов — дараалал өөрчлөх/зассанаар нэг л газар засна.
// Дараалал нь өдөр тутмын ажлын урсгалаар бүлэглэсэн: Гүйлгээ → Бараа/
// Хөрөнгө (аль аль нь Гүйлгээний дэвтэртэй холбогддог) → Зардал/Авлага →
// Ажилтан/Ажиллах хүч (хамт холбоотой) → Түнш → Админ.
export function getNavItems(t: Dictionary, isAdmin: boolean): NavItem[] {
  return [
    { path: "/dashboard", label: t.common.navDashboard, icon: <BarChart2 className="w-4 h-4" /> },
    { path: "/transactions", label: t.common.navTransactions, icon: <TableIcon className="w-4 h-4" /> },
    { path: "/products", label: t.common.navProducts, icon: <Package className="w-4 h-4" /> },
    { path: "/assets", label: t.common.navAssets, icon: <Box className="w-4 h-4" /> },
    { path: "/expenses", label: t.common.navExpenses, icon: <Receipt className="w-4 h-4" /> },
    { path: "/receivables", label: t.common.navReceivables, icon: <ArrowLeftRight className="w-4 h-4" /> },
    { path: "/employees", label: t.common.navEmployees, icon: <Users className="w-4 h-4" /> },
    { path: "/workforce", label: t.common.navWorkforce, icon: <HardHat className="w-4 h-4" /> },
    { path: "/partners", label: t.common.navPartners, icon: <Handshake className="w-4 h-4" /> },
    ...(isAdmin ? [{ path: "/admin/users", label: t.common.navAdmin, icon: <ShieldCheck className="w-4 h-4" /> }] : []),
  ];
}
