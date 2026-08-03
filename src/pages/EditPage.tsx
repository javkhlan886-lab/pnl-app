import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPNL } from "@/lib/pnl";
import { PNLRecord } from "@/types";
import PNLForm from "@/components/PNLForm";

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
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
        Уншиж байна...
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-xl font-medium mb-6">P&L тайлан засах</h1>
        {record && <PNLForm initial={record} id={id} />}
      </div>
    </div>
  );
}
