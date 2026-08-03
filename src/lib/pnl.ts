import api from "./axios";
import { PNLRecord } from "@/types";

export const getPNLList = async (): Promise<PNLRecord[]> => {
  const { data } = await api.get<PNLRecord[]>("/pnl");
  return data;
};

export const getPNL = async (id: string): Promise<PNLRecord> => {
  const { data } = await api.get<PNLRecord>(`/pnl/${id}`);
  return data;
};

export const createPNL = async (record: PNLRecord): Promise<PNLRecord> => {
  const { data } = await api.post<PNLRecord>("/pnl", record);
  return data;
};

export const updatePNL = async (id: string, record: Partial<PNLRecord>): Promise<PNLRecord> => {
  const { data } = await api.put<PNLRecord>(`/pnl/${id}`, record);
  return data;
};

export const deletePNL = async (id: string): Promise<void> => {
  await api.delete(`/pnl/${id}`);
};
