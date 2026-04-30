/** 未在「文件編號」設定序號時，後端產生不重複機率較高的單號前綴。 */
export function suggestFinanceDocumentNo(prefix: string): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${y}${m}${day}-${r}`;
}
