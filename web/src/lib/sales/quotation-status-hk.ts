/** 報價單狀態：資料庫／API 沿用英文代碼，畫面顯示香港繁體中文 */

const LABELS: Record<string, string> = {
  Draft: "草稿",
  Sent: "已發出",
  Accepted: "已接納",
  Expired: "已失效",
  Converted: "已轉合同",
  Legacy_Imported: "歷史匯入",
};

export function quotationStatusLabelHk(status: string): string {
  return LABELS[status] ?? status;
}
