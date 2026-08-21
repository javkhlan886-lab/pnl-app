import api from "./axios";

export const getWorkforceTasks = (params?: { dateFrom?: string; dateTo?: string }) =>
  api.get("/workforce-tasks", { params }).then(r => r.data);
export const createWorkforceTask = (data: any) => api.post("/workforce-tasks", data).then(r => r.data);
export const updateWorkforceTask = (id: string, data: any) => api.put(`/workforce-tasks/${id}`, data).then(r => r.data);
export const deleteWorkforceTask = (id: string) => api.delete(`/workforce-tasks/${id}`).then(r => r.data);
