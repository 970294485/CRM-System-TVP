"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Control, Resolver } from "react-hook-form";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { lineTotalFromInputs, totalsFromLines } from "@/lib/sales/quotation-math";
import { quotationStatusLabelHk } from "@/lib/sales/quotation-status-hk";

const itemSchema = z.object({
  product_id: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  name: z.string().min(1, "請填品名"),
  qty: z.coerce.number().min(0),
  unit_price: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).max(100),
  line_total: z.coerce.number(),
});

const formSchema = z.object({
  customer_id: z.string().min(1, "請選擇客戶").uuid("請選擇客戶"),
  quote_date: z.string(),
  valid_until: z.string(),
  tax_rate: z.coerce.number().min(0).max(100),
  notes: z.string().optional(),
  status: z.string(),
  items: z.array(itemSchema).min(1, "至少一筆品項"),
});

export type QuotationFormValues = z.infer<typeof formSchema>;

export type CustomerOption = {
  id: string;
  name: string;
  customerCode: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};

export type ProductOption = {
  id: string;
  sku: string;
  name: string;
  basePrice: string | null;
};

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export const emptyQuotationDefaults = (): QuotationFormValues => ({
  customer_id: "",
  quote_date: todayYmd(),
  valid_until: addDaysYmd(todayYmd(), 7),
  tax_rate: 5,
  notes: "",
  status: "Draft",
  items: [
    {
      product_id: null,
      sku: "",
      name: "",
      qty: 1,
      unit_price: 0,
      discount: 0,
      line_total: 0,
    },
  ],
});

function LineTotalSync({
  index,
  control,
  setValue,
}: {
  index: number;
  control: Control<QuotationFormValues>;
  setValue: ReturnType<typeof useForm<QuotationFormValues>>["setValue"];
}) {
  const row = useWatch({ control, name: `items.${index}` });
  useEffect(() => {
    if (!row) return;
    const lt = lineTotalFromInputs(
      Number(row.qty),
      Number(row.unit_price),
      Number(row.discount ?? 0)
    );
    setValue(`items.${index}.line_total`, lt);
  }, [row?.qty, row?.unit_price, row?.discount, index, setValue, row]);
  return null;
}

const CONTRACT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "Active", label: "生效中" },
  { value: "Completed", label: "已完成" },
  { value: "Cancelled", label: "已取消" },
];

type QuotationEditorProps = {
  formId: string;
  defaultValues: QuotationFormValues;
  /** 當外部載入新單據時傳入新 key 以 reset */
  formKey?: string;
  /** 唯讀（查看）：不允許編輯與送出 */
  readOnly?: boolean;
  /** 編輯／查看時預填客戶搜尋框顯示文字 */
  prefillCustomerQuery?: string;
  /** 銷售合同：日期與狀態選項改為合同用語 */
  documentKind?: "quotation" | "contract";
  onValuesChange?: (values: QuotationFormValues) => void;
  onCustomerResolved?: (customer: CustomerOption | null) => void;
  onSubmit?: (values: QuotationFormValues) => Promise<void>;
  saving: boolean;
  submitLabel?: string;
};

