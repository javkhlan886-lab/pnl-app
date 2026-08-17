export interface Row {
  name: string;
  note: string;
  unitPrice?: number;
  quantity?: number;
  amount: number;
  hasVat?: boolean;
}

// Тайланг оруулсан хэрэглэгч — backend зөвхөн Level 1, 2 (admin, manager)-д илгээнэ.
export interface RecordOwner {
  id: string;
  email: string;
  name?: string;
}

export interface PNLRecord {
  _id?: string;
  userId?: string;
  owner?: RecordOwner | null;
  company: string;
  period: string;
  currency: string;
  // Гараар оруулсан ханш (1 нэгж = ? ₮) — байхгүй бол системийн тогтмол
  // ойролцоо ханш ашиглана. Зөвхөн currency "₮" биш үед хамааралтай.
  exchangeRate?: number | null;
  incomeRows: Row[];
  expenseRows: Row[];
  // ── Шинэ талбарууд ──────────────────────
  contractNumber?: string;
  contractCategory?: string;
  contractStatus?: "active" | "pending" | "closed";
  status?: "active" | "pending" | "closed";
  date?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Transaction {
  _id?: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  contractNumber?: string | null;
  currency: string;
  status: "approved" | "pending" | "rejected";
  note?: string | null;
  importedFrom?: string | null;
  createdAt?: string;
  productId?: string | null;
  quantity?: number | null;
}

export interface ContractSummary {
  contractNumber: string;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  margin: number;
  incomeCount: number;
  expenseCount: number;
  transactions: Transaction[];
}

// Saas Back's roles/statuses (this app no longer has its own manager/viewer
// tier or pending-approval workflow — Saas Front owns onboarding now).
export type UserRole = "super_admin" | "company_admin" | "company_user";
export type UserStatus = "pending" | "active" | "suspended";

export interface User {
  id: string;
  email: string;
  name?: string;
  companyId?: string | null;
  role?: UserRole;
  status?: UserStatus;
  // PnL data-visibility tier, company_user accounts only (company_admin
  // always has full access). 1/2=full company data, 3=own+assigned,
  // 4=own data only (default). See Saas Back's src/lib/scope.ts.
  pnlLevel?: number;
  pnlViewableUserIds?: string[];
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  pending?: boolean;
  message?: string;
}

export interface AuditLogEntry {
  _id: string;
  actorId: string;
  actorEmail: string;
  action: "create" | "update" | "delete" | "approve_user" | "reject_user" | "change_role";
  entityType: string;
  entityId: string;
  targetUserId?: string;
  description: string;
  before?: any;
  after?: any;
  createdAt: string;
}