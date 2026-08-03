import api from "./axios";

export const getEmployees = () => api.get("/employees").then(r => r.data);
export const createEmployee = (data: any) => api.post("/employees", data).then(r => r.data);
export const updateEmployee = (id: string, data: any) => api.put(`/employees/${id}`, data).then(r => r.data);
export const deleteEmployee = (id: string) => api.delete(`/employees/${id}`).then(r => r.data);
