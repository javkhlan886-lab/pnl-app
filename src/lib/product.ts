import api from "./axios";

export interface Product {
  _id: string;
  id: string;
  name: string;
  category: string;
  description?: string | null;
  unit?: string | null;
  quantity: number;
  price: number;
  discountPercent: number;
  discountStartDate?: string | null;
  discountEndDate?: string | null;
  issuedQty: number;
  remainingQty: number;
  currency: string;
  status: string;
  note?: string | null;
}

export const getProducts = (params?: { category?: string; status?: string; search?: string }): Promise<Product[]> =>
  api.get("/products", { params }).then(r => r.data);
export const createProduct = (data: any) => api.post("/products", data).then(r => r.data);
export const updateProduct = (id: string, data: any) => api.put(`/products/${id}`, data).then(r => r.data);
export const deleteProduct = (id: string) => api.delete(`/products/${id}`).then(r => r.data);
