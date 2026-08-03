import api from "./axios";

export const getReceivables = (params?: { type?: string }) =>
  api.get("/receivables", { params }).then(r => r.data);
export const createReceivable = (data: any) => api.post("/receivables", data).then(r => r.data);
export const updateReceivable = (id: string, data: any) => api.put(`/receivables/${id}`, data).then(r => r.data);
export const deleteReceivable = (id: string) => api.delete(`/receivables/${id}`).then(r => r.data);
