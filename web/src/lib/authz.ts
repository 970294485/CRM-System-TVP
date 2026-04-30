import type { Session } from "next-auth";

const MANAGE_SLUGS = new Set(["super_admin", "admin"]);
const FINANCE_SLUGS = new Set(["super_admin", "admin", "finance"]);
const SALES_SLUGS = new Set(["super_admin", "admin", "sales"]);

export function roleSlugs(session: Session | null): string[] {
  return session?.user?.roleSlugs ?? [];
}

export function canManageUsers(session: Session | null): boolean {
  return roleSlugs(session).some((s) => MANAGE_SLUGS.has(s));
}

export function canEditSettings(session: Session | null): boolean {
  return roleSlugs(session).some((s) => MANAGE_SLUGS.has(s));
}

export function canEditFinance(session: Session | null): boolean {
  return roleSlugs(session).some((s) => FINANCE_SLUGS.has(s));
}

/** 預算超支攔截繞過：僅超級管理員（規格：須由超級管理員授權） */
export function canBypassExpenditureBudget(session: Session | null): boolean {
  return roleSlugs(session).includes("super_admin");
}

export function canEditSales(session: Session | null): boolean {
  return roleSlugs(session).some((s) => SALES_SLUGS.has(s));
}

export function isViewerOnly(session: Session | null): boolean {
  const slugs = roleSlugs(session);
  return slugs.length > 0 && slugs.every((s) => s === "viewer");
}

/** 文件分類／上傳：業務與管理員可操作 */
export function canManageDocuments(session: Session | null): boolean {
  return canEditSales(session) || canEditSettings(session);
}

/** 企業文檔「分配內部權限」：管理員或該文檔上傳者 */
export function canAssignCompanyDocumentPermissions(
  session: Session | null,
  uploadedByUserId: string | null | undefined
): boolean {
  if (!session?.user?.id) return false;
  if (canManageUsers(session)) return true;
  return uploadedByUserId === session.user.id;
}
