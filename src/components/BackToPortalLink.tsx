import { ExternalLink } from "lucide-react";
import { SAAS_FRONT_URL } from "@/lib/constants";
import { useLocale } from "@/hooks/useLocale";

// Pnl App-аас Saas Front портал руу буцах цорын ганц гарц нь 401 эсвэл бүрэн
// logout байсан — энэ линк хэдийд ч шууд буцах боломж өгнө.
export function BackToPortalLink() {
  const { t } = useLocale();
  return (
    <a href={SAAS_FRONT_URL}
      className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/50">
      <ExternalLink className="w-3.5 h-3.5" /> {t.common.backToPortal}
    </a>
  );
}
