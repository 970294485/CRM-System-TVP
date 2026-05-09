# 1. 資料庫結構設計 (Database Schema)
請撰寫 SQL 語法建立 `contracts` 表：

**表：`contracts` (合約主表)**
| 欄位名 | 類型 | 描述 |
| :--- | :--- | :--- |
| `id` | UUID | 主鍵 |
| `contract_no` | VARCHAR | **唯一**，合約編號 (如 CTR-2026-001) |
| `title` | VARCHAR | 合約名稱 (如：2026年度系統維護合約) |
| `customer_id` | UUID | **外鍵**，關聯 `customers.id` |
| `quotation_id` | UUID | **外鍵** (選填)，此合約對應的報價單 ID |
| `start_date` | DATE | 合約生效日 |
| `end_date` | DATE | 合約到期日 |
| `total_amount` | DECIMAL(12,2) | 合約總金額 (若為框架合約可為 0 或 NULL) |
| `status` | VARCHAR | 狀態：`'Draft'`(草稿), `'Pending_Signature'`(待簽署), `'Active'`(生效中), `'Expired'`(已過期), `'Terminated'`(已終止) |
| `terms_summary` | TEXT | 合約重點條款摘要 |
| `file_url` | TEXT | 已簽署的實體合約掃描檔 (PDF) 下載連結 |
| `created_at` | TIMESTAMP | 建立時間 |

# 2. 後端 API 要求 (Backend API Requirements)
請建立 API 路由 `/api/sales/contracts`：
- **`GET /api/sales/contracts`**：
  - 獲取合約列表，必須 `LEFT JOIN customers` 取得客戶名稱。
  - **核心邏輯 (到期預警)**：在 SQL 中加入動態計算欄位 `days_until_expiry` (如 `end_date - CURRENT_DATE`)，讓前端知道還有幾天到期。
- **`POST /api/sales/contracts`**：建立新合約。
- **`PATCH /api/sales/contracts/[id]/status`**：更新合約狀態 (例如從待簽署改為生效中)。
- **`PATCH /api/sales/contracts/[id]/upload`**：處理合約實體檔案 (PDF) 的 URL 更新綁定。

# 3. 前端 UI 要求 (Frontend UI Requirements)

### 3.1 合約列表與預警看板 (`ContractList.tsx`)
- **頂部統計卡片 (Dashboard Cards)**：顯示「生效中合約數」、「即將到期 (30天內) 合約數」、「待簽署合約數」。
- **Data Table**：
  - 顯示：合約編號、標題、客戶、金額、狀態、到期日。
  - **視覺化高亮**：如果 `days_until_expiry` <= 30，將該行的到期日文字標示為紅色或加上 ⚠️ 警告圖示。

### 3.2 合約表單 (`ContractForm.tsx`)
- **關聯建立**：選擇客戶後，可以選擇性地從該客戶已接受的報價單 (`quotation_id`) 中載入資料與金額。
- **日期區間選擇 (Date Range Picker)**：設定 `start_date` 與 `end_date`。
- **檔案上傳區**：提供上傳正式簽署版 PDF 的按鈕 (可先做 UI 與 Mock API 預留)。

### 3.3 合約詳情頁 (Drawer / Sheet 側邊欄)
- 點擊列表的合約，從右側滑出詳情面板。
- 顯示合約基本資料、條款摘要，並提供一個明顯的「📄 下載/查看合約原件」按鈕。