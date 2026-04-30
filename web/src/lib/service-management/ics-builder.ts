import type { CalendarBookingEvent, CalendarCaseEvent } from "./calendar-events";

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

function foldLine(line: string): string {
  const max = 73;
  if (line.length <= max) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > max) {
    parts.push(rest.slice(0, max));
    rest = ` ${rest.slice(max)}`;
  }
  if (rest.length) parts.push(rest);
  return parts.join("\r\n ");
}

/** YYYYMMDDTHHmmssZ */
export function formatIcsUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

function uid(prefix: string, id: string): string {
  return `${prefix}-${id}@${process.env.NEXT_PUBLIC_APP_ORIGIN ?? "crm-local"}`;
}

function describeBooking(b: CalendarBookingEvent): string {
  const lines: string[] = [];
  lines.push(`服務預約`);
  if (b.caseNo) lines.push(`案件編號：${b.caseNo}`);
  if (b.customerNameSnapshot) lines.push(`客戶（快照）：${b.customerNameSnapshot}`);
  if (b.customerPhone) lines.push(`電話：${b.customerPhone}`);
  if (b.customerEmail) lines.push(`Email：${b.customerEmail}`);
  if (b.venueName) lines.push(`場地：${b.venueName}`);
  if (b.staffName) lines.push(`負責人：${b.staffName}${b.staffEmail ? ` <${b.staffEmail}>` : ""}`);
  if (b.purchaseNote) lines.push(`加購／耗材：${b.purchaseNote}`);
  if (b.notes) lines.push(`備註：${b.notes}`);
  lines.push("");
  lines.push("（行事曆由 CRM 系統匯出；雙向外掛行事曆可於後續版串接 OAuth／CalDAV。）");
  return lines.filter(Boolean).join("\n");
}

function describeCase(c: CalendarCaseEvent): string {
  const lines: string[] = [];
  lines.push(`指派客服案件（依最近一次更新時間作為日程錨點）`);
  lines.push(`狀態：${c.status}　優先：${c.priority}`);
  lines.push(`客戶：${c.customerNameSnapshot}`);
  if (c.summary) lines.push(`摘要：${c.summary}`);
  lines.push(`負責人：${c.assignedToName ?? ""}`);
  return lines.join("\n");
}

export type IcsBuildInput = {
  bookings: CalendarBookingEvent[];
  caseMarkers: CalendarCaseEvent[];
  calendarName?: string;
};

/** RFC 5545 簡版 .ics（單一日曆）；Google Calendar / Outlook 可匯入訂閱 */
export function buildServiceManagementIcs(input: IcsBuildInput): string {
  const name = escapeText(input.calendarName ?? "CRM 服務與指派行事曆");
  const stamp = formatIcsUtc(new Date());

  const events: string[] = [];

  for (const b of input.bookings) {
    const start = formatIcsUtc(new Date(b.startsAt));
    const end = formatIcsUtc(new Date(b.endsAt));
    const uidLine = uid("booking", b.id);
    const lines = [
      "BEGIN:VEVENT",
      `UID:${uidLine}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeText(b.title)}`,
      `DESCRIPTION:${escapeText(describeBooking(b))}`,
    ];
    if (b.venueName?.trim()) {
      lines.push(`LOCATION:${escapeText(b.venueName.trim())}`);
    }
    lines.push("END:VEVENT");
    events.push(lines.join("\r\n"));
  }

  for (const c of input.caseMarkers) {
    const day = c.dayStartUtc.slice(0, 10).replace(/-/g, "");
    /** VALUE=DATE 全日事件：終日結束為隔日拂曉（不包含） */
    const dayEndPlus = new Date(c.dayStartUtc);
    dayEndPlus.setUTCDate(dayEndPlus.getUTCDate() + 1);
    const dayEnd = formatIcsUtc(dayEndPlus).slice(0, 8);
    events.push([
      "BEGIN:VEVENT",
      `UID:${uid("case", c.id)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day}`,
      `DTEND;VALUE=DATE:${dayEnd}`,
      `SUMMARY:${escapeText(`【客服】 ${c.caseNo} ${c.title}`)}`,
      `DESCRIPTION:${escapeText(describeCase(c))}`,
      "END:VEVENT",
    ].join("\r\n"));
  }

  const bodyLines = [`BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID:-//CRM System//ZH//`, `CALSCALE:GREGORIAN`, `METHOD:PUBLISH`, `X-WR-CALNAME:${name}`, ...events.flatMap((e) => e.split("\r\n")), `END:VCALENDAR`];

  const out = bodyLines.map((ln) => foldLine(ln)).join("\r\n");
  return `${out}\r\n`;
}
