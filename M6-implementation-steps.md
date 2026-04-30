# 模組 6：依《Customer Management Function.md》分段落地步驟

> 下列對應文件章節；實作時請在 Cursor **Agent 模式**（非 Plan）下修改程式。

---

## 階段 A — 字典主資料（文件 4.1：分組／跟進／來源之「選項維護」）

**對應需求**：來源管道、客戶分組、跟進階段名稱（供下拉與報表維度）。

**建議表**（`schema.ts`）：

- `customer_lead_sources`：name, sort_order, is_active, timestamps  
- `customer_groups`：同上  
- `customer_follow_up_statuses`：同上（作為管道階段選項，例如「初次接洽」「報價中」）

**Server action**：單一 `saveCustomerDictionary`（dictType + create/update/delete）或三個 action；`requireSettings()`；`revalidatePath("/settings/customer-dictionaries")`。

**UI**：`/settings/customer-dictionaries`，分頁或三區塊：表格 + 彈窗 CRUD（對齊編號／主檔既有元件風格）。

**導覽**：在 [settings/layout](web/src/app/settings/layout.tsx) 與 [settings 總覽](web/src/app/settings/page.tsx) 加入「客戶主資料字典」連結。

**種子**（可選）：[scripts/seed.ts](web/scripts/seed.ts) 寫入少量預設來源／群組／階段。

**指令**：`cd web && npm run db:push`

---

## 階段 B — 客戶主檔（文件第 3 節「客戶分析管理」之靜態屬性 + 生命週期／標籤／價值）

**建議表** `customers`：

- 識別：name（公司／客戶名）、contact_name、phone、email、address  
- 關聯：`organization_id`（可選，對齊現有 organizations）、`lead_source_id`、`customer_group_id`、`follow_up_status_id`、`assigned_to_user_id` → users  
- 文件欄位：`lifecycle` enum（潛在 / 洽談中 / 成交活躍 / 睡眠 / 流失 → 建議英文 enum：potential, negotiating, active, dormant, churned）  
- `tags`：jsonb `string[]`（畫像標籤）  
- `value_tier`：enum high | medium | low（先可手動，日後再接交易自動算）  
- `notes`，`created_at` / `updated_at`

**權限**：變更使用 `canEditSales`（[authz](web/src/lib/authz.ts) 已有）；唯讀帳號僅列表／詳情。

**UI**：

- `/customers`：列表 + 搜尋（可先名稱）+ 新增／編輯彈窗  
- `/customers/[id]`：詳情頁（生命週期、標籤、負責人、備註；預留「商務歷史」區塊給階段 D）

**Middleware**：matcher 加入 `/customers`，與 `/settings` 同樣需登入。

**Actions**：新建 [actions/customers.ts](web/src/actions/customers.ts)（或擴充 [admin.ts](web/src/actions/admin.ts)）`saveCustomer`（create/update/delete）。

---

## 階段 C — 跟進情況「明細紀錄」（文件 4.1：每次電話／拜訪 + 下次跟進時間）

**建議表** `customer_follow_up_activities`：

- `customer_id`、`created_by_user_id`、`occurred_at`、`channel`（phone/visit/meeting/email/other）、`summary`、`next_follow_up_at`、`created_at`

**UI**：掛在 `/customers/[id]` 下半部：時間軸列表 + 新增一筆表單。

**後續**：與文件寫的 **模組 9 待辦通知** 可用 `next_follow_up_at` 觸發（需另行排程／工作佇列）。

**revalidate**：`/customers` 與該 id 詳情頁。

---

## 階段 D — 銷售開單管理（文件第 2 節 + 跨模組 3）

- 客戶詳情「建立報價單／合同／發票」→ 連到模組 3 路由並帶 `customerId` query（**需模組 3 已有表單路由**）。  
- 「商務歷史總覽」→ 依模組 3 的報價／合同資料做 list API 或 join 查詢。

**前置**：模組 3 至少具備 quote/order 實體與 `customer_id` FK。

---

## 階段 E — 客戶分析圖表（文件第 1 節）

- 全局：漏斗、利潤榜、帳款風險 → 依賴 **模組 3 階段資料 + 模組 1 應收**（尚無表則先做佔位頁）。  
- 個體：採購趨勢、產品偏好 → 依賴 **訂單／報價明細** 聚合。

**前置**：階段 B、D 與財務／銷售資料就緒後再開發圖表 API 與頁面。

---

## 階段 F — Email 推廣（文件 4.2 + 模組 4 模板）

- 寄送 API（Resend/SMTP）、模板從模組 4 讀取；**發送日誌**寫入表並可選關聯 `customer_follow_up_activities` 或獨立 `email_campaign_logs`。

**前置**：客戶主檔、分組／標籤篩選、郵件環境變數。

---

## 建議實作順序（一個個完成）

1. **A** 字典  
2. **B** 客戶主檔  
3. **C** 跟進明細  
4. **D** 與模組 3 串接（有模組 3 再做）  
5. **E** 圖表  
6. **F** Email  

---

## 與現有程式關係（摘要）

| 現有模組 | 用途 |
|---------|------|
| [organizations](web/src/db/schema.ts) | 客戶可選關聯企業抬頭 |
| [users / RBAC](web/src/db/schema.ts) | 負責人、權限 |
| [catalog_items](web/src/db/schema.ts) | 日後開單明細 |
| [number_sequences](web/src/db/schema.ts) | 日後報價單號 |
| [settings 模式](web/src/app/settings/) | 字典頁 UI 參考 |

完成階段 A～C 後，即可在計畫文件將 **m6-dicts** 標為 done、**m6-customers** 進行中，並新增 todo「m6-follow-ups」「m6-module3-link」等追蹤後續階段。
