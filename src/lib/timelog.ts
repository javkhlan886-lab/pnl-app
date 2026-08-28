import api from "./axios";

export const getTimeLogs = (params: { month: string; employeeId?: string }) =>
  api.get("/timelogs", { params }).then(r => r.data);
export const upsertTimeLog = (data: any) => api.post("/timelogs", data).then(r => r.data);
export const deleteTimeLog = (id: string) => api.delete(`/timelogs/${id}`).then(r => r.data);
