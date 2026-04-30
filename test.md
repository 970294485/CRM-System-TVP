# 功能模塊開發指令
格式：
--客戶分析圖表 (Customer Analytics Dashboard)

# 任務背景 (Context)
我正在開發 B2B ERP/CRM 系統的「客戶與分析模塊」。
請幫我開發一個「客戶分析圖表」的儀表板頁面。這個頁面需要直觀地展示客戶的增長趨勢、產業分佈，以及客戶的貢獻價值（關聯我們之前在 M8 建立的 `quotations` 歷史報價單數據）。

# 技術棧 (Tech Stack) 
- 前端: Next.js (App Router), React, Tailwind CSS, shadcn/ui (Cards, Tabs)
- 圖表庫: Recharts (請使用 Recharts 實作響應式圖表，或使用 shadcn/ui 內建的 Chart 組件)
- 後端: Next.js API Routes
- 資料庫: Neon Serverless Postgres (使用 @neondatabase/serverless 執行原生 SQL)

# 1. 資料庫結構與聚合查詢要求 (Database & SQL Requirements)

**A. 前置準備：建立客戶主表 (`customers`)**
（若系統尚未建立客戶表，請先產生以下建表語句）
- `id` (UUID PK), `customer_code` (VARCHAR), `name` (VARCHAR), `industry` (VARCHAR, 產業別), `region` (VARCHAR, 地區), `status` (VARCHAR, 例如 Active/Inactive), `created_at` (TIMESTAMP)

**B. 圖表所需的 SQL 聚合邏輯 (Aggregations)**
後端 API 需要執行以下三組原生 SQL 查詢，以直接回傳統計好的數據給前端圖表：
1. **客戶增長趨勢 (Line Chart)**：
   按月份統計新增客戶數。
   `SELECT DATE_TRUNC('month', created_at) AS month, COUNT(id) AS new_customers FROM customers GROUP BY month ORDER BY month ASC;`
2. **客戶產業分佈 (Pie/Donut Chart)**：
   按產業別統計客戶佔比。
   `SELECT industry, COUNT(id) AS count FROM customers GROUP BY industry ORDER BY count DESC;`
3. **高價值客戶排行 (Bar Chart)**：
   聯合 `quotations` 報價單表，計算各客戶的歷史貢獻總額 (Top 5)。
   `SELECT c.name, SUM(q.total_amount) AS total_revenue FROM customers c JOIN quotations q ON c.id = q.customer_id GROUP BY c.id, c.name ORDER BY total_revenue DESC LIMIT 5;`

# 2. 後端 API 要求 (Backend API Requirements)
請建立 API 路由 `/api/analytics/customers` (`GET`)：
- 使用 `@neondatabase/serverless`。
- 使用 `Promise.all` 同時並行執行上述 3 個 SQL 查詢。
- 將結果格式化為 3 個獨立的 JSON 陣列 (例如 `{ growthTrend: [], industryDistribution: [], topCustomers: [] }`) 並一次性回傳，以減少前端請求次數。

# 3. 前端 UI 要求 (Frontend UI Requirements)
請建立頁面組件 `CustomerAnalyticsDashboard.tsx`：
- **頁面佈局**：使用 CSS Grid (例如 `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)，結合 shadcn/ui 的 `Card` 組件來排版圖表。
- **圖表 1：客戶增長趨勢 (折線圖 LineChart)** - 佔據較寬的版面 (col-span-full 或 col-span-2)。X軸為月份，Y軸為新增數量。
- **圖表 2：產業分佈 (環形圖/圓餅圖 PieChart/Donut)** - 加上 Custom Tooltip 顯示具體數量與比例。
- **圖表 3：客戶貢獻價值 Top 5 (長條圖 BarChart)** - X軸為貢獻金額，Y軸為客戶名稱，請橫向排版 (layout="vertical") 以適應較長的客戶名稱。
- **狀態處理**：加入 Skeleton Loading 骨架屏狀態，以及查無數據時的 Empty State 提示。

# 4. 執行步驟 (Step-by-Step Instructions)
請依照以下順序生成代碼，每完成一步請暫停等我確認：
1. **步驟 1**：生成建立 `customers` 資料表的 `.sql` 腳本檔案。
2. **步驟 2**：生成後端的 `/api/analytics/customers/route.ts` 聚合查詢邏輯。
3. **步驟 3**：生成前端的 `CustomerAnalyticsDashboard.tsx` 完整圖表儀表板組件。