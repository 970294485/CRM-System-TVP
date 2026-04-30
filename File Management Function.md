# 模塊 5：文件管理功能 (File Management Function)

本模塊為系統的「中央數位資產中心」，負責全公司文件的物理存儲、結構化分類以及內部協作共享。設計核心在於 100% 的人工管理權限與靈活的目錄架構。

---

## 零、 全局權限與特權 (Global Permissions)

* **超級管理員 (Super Admin God Mode)：**
    * **全域架構管理：** 具備建立、重組及刪除「公共文件數據庫」所有目錄的最高權限。
    * **容量與審計：** 可監控所有員工網盤的空間使用量，並查閱檔案的上傳、下載、分享與發布日誌。
    * **發布審核權：** 負責審核普通員工提交至「公共文件數據庫」的檔案。
    * **數據恢復：** 可進入回收站強制恢復任何被刪除的公共或業務檔案。

---

## 一、 業務功能詳細設計 (Functional Design)

### 1. 文件分類功能 (Custom Categorization)
這是本模塊的組織基礎，透過手動搭建目錄樹與業務邏輯確保檔案有序。
* **自定義多級目錄：** 支援無限層級的文件夾嵌套。管理員或授權員工可自由創建、移動、重命名文件夾（如：`行政管理 > 2026年 > 勞動合同`）。
* **業務自動歸檔：** 接收來自 **【模塊 4】** 的單據。系統會根據業務邏輯自動將生成的 PDF 存入指定的自定義分類中（如：自動歸類至 `銷售部 > 客戶名 > 報價單`）。
* **目錄鎖定：** 管理員可針對核心文件夾設置「唯讀」或「禁止刪除」，確保官方資料安全。

### 2. 個人網盤功能 (Personal Cloud Drive)
為每位員工提供的專屬私有辦公空間，用於存放個人草稿與臨時協作文件。
* **上傳下載功能：**
    * **高性能傳輸：** 支援多文件批次上傳、拖拽上傳。
    * **斷點續傳：** 具備傳輸保護機制，確保大型檔案在網絡波動時不會失敗。
* **檔案管理：** 提供移動、複製、重命名、刪除（回收站）等標準操作。
* **內部員工分享功能：**
    * **點對點分享：** 員工可將個人網盤中的檔案分享給特定同事或整個部門，並設定「僅檢視」或「可下載」權限。
    * **分享通知：** 被分享者會收到系統即時通知，並可在「與我分享」列表查看檔案。
* **外鏈分享：** 支援生成外部下載連結，可自定義「下載密碼」與「有效期限」（如 7 天後連結失效）。

### 3. 公共文件數據庫 (Public Document Database)
企業級的「官方知識庫」，供全體或特定權限組查閱。
* **發布至公共庫：** * 支援員工將個人網盤中的檔案「分享/發布」至公共數據庫。
    * **審核流：** 普通員工發布檔案至公共區需經由超級管理員審核通過後，才會正式出現在指定的公共分類目錄中。
* **權限分級：** 不同職位的員工可看到的公共文件夾不同（由管理員設定）。
* **官方文檔標記：** 存放在此區域的檔案預設受保護，普通員工無法隨意刪除或修改。

---

## 二、 跨模塊串聯邏輯 (Cross-Module Integration)

| 關聯模塊 | 聯動動作描述 |
| :--- | :--- |
| **模塊 4 (文件導出)** | **自動歸檔：** 模塊 4 生成的 PDF 將依據模塊 5 定義的分類路徑，自動存入對應目錄。 |
| **模塊 3 (銷售管理)** | **附件索引：** 銷售合同頁面顯示的「文件列表」實時讀取本模塊中該客戶/項目分類下的內容。 |
| **模塊 8 (資料輸入)** | **變量獲取：** 文件夾的預設命名（如客戶編號、項目代碼）數據來源於模塊 8。 |
| **模塊 9 (系統設置)** | **空間管控：** 管理員在此設定不同級別帳號的網盤容量上限（如 10GB/100GB）。 |
| **模塊 6 (客戶管理)** | **檔案畫像：** 在客戶詳情頁匯整顯示模塊 5 中所有關聯該客戶的業務與分享檔案。 |

---

## 三、 給 Cursor 的開發指令 (Dev Notes)

1. **目錄架構設計：** "Use a parent-child relationship table (Adjacency List) to build a recursive folder structure that supports unlimited nesting."
2. **權限驗證邏輯：** "Implement a `File_Access_Control` table to manage 'Owner', 'Individual_Share', 'Department_Share', and 'Public_Access' permissions."
3. **物理存儲安全：** "Do not expose real file system paths. Use a file stream controller to serve files after verifying user tokens and permissions."
4. **分享與發布技術點：** "Create a `Publish_Request` queue for files shared from Personal Drive to the Public Database, allowing admins to approve/reject the action."
5. **超級管理員覆蓋：** "Enable a `bypass_acl` flag for the `SUPER_ADMIN` role to manage all files across both private and public storage areas for compliance auditing."