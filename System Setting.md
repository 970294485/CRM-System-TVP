# 模塊 9：系統設置 (System Setting)

本模塊是全系統的「底層控制中心與安全防護網」。它不涉及日常業務流轉，而是專注於 IT 基礎設施管理、資訊安全監控，以及為企業未來的業務增長提供靈活的客製化擴展能力。

---

## 一、 業務功能詳細設計 (Functional Design)

### 1. 基礎用戶與權限設定 (User & Security Administration)
此部分負責全系統的帳號生命週期管理與底層安全策略：
* **帳號配置與管理：** 負責建立、停用或刪除員工的系統登入帳號。當員工離職時，可一鍵凍結帳號並轉移其名下的客戶與單據資料。
* **安全與認證策略：** * **登入防護：** 強制要求雙重認證 (2FA/MFA)、設定密碼複雜度規則與定期強制更改密碼。
    * **會話管理 (Session Management)：** 設定閒置超時自動登出、限制同一帳號多裝置同時登入。
* **角色與權限綁定 (RBAC)：** 將 【模塊 8】 定義好的「權限級別」具體分配給實際的用戶帳號，實現細顆粒度（檢視、編輯、刪除、導出）的權限隔離。
* **系統操作審計日誌 (Audit Logs)：** 靜默記錄所有用戶的登入時間、IP 位置以及對敏感數據（如財務報表、報價單修改）的操作軌跡，確保內部資安合規與責任追溯。

### 2. 客製化功能開發與應用 (Customization & Extensibility)
賦予系統靈活生長的能力，打破套裝軟體的限制：
* **API 金鑰與 Webhooks 管理：** * **API Keys：** 生成與作廢專屬的 API 金鑰，允許企業內部的其他系統（如自建的電商官網、物流系統）安全地讀寫 ERP 數據。
    * **Webhooks 觸發器：** 設定事件推送，例如「當報價單狀態變更為成交時，自動推送通知到公司的 Slack/Teams 群組」。
* **自定義欄位擴展 (Custom Fields Builder)：** 當模塊 1~8 的標準欄位不夠用時，管理員可在此處透過拖曳介面，為特定表單（如客戶資料、產品規格）新增「客製化欄位」（如：下拉選單、日期、勾選框），而無需重新編寫後端程式碼。
* **第三方應用整合設定 (App Integrations)：** 管理系統與外部服務的授權對接（例如：綁定 SMTP 伺服器發送 Email、對接外部金流網關、綁定 Google Calendar/Outlook 授權以驅動模塊 7 的行事曆同步）。

---

## 二、 跨模塊串聯邏輯 (Cross-Module Integration)

| 受控模塊 | 模塊 9 提供的底層支援 |
| :--- | :--- |
| **全系統 (M1-M8)** | **權限閘道：** 所有模塊的 API 請求都必須先經過 M9 的權限核對，確保「非授權用戶無法越權操作」。 |
| **模塊 6 (客戶管理)** | **日誌追蹤：** 業務員導出客戶名單或批量修改客戶狀態時，M9 會強制記錄行為日誌。 |
| **模塊 7 (服務管理)** | **授權管理：** M9 負責管理與第三方行事曆（Google/Microsoft）的 OAuth 2.0 授權憑證。 |
| **模塊 4 (文件導出)** | **外部通訊：** 若導出文件需直接透過系統 Email 發送，依賴 M9 配置的 SMTP 伺服器進行通訊。 |

---

## 三、 給 Cursor 的開發指令 (Dev Notes)

1. **認證與授權框架：** "Implement authentication using **JWT (JSON Web Tokens)**. Create a strict RBAC (Role-Based Access Control) middleware that checks user permissions on every API route based on the settings configured in this module."
2. **日誌效能優化：** "The Audit Logs table will accumulate data rapidly. Implement indexing on `user_id` and `timestamp`. Consider using a fast-write NoSQL database or an ELK stack for logs to prevent burdening the primary relational database."
3. **客製化欄位架構 (EAV/JSONB)：** "For the `Custom Fields Builder`, utilize the database's `JSONB` column capabilities to store dynamic payloads for M3/M6/M8 records, avoiding complex ALTER TABLE operations during runtime."
4. **Webhook 派發器：** "Build an asynchronous Webhook dispatcher using a job queue (like Redis + BullMQ) to ensure that pushing events to external URLs does not block the main application thread if the third-party server is slow."