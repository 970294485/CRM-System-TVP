import { z } from "zod";

/** 接受 HH:MM 或 HH:MM:SS，寫入 Postgres time */
export const timeStringSchema = z
  .string()
  .trim()
  .regex(/^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "時間須為 HH:MM 或 HH:MM:SS（24 小時制）")
  .transform((s) => {
    const parts = s.split(":");
    const h = parts[0]!.padStart(2, "0");
    const m = parts[1]!.padStart(2, "0");
    const sec = parts[2] != null ? parts[2]!.padStart(2, "0") : "00";
    return `${h}:${m}:${sec}`;
  });

const nullableMoney = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.union([z.number(), z.string()]).nullable()
);

const baseSalaryField = nullableMoney
  .transform((v) => {
    if (v === null) return null;
    const n = typeof v === "string" ? Number(String(v).replace(/,/g, "")) : v;
    return n;
  })
  .refine((n) => n === null || Number.isFinite(n), "底薪須為有效數字")
  .refine((n) => n === null || n >= 0, "底薪不可為負")
  .refine((n) => n === null || n <= 99_999_999.99, "底薪超出範圍");

const commissionField = nullableMoney
  .transform((v) => {
    if (v === null) return null;
    const n = typeof v === "string" ? Number(String(v).replace(/,/g, "")) : v;
    return n;
  })
  .refine((n) => n === null || Number.isFinite(n), "佣金比例須為有效數字")
  .refine((n) => n === null || (n >= 0 && n <= 1), "佣金比例須介於 0–1（例如 0.05 代表 5%）");

const optionalTime = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.union([z.null(), timeStringSchema])
);

export const employeeSettingsCreateSchema = z
  .object({
    employee_name: z.string().trim().min(1, "員工姓名必填").max(255),
    department: z.string().trim().max(255).optional().nullable(),
    base_salary: baseSalaryField,
    commission_rate: commissionField,
    work_start_time: optionalTime,
    work_end_time: optionalTime,
    is_active: z.boolean().optional().default(true),
  })
  .refine(
    (d) => {
      if (!d.work_start_time || !d.work_end_time) return true;
      return d.work_start_time < d.work_end_time;
    },
    { message: "下班時間須晚於上班時間", path: ["work_end_time"] }
  );

export type EmployeeSettingsCreateInput = z.infer<typeof employeeSettingsCreateSchema>;

export const employeeSettingsUpdateSchema = employeeSettingsCreateSchema;

export type EmployeeSettingsUpdateInput = z.infer<typeof employeeSettingsUpdateSchema>;
