import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* ─── RBAC (Module 9) ─── */

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })]
);

export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));

/* ─── Organization (Module 8) ─── */

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  taxId: text("tax_id"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  bankName: text("bank_name"),
  bankAccount: text("bank_account"),
  notes: text("notes"),
  /** Enterprise profile steward (e.g. dev admin bound to corporate master data). */
  linkedUserId: uuid("linked_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ─── Numbering rules (Module 8) ─── */

export const resetPolicyEnum = pgEnum("number_reset_policy", ["never", "yearly"]);

/** Middle segment between prefix and serial: omit | calendar year | yyyyMM. */
export const documentDateSegmentEnum = pgEnum("document_date_segment", ["omit", "year", "year_month"]);

export const numberSequences = pgTable("number_sequences", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityType: text("entity_type").notNull().unique(),
  prefix: text("prefix").notNull().default(""),
  suffix: text("suffix").notNull().default(""),
  padLength: integer("pad_length").notNull().default(6),
  nextNumber: integer("next_number").notNull().default(1),
  resetPolicy: resetPolicyEnum("reset_policy").notNull().default("never"),
  currentYear: integer("current_year"),
  dateSegment: documentDateSegmentEnum("date_segment").notNull().default("omit"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** PT-data: shared dropdown buckets (slug), e.g. payment_terms / shipping_methods. */
export const ptMasterLookupEntries = pgTable("pt_master_lookup_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  dictionaryKindSlug: text("dictionary_kind_slug").notNull(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Base currency TW dollar; snapshot rate stored per FX code (M3 simple snapshot, no historical series). */
export const ptCurrencies = pgTable("pt_currencies", {
  id: uuid("id").defaultRandom().primaryKey(),
  isoCode: text("iso_code").notNull().unique(),
  label: text("label"),
  quoteTwdPerUnit: numeric("quote_twd_per_unit", { precision: 18, scale: 6 }),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** PT-Data Entry: 產品與服務（與既有 Neon `products` 表欄位對齊） */
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  category: text("category"),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }),
  description: text("description"),
  attributes: jsonb("attributes")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  specifications: jsonb("specifications")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  imageUrls: text("image_urls").array().notNull().default(sql`ARRAY[]::text[]`),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: false }).defaultNow().notNull(),
});

/* ─── Accounting (Module 8) — 與 PT「會計相關錄入」共用 `accounting_categories` ─── */

export const accountingCategories = pgTable(
  "accounting_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryCode: text("category_code").notNull().unique(),
    categoryName: text("category_name").notNull(),
    accountType: text("account_type").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "accounting_categories_account_type_check",
      sql`${t.accountType} IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')`
    ),
  ]
);

export const accountingItems = pgTable("accounting_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => accountingCategories.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accountingCategoriesRelations = relations(accountingCategories, ({ many }) => ({
  items: many(accountingItems),
}));

export const accountingItemsRelations = relations(accountingItems, ({ one }) => ({
  category: one(accountingCategories, {
    fields: [accountingItems.categoryId],
    references: [accountingCategories.id],
  }),
}));

/** 會計基礎管理：全系統單一設定列（首期僅一行，若無列則啟動時插入預設） */
export const accountingCompanySettings = pgTable("accounting_company_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 當前記帳所屬會計年度（曆年制為西元年） */
  currentFiscalYear: integer("current_fiscal_year").notNull(),
  /** 記帳本位幣 ISO，須對應 `pt_currencies.iso_code`（通常 TWD） */
  baseCurrencyIso: varchar("base_currency_iso", { length: 12 }).notNull().default("TWD"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** 會計期間（yyyy-MM）；未出現在表內視為「未結帳／開放」 */
export const accountingPeriods = pgTable(
  "accounting_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    yearMonth: varchar("year_month", { length: 7 }).notNull(),
    isClosed: boolean("is_closed").notNull().default(false),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "accounting_periods_year_month_ck",
      sql`${t.yearMonth} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`
    ),
    uniqueIndex("accounting_periods_year_month_uidx").on(t.yearMonth),
  ]
);

