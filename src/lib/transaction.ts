import api from "./axios";

export interface TransactionListResponse {
  transactions: any[];
  total: number;
  page: number;
  totalPages: number;
  summary: { totalIncome: number; totalExpense: number; incomeCount: number; expenseCount: number };
}

export const getTransactions = (params?: {
  type?: string;
  contractNumber?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<TransactionListResponse> =>
  api.get("/transactions", { params }).then(r => r.data);

export const getContractSummary = (contractNumber: string) =>
  api.get(`/transactions/contract/${contractNumber}`).then(r => r.data);

export const createTransaction = (data: any) =>
  api.post("/transactions", data).then(r => r.data);

export const updateTransaction = (id: string, data: any) =>
  api.put(`/transactions/${id}`, data).then(r => r.data);

export const deleteTransaction = (id: string) =>
  api.delete(`/transactions/${id}`).then(r => r.data);

export const importTransactions = async (file: File) => {
  const buffer = await file.arrayBuffer();
  return api.post("/transactions/import", buffer, {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  }).then(r => r.data);
};

export const exportTransactions = async (params?: {
  contractNumber?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  const token = localStorage.getItem("token");
  const clean = Object.fromEntries(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== "")
  );
  const query = new URLSearchParams(clean).toString();
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
  const res = await fetch(`${baseUrl}/transactions/export?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Export алдаа");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = params?.contractNumber
    ? `transactions-${params.contractNumber}.xlsx`
    : "transactions.xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const updatePNLStatus = (id: string, status: "active" | "pending" | "closed") =>
  api.put(`/pnl/${id}`, { status }).then(r => r.data);