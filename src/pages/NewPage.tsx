import PNLForm from "@/components/PNLForm";

export default function NewPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-xl font-medium mb-6">Шинэ P&L тайлан</h1>
        <PNLForm />
      </div>
    </div>
  );
}
