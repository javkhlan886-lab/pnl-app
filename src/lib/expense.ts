import api from "./axios";

export const getExpenses = (params?: { type?: string; status?: string }) =>
  api.get("/expenses", { params }).then(r => r.data);
export const createExpense = (data: any) => api.post("/expenses", data).then(r => r.data);
export const updateExpense = (id: string, data: any) => api.put(`/expenses/${id}`, data).then(r => r.data);
export const deleteExpense = (id: string) => api.delete(`/expenses/${id}`).then(r => r.data);
