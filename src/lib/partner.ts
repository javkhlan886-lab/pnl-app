import api from "./axios";

export const getPartners = () => api.get("/partners").then(r => r.data);
export const createPartner = (data: any) => api.post("/partners", data).then(r => r.data);
export const updatePartner = (id: string, data: any) => api.put(`/partners/${id}`, data).then(r => r.data);
export const deletePartner = (id: string) => api.delete(`/partners/${id}`).then(r => r.data);
