import api from "./axios";

export const getProducts = (params?: { category?: string; status?: string; search?: string }) =>
  api.get("/products", { params }).then(r => r.data);
export const createProduct = (data: any) => api.post("/products", data).then(r => r.data);
export const updateProduct = (id: string, data: any) => api.put(`/products/${id}`, data).then(r => r.data);
export const deleteProduct = (id: string) => api.delete(`/products/${id}`).then(r => r.data);
