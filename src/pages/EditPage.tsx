import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPNL } from "@/lib/pnl";
import { PNLRecord } from "@/types";
import PNLForm from "@/components/PNLForm";
import { useLocale } from "@/hooks/useLocale";

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLocale();
  const [record, setRecord] = useState<PNLRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getPNL(id)
        .then(setRecord)
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        {t.common.loading}
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-xl font-medium mb-6">{t.pnlForm.editTitle}</h1>
        {record && <PNLForm initial={record} id={id} />}
      </div>
    </div>
  );
}
