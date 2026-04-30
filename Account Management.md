# 模塊 2：會計管理 (Account Management) 功能設計書

本模塊是系統的「財務紀錄終點站」，負責將全系統的業務活動（銷售、採購、請款、薪資）轉化為標準會計語言。其核心設計原則是「自動化入帳為主，手動管理為輔」。

---

## 零、 全局權限與特權 (Global Permissions)

* **超級管理員 (Super Admin God Mode)：**
    * **逆向修改權：** 在會計期間結帳後，超級管理員仍擁有權限重開帳期並修正憑證。
    * **數據覆蓋權：** 可直接修改「自動生成」的會計分錄科目與金額。
    * **審計日誌：** 所有超級管理員的手動干預動作，系統必須強制記錄 `Audit Log`。

---

## 一、 業務功能詳細設計 (Functional Design)

### 1. 會計基礎管理 (Accounting Fundamentals)
* **會計期間管理：** 支援開啟/關閉月度或年度會計區間。關帳後鎖定數據，防止誤改。
* **幣別與匯率：** 定義系統本位幣，並提供外幣交易的匯率換算邏輯。
* **雙式記帳校驗：** 系統內所有憑證（自動或手動）必須符合「借貸平衡」，否則禁止存檔。

### 2. 賬款應收/應付管理 (AR/AP Management)
* **應收帳款 (AR) 分帳：** 與 **【模塊 3】** 串聯。合同/發票生成時自動建立債權明細。
* **應付帳款 (AP) 分帳：** 與 **【模塊 8】** 串聯。採購單生成後自動建立債務明細。
* **帳齡分析：** 實時統計各客戶與供應商的欠款天數，提供逾期警示。

### 3. 利潤表 (Profit & Loss Statement)
* **自動結轉損益：** 實時彙整營業收入、營業成本（採購、人事薪資）及各項費用。
* **多維度分析：** 支持按月份、季度、年度或「特定項目標籤」生成損益報告。

### 4. 資產負債表 (Balance Sheet)
* **財務狀況快照：** 反映資產（現金、應收、存貨）、負債（應付、預收）與所有者權益。
* **自動平衡校驗：** 確保 $資產 = 負債 + 所有者權益$ 恆等式成立。

### 5. 總賬 (General Ledger)
* **單一事實來源：** 彙整所有明細科目（分控帳）的最終數據。
* **試算平衡：** 提供全科目借貸方金額彙總校對功能。

### 6. 入賬類別和項目設定 (COA & Categories)
* **會計科目表 (Chart of Accounts)：** 讀取 **【模塊 8】** 定義的科目結構。
* **核算維度：** 支援為憑證掛載「部門」或「專案」標籤，實現精細化成本核算。

### 7. 手動管理功能 (Manual Accounting Control) —— *系統安全防線*
* **手動憑證 (Manual Journal Entry)：** 處理非業務觸發的帳務（如：銀行利息、稅金支出、固定資產折舊）。
* **紅字沖銷：** 針對錯誤的自動入帳，提供「一鍵沖銷」並重新入帳的功能。
* **期末調整：** 會計人員可在結帳前執行匯兌損益、預提費用等調整分錄。

---

## 二、 跨模塊串聯邏輯 (Cross-Module Integration)

| 關聯模塊 | 自動化數據流轉邏輯 |
| :--- | :--- |
| **模塊 1 (財務管理)** | **核心驅動：** 當模塊 1 確認收款/付款時，自動觸發本模塊生成會計憑證並核銷 AR/AP。 |
| **模塊 8 (資料輸入)** | **主數據同步：** 讀取模塊 8 定義的會計科目、採購單金額、以及人事薪資支出數據。 |
| **模塊 3 (銷售管理)** | **債權建立：** 合同生效後，自動在本模塊建立應收帳款；佣金計算結果自動轉為費用憑證。 |
| **模塊 6 (客戶管理)** | **信用反饋：** 本模塊將客戶的欠款餘額與帳齡數據推送到模塊 6，優化客戶信用評級。 |
| **模塊 4 (文件導出)** | **報表渲染：** 調用模塊 4 將利潤表、資產負債表導出為正式的 Excel 或 PDF。 |
| **模塊 5 (文件管理)** | **帳證相符：** 會計憑證可直接關聯模塊 5 中的原始單據（如發票截圖、合同掃描件）。 |
| **模塊 7 (服務管理)** | **成本計算：** 抓取模塊 7 的服務時數數據，用於分析特定勞務項目的成本與毛利。 |
| **模塊 9 (系統設置)** | **結帳鎖定：** 依照模塊 9 的權限設定，限制非財務人員訪問敏感會計數據。 |

---

## 三、 給 Cursor 的開發指令 (Dev Notes)

1. **監聽器設計：** "Implement a backend event listener. When `PaymentRequest.status` in Module 1 changes to `CONFIRMED`, generate a `JournalEntry` record in Module 2 based on the predefined mapping rules."
2. **數據精度要求：** "All currency fields must use `Decimal(15,2)`. Do not use `Float` or `Double` to avoid rounding errors in financial reports."
3. **不可變性規則：** "Once a Journal Entry is posted, it cannot be deleted. Any corrections must be done via a reversal entry (Red-Storno) or by a user with `SUPER_ADMIN` status."
4. **即時性要求：** "All financial reports (P&L, Balance Sheet) must reflect data in real-time or be triggered for refresh upon voucher updates."