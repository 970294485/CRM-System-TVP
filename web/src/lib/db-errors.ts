/** Neon / Drizzle 有時只回「Failed query: …」，與 relation does not exist 一併辨識 */
export function companyDocumentsSchemaHint(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err);
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";

  const mentionsTable =
    /company_document_permissions/i.test(msg) || /company_documents/i.test(msg);
  const looksMissing =
    code === "42P01" ||
    /does not exist/i.test(msg) ||
    /undefined_table/i.test(msg) ||
    (/Failed query/i.test(msg) && mentionsTable);

  if (!mentionsTable || !looksMissing) return null;

  return "企業文檔資料表尚未建立。請在專案 web 目錄執行：npm run db:apply:company-documents-init（若使用 drizzle-kit push，請選擇「create table」完成同步）。";
}
