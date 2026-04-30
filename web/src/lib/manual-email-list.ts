const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 從字串陣列解析、去重、簡易格式驗證（支援每項內含逗號／分號分隔） */
export function normalizeManualEmails(input: string[] | undefined): string[] {
  if (!input?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const segments = raw
      .split(/[\s,;，、\n\r]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const e0 of segments) {
      const e = e0.toLowerCase();
      if (seen.has(e)) continue;
      if (!SIMPLE_EMAIL.test(e)) continue;
      seen.add(e);
      out.push(e);
    }
  }
  return out;
}

export function templateVarsFromManualEmail(email: string): Record<string, string> {
  const local = email.split("@")[0] ?? "";
  return {
    customer_name: local || "貴客戶",
    contact_name: "",
    email,
  };
}
