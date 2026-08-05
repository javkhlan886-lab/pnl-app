import PNLForm from "@/components/PNLForm";
import { useLocale } from "@/hooks/useLocale";

export default function NewPage() {
  const { t } = useLocale();
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-xl font-medium mb-6">{t.pnlForm.newTitle}</h1>
        <PNLForm />
      </div>
    </div>
  );
}
