# 模塊 7：服務管理功能 (Service Management Function)

本模塊是系統的「執行指揮中心」，負責處理合同後的服務落地、資源預約與執行進度追蹤。它將客戶需求轉化為具體的服務任務，並確保相關人員與場地的資源得到最優配置。

---

## 零、 全局權限與角色 (Global Permissions)

* **服務管理員 (Service Dispatcher)：** 具備全局視角，可指派員工、調整場地預約，並查閱所有服務單狀態。
* **執行員工 (Service Staff)：** 僅能查看與自己相關的預約任務，紀錄服務備註，並同步行事曆。
* **超級管理員 (Super Admin)：** 具備修改服務標準、刪除錯誤紀錄及導出全局服務報表的權限。

---

## 一、 業務功能詳細設計 (Functional Design)

### 1. 客服務數據錄入與備註管理 (Service Logging & Remarking)
這是服務生命週期的起點，確保每一次服務都有跡可循。
* **服務單錄入：** 接收來自 **【模塊 3】** 的成交訂單，自動生成服務任務單。
* **結構化備註管理：** * 支援多輪備註紀錄，每次備註自動帶上「時間戳」與「編輯人」。
    * **附件上傳：** 支援在備註中直接上傳現場照片、簽收單掃描件（儲存至 **【模塊 5】**）。
* **狀態流轉：** 標記服務狀態為「待排期」、「進行中」、「異常掛起」、「已完結」。

### 2. 購買與預約功能：員工與場地配置 (Resource Booking & Allocation)
針對需要實體場地或特定人員的服務進行資源鎖定。
* **員工排班配置：** * 系統顯示員工的忙閒狀態，管理員可一鍵指派「負責人」。
    * 支援根據員工技能標籤（來自 **【模塊 8】**）進行篩選指派。
* **場地/設備預約：** * 視覺化場地平面圖或清單（如：會議室、維修工位、活動場地）。
    * **防衝突機制：** 同一時段同一資源禁止重複預約。
* **服務包購買紀錄：** 若服務涉及耗材或額外購買項目，紀錄於此並聯動回 **【模塊 1】** 的支出成本。

### 3. 訂單與負責人行事曆同步 (Calendar Orchestration)
解決資訊不對稱問題，確保執行端準時到位。
* **雙向行事曆同步：** * 系統內生成服務訂單後，自動推送到負責人的個人行事曆（支援 CalDAV, Google Calendar, Outlook 同步）。
    * 行事曆內容包含：客戶聯絡資訊（聯動 **M6**）、場地導航鏈結、服務重點備註。
* **實時提醒中心：** 服務開始前 1 小時、前 1 天，透過 **【模塊 9】** 發送彈窗或郵件提醒。

---

## 二、 跨模塊串聯邏輯 (Cross-Module Integration)

| 關聯模塊 | 數據流轉說明 |
| :--- | :--- |
| **模塊 3 (銷售管理)** | **訂單來源：** M3 合同簽署後，自動在本模塊生成「待排期」服務單。 |
| **模塊 6 (客戶管理)** | **資料提取：** 服務過程中直接調取 M6 的客戶歷史與偏好，確保服務個性化。 |
| **模塊 5 (文件管理)** | **檔案儲存：** 服務現場上傳的完工照片或簽收文檔，物理儲存於 M5 的客戶資料夾中。 |
| **模塊 8 (資料輸入)** | **主數據源：** 員工清單、技能標籤、場地清單及其最大容量均讀取自 M8。 |
| **模塊 1 (財務管理)** | **成本回傳：** 服務產生的額外成本（如場地租金、加購耗材）回傳給 M1 核算。 |
| **模塊 9 (系統設置)** | **通知中心：** 負責發送預約成功通知與行事曆同步的身份驗證。 |

---

## 三、 給 Cursor 的開發指令 (Dev Notes)

1. **資源調度算法：** "Implement a conflict-check logic for `staff_id` and `venue_id`. When a new booking request is made, query the `Service_Appointments` table for any overlapping time slots."
2. **行事曆集成：** "Integrate with **iCal/CalDAV** standards. Generate a unique `.ics` subscription link for each employee to sync service orders with their mobile phone calendars."
3. **備註版本控制：** "Ensure the `Remarks` field in the service table is append-only for audit purposes, storing an array of JSON objects containing `{timestamp, author, content}`."
4. **前端介面：** "Use a **Gantt Chart** or **Calendar View** for the service dispatcher to manage multiple staff schedules and venue bookings visually."