export function QuotationEditor({
  formId,
  defaultValues,
  formKey = "default",
  readOnly = false,
  prefillCustomerQuery = "",
  documentKind = "quotation",
  onValuesChange,
  onCustomerResolved,
  onSubmit,
  saving,
  submitLabel = "儲存",
}: QuotationEditorProps) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    getValues,
    reset,
    formState: { errors },
  } = useForm<QuotationFormValues>({
    resolver: zodResolver(formSchema) as Resolver<QuotationFormValues>,
    defaultValues,
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  useEffect(() => {
    reset(defaultValues);
    if (prefillCustomerQuery) setCustQ(prefillCustomerQuery);
    else if (!readOnly) setCustQ("");
  }, [formKey, defaultValues, reset, prefillCustomerQuery, readOnly]);

  useEffect(() => {
    onValuesChange?.(getValues());
  }, [formKey, defaultValues, getValues, onValuesChange]);

  useEffect(() => {
    if (!onValuesChange) return;
    const { unsubscribe } = watch(() => {
      onValuesChange(getValues());
    });
    return () => unsubscribe();
  }, [watch, getValues, onValuesChange]);

  const [custQ, setCustQ] = useState("");
  const [custOpen, setCustOpen] = useState(false);
  const [custHits, setCustHits] = useState<CustomerOption[]>([]);
  const [custLoading, setCustLoading] = useState(false);
  const custDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCustomers = useCallback(async (q: string) => {
    setCustLoading(true);
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}&limit=30` : "?limit=30";
      const res = await fetch(`/api/sales/customers${qs}`, { credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { items?: CustomerOption[] };
      setCustHits(Array.isArray(data.items) ? data.items : []);
    } catch {
      setCustHits([]);
    } finally {
      setCustLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!custOpen) return;
    if (custDebounce.current) clearTimeout(custDebounce.current);
    custDebounce.current = setTimeout(() => {
      void fetchCustomers(custQ);
    }, 280);
    return () => {
      if (custDebounce.current) clearTimeout(custDebounce.current);
    };
  }, [custQ, custOpen, fetchCustomers]);

  const customerId = watch("customer_id");
  const selectedCustomer = useMemo(
    () => custHits.find((c) => c.id === customerId) ?? null,
    [custHits, customerId]
  );

  const quoteDate = watch("quote_date");
  const taxRate = watch("tax_rate");
  const itemsWatch = useWatch({ control, name: "items" });

  const summary = useMemo(() => {
    const lines = Array.isArray(itemsWatch) ? itemsWatch : [];
    const totals = lines.map((l) =>
      lineTotalFromInputs(
        Number(l?.qty),
        Number(l?.unit_price),
        Number(l?.discount ?? 0)
      )
    );
    return totalsFromLines(totals, Number(taxRate) || 0);
  }, [itemsWatch, taxRate]);

  const setValidDays = (days: number) => {
    const base = watch("quote_date") || todayYmd();
    setValue("valid_until", addDaysYmd(base, days));
  };

  const submitHandler = onSubmit ? handleSubmit(onSubmit) : (e: FormEvent) => e.preventDefault();

  return (
    <form id={formId} onSubmit={submitHandler} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative space-y-2 sm:col-span-2">
          <Label>客戶</Label>
          {readOnly ? (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
              {prefillCustomerQuery || selectedCustomer?.name || "—"}
            </p>
          ) : (
          <Input
            placeholder="搜尋名稱、編號、電話…"
            value={custQ}
            onChange={(e) => {
              setCustQ(e.target.value);
              setCustOpen(true);
            }}
            onFocus={() => {
              setCustOpen(true);
              void fetchCustomers(custQ);
            }}
            autoComplete="off"
          />
          )}
          {!readOnly && custOpen ? (
            <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {custLoading ? (
                <p className="px-3 py-2 text-sm text-zinc-500">載入中…</p>
              ) : custHits.length === 0 ? (
                <p className="px-3 py-2 text-sm text-zinc-500">無符合項目</p>
              ) : (
                <ul className="py-1">
                  {custHits.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        onClick={() => {
                          setValue("customer_id", c.id, { shouldValidate: true });
                          setCustQ(c.name);
                          setCustOpen(false);
                          onCustomerResolved?.(c);
                        }}
                      >
                        <span className="font-medium">{c.name}</span>
                        {c.customerCode ? (
                          <span className="ml-2 text-xs text-zinc-500">{c.customerCode}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          <input type="hidden" {...register("customer_id")} />
          {errors.customer_id ? (
            <p className="text-sm text-red-600">{errors.customer_id.message}</p>
          ) : null}
          {!readOnly && customerId && selectedCustomer ? (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950">
              <p>
                聯絡：{selectedCustomer.contactName ?? "—"} · {selectedCustomer.phone ?? "—"} ·{" "}
                {selectedCustomer.email ?? "—"}
              </p>
              {selectedCustomer.address ? <p className="mt-1">{selectedCustomer.address}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="quote_date">{documentKind === "contract" ? "合同日期" : "報價日期"}</Label>
          <Input id="quote_date" type="date" disabled={readOnly} {...register("quote_date")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valid_until">有效至</Label>
          <Input id="valid_until" type="date" disabled={readOnly} {...register("valid_until")} />
          {!readOnly ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setValidDays(7)}>
                  +7 天
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setValidDays(15)}>
                  +15 天
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setValidDays(30)}>
                  +30 天
                </Button>
              </div>
              <p className="text-xs text-zinc-500">
                自{documentKind === "contract" ? "合同日" : "報價日"} {quoteDate} 起算
              </p>
            </>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tax_rate">稅率 (%)</Label>
          <Input id="tax_rate" type="number" step="0.01" min={0} max={100} disabled={readOnly} {...register("tax_rate")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">狀態</Label>
          <select
            id="status"
            disabled={readOnly}
            className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900"
            {...register("status")}
          >
            {documentKind === "contract"
              ? CONTRACT_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))
              : (
                  <>
                    <option value="Draft">{quotationStatusLabelHk("Draft")}</option>
                    <option value="Sent">{quotationStatusLabelHk("Sent")}</option>
                    <option value="Accepted">{quotationStatusLabelHk("Accepted")}</option>
                    <option value="Expired">{quotationStatusLabelHk("Expired")}</option>
                    <option value="Converted">{quotationStatusLabelHk("Converted")}</option>
                  </>
                )}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>明細</Label>
          {!readOnly ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                append({
                  product_id: null,
                  sku: "",
                  name: "",
                  qty: 1,
                  unit_price: 0,
                  discount: 0,
                  line_total: 0,
                })
              }
            >
              新增品項
            </Button>
          ) : null}
        </div>

        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                <th className="px-2 py-2">品名 / 選產品</th>
                <th className="px-2 py-2">SKU</th>
                <th className="px-2 py-2 w-24">數量</th>
                <th className="px-2 py-2 w-28">單價</th>
                <th className="px-2 py-2 w-24">折扣%</th>
                <th className="px-2 py-2 w-28 text-right">小計</th>
                <th className="px-2 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <QuotationLineRow
                  key={field.id}
                  index={index}
                  control={control}
                  register={register}
                  setValue={setValue}
                  remove={remove}
                  canRemove={fields.length > 1}
                  readOnly={readOnly}
                />
              ))}
            </tbody>
          </table>
        </div>
        {errors.items && typeof errors.items.message === "string" ? (
          <p className="text-sm text-red-600">{errors.items.message}</p>
        ) : null}
      </div>

      {fields.map((field, index) => (
        <LineTotalSync key={field.id} index={index} control={control} setValue={setValue} />
      ))}

      <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">金額匯總</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div className="flex justify-between sm:block">
            <dt className="text-zinc-500">未稅小計</dt>
            <dd className="font-medium tabular-nums">{summary.subtotal.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="text-zinc-500">稅額</dt>
            <dd className="font-medium tabular-nums">{summary.tax_amount.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="text-zinc-500">含稅總計</dt>
            <dd className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {summary.total_amount.toFixed(2)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">備註</Label>
        <Textarea id="notes" rows={3} placeholder="交易條款、交期說明…" disabled={readOnly} {...register("notes")} />
      </div>

      {!readOnly && onSubmit ? (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "儲存中…" : submitLabel}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function QuotationLineRow({
  index,
  control,
  register,
  setValue,
  remove,
  canRemove,
  readOnly,
}: {
  index: number;
  control: Control<QuotationFormValues>;
  register: ReturnType<typeof useForm<QuotationFormValues>>["register"];
  setValue: ReturnType<typeof useForm<QuotationFormValues>>["setValue"];
  remove: (i: number) => void;
  canRemove: boolean;
  readOnly: boolean;
}) {
  const [prodQ, setProdQ] = useState("");
  const [prodOpen, setProdOpen] = useState(false);
  const [prodHits, setProdHits] = useState<ProductOption[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProducts = useCallback(async (q: string) => {
    setProdLoading(true);
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}&limit=20` : "?limit=20";
      const res = await fetch(`/api/products${qs}`, { credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { items?: ProductOption[] };
      setProdHits(Array.isArray(data.items) ? data.items : []);
    } catch {
      setProdHits([]);
    } finally {
      setProdLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!prodOpen) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void fetchProducts(prodQ);
    }, 280);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [prodQ, prodOpen, fetchProducts]);

  const lineTotal = useWatch({ control, name: `items.${index}.line_total` });

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800/80">
      <td className="px-2 py-2 align-top">
        <div className="relative space-y-1">
          <Input placeholder="品名" disabled={readOnly} {...register(`items.${index}.name`)} />
          {!readOnly ? (
          <Input
            placeholder="搜尋產品…"
            className="text-xs"
            value={prodQ}
            onChange={(e) => {
              setProdQ(e.target.value);
              setProdOpen(true);
            }}
            onFocus={() => {
              setProdOpen(true);
              void fetchProducts(prodQ);
            }}
          />
          ) : null}
          {!readOnly && prodOpen ? (
            <div className="absolute left-0 right-0 z-20 mt-1 max-h-40 overflow-auto rounded border border-zinc-200 bg-white text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-900">
              {prodLoading ? (
                <p className="px-2 py-1.5 text-zinc-500">載入中…</p>
              ) : prodHits.length === 0 ? (
                <p className="px-2 py-1.5 text-zinc-500">無產品</p>
              ) : (
                <ul>
                  {prodHits.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="w-full px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        onClick={() => {
                          const price = p.basePrice != null ? Number(p.basePrice) : 0;
                          setValue(`items.${index}.product_id`, p.id);
                          setValue(`items.${index}.sku`, p.sku);
                          setValue(`items.${index}.name`, p.name);
                          setValue(`items.${index}.unit_price`, Number.isFinite(price) ? price : 0);
                          setProdOpen(false);
                          setProdQ("");
                        }}
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="ml-1 font-mono text-zinc-500">{p.sku}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </td>
      <td className="px-2 py-2 align-top">
        <Input className="font-mono text-xs" disabled={readOnly} {...register(`items.${index}.sku`)} />
      </td>
      <td className="px-2 py-2 align-top">
        <Input type="number" step="1" min={0} disabled={readOnly} {...register(`items.${index}.qty`)} />
      </td>
      <td className="px-2 py-2 align-top">
        <Input type="number" step="0.01" min={0} disabled={readOnly} {...register(`items.${index}.unit_price`)} />
      </td>
      <td className="px-2 py-2 align-top">
        <Input type="number" step="0.01" min={0} max={100} disabled={readOnly} {...register(`items.${index}.discount`)} />
      </td>
      <td className="px-2 py-2 align-top text-right tabular-nums font-medium">
        {Number.isFinite(Number(lineTotal)) ? Number(lineTotal).toFixed(2) : "0.00"}
      </td>
      <td className="px-2 py-2 align-top">
        {!readOnly && canRemove ? (
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-red-600" onClick={() => remove(index)}>
            刪
          </Button>
        ) : null}
      </td>
    </tr>
  );
}
