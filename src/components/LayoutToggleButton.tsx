import { Button } from "@/components/ui/button";
import { PanelLeft } from "lucide-react";
import { toggleLayoutMode } from "@/lib/layoutMode";
import { useLocale } from "@/hooks/useLocale";

// Sidebar/topnav сэлгэх товч — өмнө нь зөвхөн DashboardPage дээр байсныг
// бүх хуудсанд адилхан ашиглаж болохоор энд гаргаж авав.
export function LayoutToggleButton() {
  const { t } = useLocale();
  return (
    <Button variant="outline" size="icon" onClick={toggleLayoutMode} title={t.common.layoutToggleTooltip}>
      <PanelLeft className="w-4 h-4" />
    </Button>
  );
}
