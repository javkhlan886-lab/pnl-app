import api from "./axios";
import { User, UserRole, AuditLogEntry } from "@/types";

export const getUsers = (status?: "pending" | "approved" | "rejected") =>
  api.get<User[]>("/admin/users", { params: status ? { status } : {} }).then(r => r.data);

export const approveUser = (id: string, role: UserRole, viewableUserIds?: string[]) =>
  api.put(`/admin/users/${id}/approve`, { role, viewableUserIds }).then(r => r.data);

export const rejectUser = (id: string) =>
  api.put(`/admin/users/${id}/reject`).then(r => r.data);

export const changeUserRole = (id: string, role: UserRole, viewableUserIds?: string[]) =>
  api.put(`/admin/users/${id}/role`, { role, viewableUserIds }).then(r => r.data);

export const deleteUser = (id: string) =>
  api.delete(`/admin/users/${id}`).then(r => r.data);

export const updateUserProfile = (id: string, data: { name?: string; password?: string }) =>
  api.put(`/admin/users/${id}/profile`, data).then(r => r.data);

export const getAuditLogs = (params?: {
  entityType?: string;
  action?: string;
  targetUserId?: string;
  actorId?: string;
  page?: number;
  limit?: number;
}) =>
  api
    .get<{ logs: AuditLogEntry[]; total: number; page: number; totalPages: number }>(
      "/admin/logs",
      { params }
    )
    .then(r => r.data);