import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { isLoggedIn } from "@/lib/auth";
import LoginPage from "@/pages/LoginPage";
import SsoLanding from "@/pages/SsoLanding";
import DashboardPage from "@/pages/DashboardPage";
import NewPage from "@/pages/NewPage";
import EditPage from "@/pages/EditPage";
import EmployeePage from "@/pages/EmployeePage";
import AssetPage from "@/pages/AssetPage";
import ExpensePage from "@/pages/ExpensePage";
import ReceivablePage from "@/pages/ReceivablePage";
import TransactionPage from "@/pages/TransactionPage";
import AdminUsersPage from "@/pages/AdminUsersPage";
import WorkforcePage from "@/pages/WorkforcePage";
import PartnerPage from "@/pages/PartnerPage";
import ProductPage from "@/pages/ProductPage";
import ChatSection from "@/components/ai/Chatsection";

// AI ассистентийг route wrapper-т нэг удаа рендерлэснээр нэвтэрсэн бүх
// хуудсанд гарна (login хуудсанд гарахгүй). Хуудас бүрт нэмэх шаардлагагүй.
function PrivateRoute({ children }: { children: React.ReactNode }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return (
    <>
      {children}
      <ChatSection />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/sso" element={<SsoLanding />} />
        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/dashboard/new" element={<PrivateRoute><NewPage /></PrivateRoute>} />
        <Route path="/dashboard/:id" element={<PrivateRoute><EditPage /></PrivateRoute>} />
        <Route path="/employees" element={<PrivateRoute><EmployeePage /></PrivateRoute>} />
        <Route path="/assets" element={<PrivateRoute><AssetPage /></PrivateRoute>} />
        <Route path="/expenses" element={<PrivateRoute><ExpensePage /></PrivateRoute>} />
        <Route path="/receivables" element={<PrivateRoute><ReceivablePage /></PrivateRoute>} />
        <Route path="/workforce" element={<PrivateRoute><WorkforcePage /></PrivateRoute>} />
        <Route path="/partners" element={<PrivateRoute><PartnerPage /></PrivateRoute>} />
        <Route path="/products" element={<PrivateRoute><ProductPage /></PrivateRoute>} />
        <Route path="/transactions" element={<PrivateRoute><TransactionPage /></PrivateRoute>} />
        <Route path="/admin/users" element={<PrivateRoute><AdminUsersPage /></PrivateRoute>} />
        <Route path="*" element={<Navigate to={isLoggedIn() ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
