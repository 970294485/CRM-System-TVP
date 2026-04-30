/**
 * 公共文件數據庫（company_documents）示範資料最多 2 筆；相同標題已存在則略過。
 * web/: npm run db:seed:company-documents-demo
 *
 * 請先：npm run db:apply:company-documents-init，且資料庫中至少有一名用戶（如 npm run db:seed:dev-admin）。
 */
import { config } from "dotenv";
import { eq, inArray } from "drizzle-orm";
import { resolve } from "path";

import { getDb } from "../src/db/index";
import { companyDocuments, users } from "../src/db/schema";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const DEMO_ROWS = [
  {
    title: "示範：企業員工手冊（測試）",
    category: "行政管理",
    fileUrl: "https://mock-storage.example.com/company-docs/demo/employee-handbook-2026.pdf",
    fileSize: 245_760,
    accessType: "PUBLIC" as const,
  },
  {
    title: "示範：資訊安全政策（測試）",
    category: "IT合規",
    fileUrl: "https://mock-storage.example.com/company-docs/demo/security-policy-summary.txt",
    fileSize: 12_800,
    accessType: "RESTRICTED" as const,
  },
];

async function main() {
  const db = getDb();

  const [anyUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "admin@example.com"))
    .limit(1);
  const [fallback] = anyUser
    ? []
    : await db.select({ id: users.id }).from(users).limit(1);
  const uploaderId = anyUser?.id ?? fallback?.id;
  if (!uploaderId) {
    console.error(
      "錯誤：找不到用戶，無法設定 uploaded_by。\n" +
        "請執行：npm run db:seed:dev-admin\n" +
        "成功後再執行：npm run db:seed:company-documents-demo"
    );
    process.exit(1);
  }

  const titles = DEMO_ROWS.map((r) => r.title);
  const existing = await db
    .select({ title: companyDocuments.title })
    .from(companyDocuments)
    .where(inArray(companyDocuments.title, titles));
  const have = new Set(existing.map((r) => r.title));

  let inserted = 0;
  for (const row of DEMO_ROWS) {
    if (have.has(row.title)) {
      console.log("Skipped (exists):", row.title);
      continue;
    }
    await db.insert(companyDocuments).values({
      title: row.title,
      category: row.category,
      fileUrl: row.fileUrl,
      fileSize: row.fileSize,
      accessType: row.accessType,
      uploadedBy: uploaderId,
    });
    inserted++;
    console.log("Inserted:", row.title);
  }

  console.log(`Done. Inserted ${inserted}, skipped ${DEMO_ROWS.length - inserted}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
