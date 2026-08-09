import api from "./axios";

export const getWorkforce = () => api.get("/workforce").then(r => r.data);
export const createWorkforce = (data: any) => api.post("/workforce", data).then(r => r.data);
export const updateWorkforce = (id: string, data: any) => api.put(`/workforce/${id}`, data).then(r => r.data);
export const deleteWorkforce = (id: string) => api.delete(`/workforce/${id}`).then(r => r.data);
