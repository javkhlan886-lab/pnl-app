import api from "./axios";

export const getAssets = (params?: { category?: string; status?: string }) =>
  api.get("/assets", { params }).then(r => r.data);
export const getAssetImage = (id: string) =>
  api.get(`/assets/${id}/image`).then(r => r.data.image as string | null);
export const createAsset = (data: any) => api.post("/assets", data).then(r => r.data);
export const updateAsset = (id: string, data: any) => api.put(`/assets/${id}`, data).then(r => r.data);
export const disposeAsset = (id: string) => api.delete(`/assets/${id}`).then(r => r.data);
