/** 將 `{{customer_name}}` 等佔位符替換為實際值（鍵名允許左右空白）。 */
export function applyEmailTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}
