# 模塊 4：文件導出功能 (Document Excel & PDF Function)

本模塊為系統的「中央文件工廠」。其核心職責是接收來自銷售、財務、會計等模塊的原始數據，透過預設或自定義模板，渲染成正式的 PDF 或 Excel 文件，並自動觸發歸檔流程。

---

## 零、 全局權限與特權 (Global Permissions)

* **超級管理員 (Super Admin God Mode)：**
    * **模板設計權：** 唯有管理員可進入「模板編輯器」修改 INVOICE 或 QUOTATION 的全局排版。
    * **預覽微調權：** 導出前預覽時，管理員可手動增加「單次備註」或「臨時條款」，此修改僅反映在該次 PDF 文件中，不改動資料庫。
    * **批量導出：** 支援一次性選擇多份單據進行批量渲染與打包下載。

---

## 一、 業務功能詳細設計 (Functional Design)

### 1. 標準單據導出清單 (Standard Export List)
系統內置以下四種標準導出功能，數據實時與相關模塊關聯：
* **導出 QUOTATION (報價單)：**
    * 數據來源：**【模塊 3】**。
    * 包含：產品圖、詳細規格、折扣政策、公司簽章、有效期。
* **導出 INVOICE (發票/預收發票)：**
    * 數據來源：**【模塊 3】**。
    * 包含：收款銀行帳號 (來自模塊 8)、稅務資訊、支付截止日、付款條款。
* **導出 DELIVERY NOTE (送貨單)：**
    * 數據來源：**【模塊 3 / 模塊 8】**。
    * 包含：收件人資訊、產品清單、數量核對欄位、客戶簽收處。
* **導出 PAYMENT REQUEST (請款單)：**
    * 數據來源：**【模塊 1】**。
    * 包含：應收總額、歷次已付明細、當前餘額、匯款指引。

### 2. 自定義模板編輯器 (Template Builder)
* **數據變量綁定 (Variable Mapping)：** 支援在模板中插入 `{{Customer_Name}}`、`{{Total_Amount}}` 等標籤，系統導出時自動填充。
* **可視化編輯：** 提供 HTML/CSS 基礎模板，支援管理員上傳公司 Logo、調整頁眉頁腳、更換字體與配色。
* **多語言支持：** 同一單據可設定不同語言模板（如：繁體中文、英文）。

### 3. 多格式支持 (Format Support)
* **PDF (不可篡改)：** 用於發送給客戶的正式商務單據。
* **Excel (數據分析)：** 針對 **【模塊 2】** 的利潤表、資產負債表，提供可編輯的 Excel 導出以便財務核算。

### 4. 自動化流轉與歸檔 (Auto-Archiving)
* **自動傳輸：** 點擊導出後，模塊 4 完成渲染，自動將文件實體流 (File Stream) 發送至 **【模塊 5】**。
* **回傳下載：** 完成歸檔後，由界面提供指向 **【模塊 5】** 的下載連結，並在原始單據（如該份合同頁面）標記「已生成 PDF」。

---

## 二、 跨模塊串聯邏輯 (Cross-Module Integration)

| 關聯模塊 | 聯動動作描述 |
| :--- | :--- |
| **模塊 3 (銷售管理)** | 發送報價單/發票數據包，接收導出成功的 PDF 下載鏈接。 |
| **模塊 1 (財務管理)** | 提供請款進度數據，由模塊 4 轉化為請款單 PDF。 |
| **模塊 8 (資料輸入)** | **全局設置來源：** 模塊 4 所有的模板自動讀取模塊 8 中的「公司名稱」、「Logo」、「銀行帳戶」等全局變量。 |
| **模塊 5 (文件管理)** | **唯一儲存端：** 接收模塊 4 產出的所有檔案實體，並負責分類儲存與路徑管理。 |
| **模塊 2 (會計管理)** | 接收財務報表數據，導出為符合審計要求的 Excel 文件。 |

---

## 三、 給 Cursor 的開發指令 (Dev Notes)

1. **渲染技術棧：** "Use **Puppeteer** or **Playwright** to convert HTML/CSS templates to PDF to ensure high-fidelity layouts."
2. **模板引擎：** "Implement **Handlebars.js** or **LiquidJS** as the rendering engine to map JSON data to document variables."
3. **數據傳輸協定：** "The Export API must be stateless. It receives `template_id` and `payload_json`, renders the file, and immediately pushes the stream to Module 5's storage endpoint."
4. **管理員覆蓋邏輯：** "Add an `override_buffer` field in the API to allow `SUPER_ADMIN` to inject temporary text (notes/terms) without affecting the permanent database records."
5. **性能要求：** "Support asynchronous batch generation to avoid blocking the main server thread during large-scale invoice exports."