/** 總賬：手工記賬憑證（複式分錄）；與 `accounting_items` 串科目 */
export const glJournalEntries = pgTable("gl_journal_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentNo: text("document_no").notNull().unique(),
  entryDate: date("entry_date").notNull(),
  memo: text("memo"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const glJournalLines = pgTable(
  "gl_journal_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    journalEntryId: uuid("journal_entry_id")
      .notNull()
      .references(() => glJournalEntries.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    accountingItemId: uuid("accounting_item_id")
      .notNull()
      .references(() => accountingItems.id, { onDelete: "restrict" }),
    debit: numeric("debit", { precision: 18, scale: 2 }).notNull().default("0"),
    credit: numeric("credit", { precision: 18, scale: 2 }).notNull().default("0"),
    lineMemo: text("line_memo"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("gl_journal_lines_entry_line_uidx").on(t.journalEntryId, t.lineNo),
    check("gl_journal_lines_debit_non_negative", sql`${t.debit} >= 0`),
    check("gl_journal_lines_credit_non_negative", sql`${t.credit} >= 0`),
    check(
      "gl_journal_lines_one_side_positive",
      sql`(${t.debit} > 0 AND ${t.credit} = 0) OR (${t.credit} > 0 AND ${t.debit} = 0)`
    ),
  ]
);

export const glJournalEntriesRelations = relations(glJournalEntries, ({ one, many }) => ({
  lines: many(glJournalLines),
  createdBy: one(users, { fields: [glJournalEntries.createdByUserId], references: [users.id] }),
}));

export const glJournalLinesRelations = relations(glJournalLines, ({ one }) => ({
  entry: one(glJournalEntries, {
    fields: [glJournalLines.journalEntryId],
    references: [glJournalEntries.id],
  }),
  accountingItem: one(accountingItems, {
    fields: [glJournalLines.accountingItemId],
    references: [accountingItems.id],
  }),
}));

/* ─── Customer Management (Module 6) ─── */

export const customerLeadSources = pgTable("customer_lead_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const customerGroups = pgTable("customer_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const customerFollowUpStatuses = pgTable("customer_follow_up_statuses", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const customerLifecycleEnum = pgEnum("customer_lifecycle", [
  "potential",
  "negotiating",
  "active",
  "dormant",
  "churned",
]);

export const customerValueTierEnum = pgEnum("customer_value_tier", ["high", "medium", "low"]);

export const followUpChannelEnum = pgEnum("follow_up_channel", [
  "phone",
  "visit",
  "meeting",
  "email",
  "other",
]);

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
  /** 客戶編碼（分析／匯出用，可選） */
  customerCode: varchar("customer_code", { length: 64 }),
  name: text("name").notNull(),
  /** 產業別（客戶分析圖表） */
  industry: varchar("industry", { length: 128 }),
  /** 地區 */
  region: varchar("region", { length: 128 }),
  /** Active / Inactive 等（規格中的 status，欄位名 customer_status） */
  customerStatus: varchar("customer_status", { length: 32 }),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  leadSourceId: uuid("lead_source_id").references(() => customerLeadSources.id, { onDelete: "set null" }),
  customerGroupId: uuid("customer_group_id").references(() => customerGroups.id, { onDelete: "set null" }),
  followUpStatusId: uuid("follow_up_status_id").references(() => customerFollowUpStatuses.id, {
    onDelete: "set null",
  }),
  lifecycle: customerLifecycleEnum("lifecycle").notNull().default("potential"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  valueTier: customerValueTierEnum("value_tier"),
  assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const customerFollowUpActivities = pgTable("customer_follow_up_activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  channel: followUpChannelEnum("channel").notNull().default("other"),
  summary: text("summary").notNull(),
  nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Email 推廣活動主檔 */
export const emailCampaigns = pgTable("email_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  subject: varchar("subject", { length: 500 }).notNull(),
  baseBodyHtml: text("base_body_html").notNull(),
  targetGroup: varchar("target_group", { length: 128 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("Draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Email 發送佇列（依客戶客製內容） */
export const emailQueueLogs = pgTable("email_queue_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => emailCampaigns.id, { onDelete: "cascade" }),
  /** 手動輸入信箱時為 null */
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  emailAddress: text("email_address").notNull(),
  customizedSubject: varchar("customized_subject", { length: 500 }).notNull(),
  customizedBodyHtml: text("customized_body_html").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("Pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** 員工薪資與考勤設置（人事數據管理） */
export const employeeSettings = pgTable("employee_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeName: text("employee_name").notNull(),
  department: text("department"),
  baseSalary: numeric("base_salary", { precision: 10, scale: 2 }),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }),
  workStartTime: time("work_start_time"),
  workEndTime: time("work_end_time"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** 批量匯入暫存（報價／採購／庫存等，業務表後續對接） */
export const dataImportStaging = pgTable("data_import_staging", {
  id: uuid("id").defaultRandom().primaryKey(),
  importType: text("import_type").notNull(),
  batchId: uuid("batch_id").notNull(),
  rowIndex: integer("row_index").notNull(),
  record: jsonb("record").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** 報價單明細（寫入 items JSONB）；`price` 為舊匯入欄位，等同 unit_price */
export type QuotationLineItem = {
  product_id?: string | null;
  name: string;
  sku?: string | null;
  qty: number;
  /** 舊版／匯入：單價 */
  price?: number;
  unit_price?: number;
  /** 單項折扣百分比 0–100 */
  discount?: number;
  line_total?: number;
  specs?: unknown;
};

export const quotations = pgTable("quotations", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteNo: text("quote_no").notNull().unique(),
  /** 若已在客戶主檔建檔可填；新客戶可留空，改以 customerName 等快照欄位保存 */
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "restrict" }),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  customerEmail: text("customer_email"),
  quoteDate: date("quote_date").notNull(),
  validUntil: date("valid_until"),
  items: jsonb("items")
    .$type<QuotationLineItem[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("Legacy_Imported"),
  notes: text("notes"),
});

/** 銷售合同（可由報價單轉換；quotation_id 至多對應一筆） */
export const salesContracts = pgTable("sales_contracts", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractNo: text("contract_no").notNull().unique(),
  sourceQuoteNo: text("source_quote_no"),
  quotationId: uuid("quotation_id").references(() => quotations.id, { onDelete: "set null" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "restrict" }),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  customerEmail: text("customer_email"),
  contractDate: date("contract_date").notNull(),
  validUntil: date("valid_until"),
  items: jsonb("items")
    .$type<QuotationLineItem[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("Active"),
  notes: text("notes"),
  /** 預收款目標金額（含稅）；用於開立預收發票 */
  prepaymentAmount: numeric("prepayment_amount", { precision: 12, scale: 2 }),
  prepaymentNotes: text("prepayment_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** 預收發票（由銷售合同一鍵開立，一合同至多一張） */
export const proformaInvoices = pgTable("proforma_invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceNo: text("invoice_no").notNull().unique(),
  contractId: uuid("contract_id")
    .notNull()
    .references(() => salesContracts.id, { onDelete: "cascade" })
    .unique(),
  sourceContractNo: text("source_contract_no").notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  customerEmail: text("customer_email"),
  issueDate: date("issue_date").notNull(),
  items: jsonb("items")
    .$type<QuotationLineItem[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("Issued"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** 採購單明細（items 內含 specifications 快照） */
export type PurchaseOrderLineItem = {
  product_id?: string | null;
  name: string;
  sku?: string | null;
  qty: number;
  price: number;
  specifications?: unknown;
  /** 入庫倉位（可選；與 inventory.warehouse_location 對齊） */
  warehouse_location?: string | null;
};

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    poNo: text("po_no").notNull().unique(),
    originalSystemId: text("original_system_id"),
    /**
     * 採購供應商：可選連結 `customers` 主檔（僅資料表共用，產品上不視為銷售客戶流程）；
     * 實務多以 customer_name 等快照欄位表示供應商即可。
     */
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    /** 供應商／對象名稱快照 */
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    customerEmail: text("customer_email"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    items: jsonb("items")
      .$type<PurchaseOrderLineItem[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    poDate: date("po_date").notNull(),
    status: text("status").notNull().default("Legacy_Imported"),
    paymentStatus: text("payment_status").notNull().default("Unpaid"),
    paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "purchase_orders_payment_status_check",
      sql`${t.paymentStatus} IN ('Unpaid', 'Partial', 'Paid')`
    ),
  ]
);

/** 採購入庫明細（採購單 ↔ 產品／庫存加減依據） */
export const purchaseOrderReceipts = pgTable("purchase_order_receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  sku: text("sku").notNull(),
  warehouseLocation: text("warehouse_location"),
  qtyReceived: integer("qty_received").notNull(),
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
  lineNameSnapshot: text("line_name_snapshot"),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
});

/** 模組1：應付請款單（掛鉤採購單）；確認付款後更新採購單 paid_amount／payment_status */
export const financeApPaymentRequests = pgTable(
  "finance_ap_payment_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentNo: text("document_no").notNull().unique(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    requestDate: date("request_date").notNull(),
    status: text("status").notNull().default("Draft"),
    notes: text("notes"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "finance_ap_payment_requests_status_check",
      sql`${t.status} IN ('Draft', 'Confirmed')`
    ),
  ]
);

/** 模組1：預收款單（掛鉤銷售合同）；確認收款後供後續合同匹配使用 */
export const financeArAdvanceReceipts = pgTable(
  "finance_ar_advance_receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentNo: text("document_no").notNull().unique(),
    salesContractId: uuid("sales_contract_id")
      .notNull()
      .references(() => salesContracts.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    receiptDate: date("receipt_date").notNull(),
    status: text("status").notNull().default("Draft"),
    notes: text("notes"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "finance_ar_advance_receipts_status_check",
      sql`${t.status} IN ('Draft', 'Received')`
    ),
  ]
);

export const financeApPaymentRequestsRelations = relations(financeApPaymentRequests, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [financeApPaymentRequests.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  createdBy: one(users, { fields: [financeApPaymentRequests.createdByUserId], references: [users.id] }),
}));

export const financeArAdvanceReceiptsRelations = relations(financeArAdvanceReceipts, ({ one }) => ({
  salesContract: one(salesContracts, {
    fields: [financeArAdvanceReceipts.salesContractId],
    references: [salesContracts.id],
  }),
  createdBy: one(users, { fields: [financeArAdvanceReceipts.createdByUserId], references: [users.id] }),
}));

/** 模組1：月度支出預算上限（採購承諾額按 po_date 所屬月） */
export const financeMonthlyExpenditureBudgets = pgTable(
  "finance_monthly_expenditure_budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    yearMonth: varchar("year_month", { length: 7 }).notNull(),
    capAmount: numeric("cap_amount", { precision: 15, scale: 2 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "finance_monthly_expenditure_budgets_year_month_ck",
      sql`${t.yearMonth} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`
    ),
    check("finance_monthly_expenditure_budgets_cap_ck", sql`${t.capAmount} >= 0`),
    uniqueIndex("finance_monthly_expenditure_budgets_year_month_uidx").on(t.yearMonth),
  ]
);

/** 審批鏈單層：顯示標籤 + 可核准之角色 slug（模組 9） */
export type FinanceApprovalPolicyStep = {
  label: string;
  roleSlugs: string[];
};

/** 模組1：多層審批策略（依單據類型與金額門檻選用） */
export const financeApprovalPolicies = pgTable(
  "finance_approval_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    documentType: varchar("document_type", { length: 64 }).notNull(),
    amountMin: numeric("amount_min", { precision: 15, scale: 2 }).notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    steps: jsonb("steps")
      .$type<FinanceApprovalPolicyStep[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [check("finance_approval_policies_amount_min_ck", sql`${t.amountMin} >= 0`)]
);

/** 模組1：單據審批紀錄（每階至多一筆） */
export const financeApprovalEvents = pgTable(
  "finance_approval_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentType: varchar("document_type", { length: 64 }).notNull(),
    documentId: uuid("document_id").notNull(),
    stepIndex: integer("step_index").notNull(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("finance_approval_events_doc_step_uidx").on(t.documentType, t.documentId, t.stepIndex),
  ]
);

export const inventory = pgTable("inventory", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  sku: text("sku").notNull(),
  warehouseLocation: text("warehouse_location"),
  stockQty: integer("stock_qty").notNull().default(0),
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
  lastCountedDate: date("last_counted_date"),
});

/* ─── File Management (Module 5) — 文件分類與系統文件 ─── */

export const documentCategories = pgTable("document_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 256 }).notNull().unique(),
  description: varchar("description", { length: 512 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const systemDocuments = pgTable("system_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  fileName: varchar("file_name", { length: 512 }).notNull(),
  fileUrl: text("file_url").notNull(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => documentCategories.id, { onDelete: "restrict" }),
  /** 業務模塊代碼，如 CUSTOMER / QUOTATION / PURCHASE_ORDER；NULL 表示通用文件 */
  entityType: varchar("entity_type", { length: 64 }),
  entityId: uuid("entity_id"),
  fileSize: integer("file_size").notNull().default(0),
  mimeType: varchar("mime_type", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const documentCategoriesRelations = relations(documentCategories, ({ many }) => ({
  documents: many(systemDocuments),
}));

/** 個人網盤檔案內部分享（指定使用者 + 檢視／可下載） */
export const systemDocumentPersonalShares = pgTable(
  "system_document_personal_shares",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => systemDocuments.id, { onDelete: "cascade" }),
    sharedByUserId: uuid("shared_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sharedWithUserId: uuid("shared_with_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permission: varchar("permission", { length: 16 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("system_document_personal_shares_document_user_uidx").on(
      t.documentId,
      t.sharedWithUserId
    ),
    check(
      "system_document_personal_shares_permission_check",
      sql`${t.permission} IN ('view', 'download')`
    ),
  ]
);

export const systemDocumentPersonalSharesRelations = relations(systemDocumentPersonalShares, ({ one }) => ({
  document: one(systemDocuments, {
    fields: [systemDocumentPersonalShares.documentId],
    references: [systemDocuments.id],
  }),
  sharedBy: one(users, {
    fields: [systemDocumentPersonalShares.sharedByUserId],
    references: [users.id],
  }),
  sharedWith: one(users, {
    fields: [systemDocumentPersonalShares.sharedWithUserId],
    references: [users.id],
  }),
}));

export const systemDocumentsRelations = relations(systemDocuments, ({ one, many }) => ({
  category: one(documentCategories, {
    fields: [systemDocuments.categoryId],
    references: [documentCategories.id],
  }),
  personalShares: many(systemDocumentPersonalShares),
}));

/* ─── Company document center (公共文件數據庫) — 與 system_documents 網盤分離 ─── */

export const companyDocuments = pgTable(
  "company_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 512 }).notNull(),
    category: varchar("category", { length: 128 }).notNull(),
    fileUrl: text("file_url").notNull(),
    fileSize: integer("file_size").notNull().default(0),
    accessType: varchar("access_type", { length: 32 }).notNull(),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "company_documents_access_type_check",
      sql`${t.accessType} IN ('PUBLIC', 'RESTRICTED')`
    ),
  ]
);

export const companyDocumentPermissions = pgTable("company_document_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => companyDocuments.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const companyDocumentsRelations = relations(companyDocuments, ({ one, many }) => ({
  uploader: one(users, { fields: [companyDocuments.uploadedBy], references: [users.id] }),
  permissions: many(companyDocumentPermissions),
}));

export const companyDocumentPermissionsRelations = relations(companyDocumentPermissions, ({ one }) => ({
  document: one(companyDocuments, {
    fields: [companyDocumentPermissions.documentId],
    references: [companyDocuments.id],
  }),
  user: one(users, { fields: [companyDocumentPermissions.userId], references: [users.id] }),
}));

/* ─── 服務管理：客服案件與備註 ─── */

export const customerServiceCases = pgTable(
  "customer_service_cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseNo: text("case_no").notNull().unique(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    customerNameSnapshot: text("customer_name_snapshot").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull().default("inquiry"),
    channel: text("channel").notNull().default("other"),
    status: text("status").notNull().default("open"),
    priority: text("priority").notNull().default("medium"),
    summary: text("summary"),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, { onDelete: "set null" }),
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "customer_service_cases_category_check",
      sql`${t.category} IN ('inquiry', 'complaint', 'after_sales', 'billing', 'other')`
    ),
    check(
      "customer_service_cases_channel_check",
      sql`${t.channel} IN ('phone', 'email', 'line', 'in_person', 'online', 'other')`
    ),
    check(
      "customer_service_cases_status_check",
      sql`${t.status} IN ('open', 'in_progress', 'resolved', 'closed')`
    ),
    check(
      "customer_service_cases_priority_check",
      sql`${t.priority} IN ('low', 'medium', 'high')`
    ),
  ]
);

export const customerServiceCaseNotes = pgTable("customer_service_case_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => customerServiceCases.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const customerServiceCasesRelations = relations(customerServiceCases, ({ one, many }) => ({
  customer: one(customers, { fields: [customerServiceCases.customerId], references: [customers.id] }),
  assignedTo: one(users, { fields: [customerServiceCases.assignedToUserId], references: [users.id] }),
  createdBy: one(users, { fields: [customerServiceCases.createdByUserId], references: [users.id] }),
  notes: many(customerServiceCaseNotes),
}));

export const customerServiceCaseNotesRelations = relations(customerServiceCaseNotes, ({ one }) => ({
  case: one(customerServiceCases, {
    fields: [customerServiceCaseNotes.caseId],
    references: [customerServiceCases.id],
  }),
  author: one(users, { fields: [customerServiceCaseNotes.createdByUserId], references: [users.id] }),
}));

/* ─── 服務管理：購買與預約（員工／場地） ─── */

export const serviceResourceVenues = pgTable(
  "service_resource_venues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    venueType: text("venue_type").notNull().default("room"),
    capacity: integer("capacity"),
    locationNote: text("location_note"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "service_resource_venues_venue_type_check",
      sql`${t.venueType} IN ('room', 'bay', 'event_space', 'equipment', 'other')`
    ),
  ]
);

export const serviceResourceBookings = pgTable(
  "service_resource_bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    customerServiceCaseId: uuid("customer_service_case_id").references(() => customerServiceCases.id, {
      onDelete: "set null",
    }),
    staffUserId: uuid("staff_user_id").references(() => users.id, { onDelete: "set null" }),
    venueId: uuid("venue_id").references(() => serviceResourceVenues.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    /** 加購／耗材等文字紀錄，日後可串財務模組 */
    purchaseNote: text("purchase_note"),
    /** 預估成本（最小貨幣單位，選填） */
    estimatedCostMinor: integer("estimated_cost_minor"),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      "service_resource_bookings_time_order_check",
      sql`${t.endsAt} > ${t.startsAt}`
    ),
    check(
      "service_resource_bookings_resource_present_check",
      sql`${t.staffUserId} IS NOT NULL OR ${t.venueId} IS NOT NULL`
    ),
  ]
);

export const serviceResourceVenuesRelations = relations(serviceResourceVenues, ({ many }) => ({
  bookings: many(serviceResourceBookings),
}));

export const serviceResourceBookingsRelations = relations(serviceResourceBookings, ({ one }) => ({
  venue: one(serviceResourceVenues, {
    fields: [serviceResourceBookings.venueId],
    references: [serviceResourceVenues.id],
  }),
  staff: one(users, { fields: [serviceResourceBookings.staffUserId], references: [users.id] }),
  case: one(customerServiceCases, {
    fields: [serviceResourceBookings.customerServiceCaseId],
    references: [customerServiceCases.id],
  }),
  createdBy: one(users, { fields: [serviceResourceBookings.createdByUserId], references: [users.id] }),
}));
