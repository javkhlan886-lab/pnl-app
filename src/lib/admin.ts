import api from "./axios";
import { User } from "@/types";

// Company-scoped user management, backed by Saas Back (not this app's own
// admin/* routes — those were removed when pnl-react was ported, Saas Front
// owns onboarding/roles now). This file only covers what's specific to the
// PnL app: listing a company's users and setting their PnL data-visibility
// level (company_admin only — see Saas Back's src/lib/scope.ts).

export const getCompanyUsers = (companyId: string) =>
  api.get<{ users: User[] }>(`/companies/${companyId}/users`).then((r) => r.data.users);

export const changePnlLevel = (userId: string, level: 1 | 2 | 3 | 4, viewableUserIds?: string[]) =>
  api
    .patch<{ user: User }>(`/users/${userId}/pnl-level`, { level, viewableUserIds })
    .then((r) => r.data.user);

// Keep in sync with PNL_MENU_KEYS in Saas Back's src/modules/users/users.schemas.ts.
export const PNL_MENU_KEYS = [
  "transactions", "products", "workforce", "assets",
  "expenses", "receivables", "partners", "employees",
] as const;
export type PnlMenuKey = (typeof PNL_MENU_KEYS)[number];

export const changeAdminCollabMenus = (userId: string, menus: string[]) =>
  api
    .patch<{ user: User }>(`/users/${userId}/pnl-admin-collab-menus`, { menus })
    .then((r) => r.data.user);
