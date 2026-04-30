import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getNeonSql } from "@/db";
import { canEditSettings } from "@/lib/authz";
import { resolveProductIdForLine } from "@/lib/resolve-product-id";
import { evaluatePurchaseOrderImportAgainstBudget } from "@/lib/finance/expenditure-budget";
import {
  IMPORT_DOCUMENT_TYPES,
  inventoryImportRowSchema,
  purchaseOrderImportRowSchema,
  quotationImportRowSchema,
  validateRowsUniqueField,
  type RowValidationError,
} from "@/lib/validations/import-documents";

export const runtime = "nodejs";

const bodyShapeSchema = z.object({
  documentType: z.enum(IMPORT_DOCUMENT_TYPES),
  rows: z.array(z.record(z.string(), z.unknown())).min(1, "至少一筆資料"),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !canEditSettings(session)) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const shape = bodyShapeSchema.safeParse(body);
  if (!shape.success) {
    const msg = shape.error.issues.map((i) => i.message).join("；");
    return NextResponse.json({ error: msg || "驗證失敗" }, { status: 400 });
  }

  const { documentType, rows: rawRows } = shape.data;
  const rowErrors: RowValidationError[] = [];
  const sql = getNeonSql();

  try {
    switch (documentType) {
      case "QUOTATION": {
        const parsedRows: z.infer<typeof quotationImportRowSchema>[] = [];
        for (let i = 0; i < rawRows.length; i += 1) {
          const r = quotationImportRowSchema.safeParse(rawRows[i]);
          if (!r.success) {
            rowErrors.push({
              row: i + 1,
              message: r.error.issues.map((x) => x.message).join("；"),
            });
          } else {
            parsedRows.push(r.data);
          }
        }
        if (rowErrors.length) {
          return NextResponse.json({ ok: false, error: "部分列未通過驗證", errors: rowErrors }, { status: 400 });
        }
        const dup = validateRowsUniqueField(parsedRows, "quote_no", "報價單號");
        if (dup) {
          return NextResponse.json({ ok: false, error: "資料重複", errors: [dup] }, { status: 400 });
        }
        await sql.transaction((txn) =>
          parsedRows.map((q) =>
            txn.query(
              `INSERT INTO quotations (
                quote_no, customer_id, customer_name, customer_phone, customer_email,
                total_amount, items, status, quote_date
              ) VALUES (
                $1, $2::uuid, $3, $4, $5,
                $6::numeric, $7::jsonb, COALESCE($8, 'Legacy_Imported'), $9::date
              )`,
              [
                q.quote_no,
                q.customer_id ?? null,
                q.customer_name,
                q.customer_phone?.trim() ? q.customer_phone.trim() : null,
                q.customer_email?.trim() ? q.customer_email.trim() : null,
                q.total_amount,
                JSON.stringify(q.items),
                q.status ?? null,
                q.quote_date,
              ]
            )
          )
        );
        break;
      }
      case "PURCHASE_ORDER": {
        const parsedRows: z.infer<typeof purchaseOrderImportRowSchema>[] = [];
        for (let i = 0; i < rawRows.length; i += 1) {
          const r = purchaseOrderImportRowSchema.safeParse(rawRows[i]);
          if (!r.success) {
            rowErrors.push({
              row: i + 1,
              message: r.error.issues.map((x) => x.message).join("；"),
            });
          } else {
            parsedRows.push(r.data);
          }
        }
        if (rowErrors.length) {
          return NextResponse.json({ ok: false, error: "部分列未通過驗證", errors: rowErrors }, { status: 400 });
        }
        const dup = validateRowsUniqueField(parsedRows, "po_no", "採購單號");
        if (dup) {
          return NextResponse.json({ ok: false, error: "資料重複", errors: [dup] }, { status: 400 });
        }

        const budgetGate = await evaluatePurchaseOrderImportAgainstBudget(
          parsedRows.map((p) => ({ po_date: p.po_date, total_amount: p.total_amount })),
          session,
        );
        if (!budgetGate.ok) {
          return NextResponse.json(
            {
              ok: false,
              error: budgetGate.message,
              budgetViolations: budgetGate.violations,
            },
            { status: 422 },
          );
        }

        type LineResolved = {
          line: (typeof parsedRows)[number]["items"][number];
          productId: string | null;
        };
        const enriched = await Promise.all(
          parsedRows.map(async (p) => ({
            row: p,
            linesResolved: await Promise.all(
              p.items.map(async (line): Promise<LineResolved> => ({
                line,
                productId: await resolveProductIdForLine(sql, line),
              }))
            ),
          }))
        );

        await sql.transaction((txn) => {
          const ops = [];
          for (const { row: p, linesResolved } of enriched) {
            ops.push(
              txn.query(
                `INSERT INTO purchase_orders (
                  po_no, original_system_id, total_amount, items, po_date, status,
                  payment_status, paid_amount,
                  customer_id, customer_name, customer_phone, customer_email
                ) VALUES (
                  $1, $2, $3::numeric, $4::jsonb, $5::date,
                  COALESCE($6, 'Legacy_Imported'),
                  COALESCE($7, 'Unpaid'),
                  COALESCE($8::numeric, 0),
                  $9, $10, $11, $12
                )`,
                [
                  p.po_no,
                  p.original_system_id ?? null,
                  p.total_amount,
                  JSON.stringify(p.items),
                  p.po_date,
                  p.status ?? null,
                  p.payment_status ?? null,
                  p.paid_amount ?? null,
                  p.customer_id ?? null,
                  p.customer_name?.trim() ? p.customer_name.trim() : null,
                  p.customer_phone?.trim() ? p.customer_phone.trim() : null,
                  p.customer_email?.trim() ? p.customer_email.trim() : null,
                ]
              )
            );
            for (const { line, productId } of linesResolved) {
              if (!productId) continue;
              const wh = line.warehouse_location?.trim() ? line.warehouse_location.trim() : null;
              const qty = Math.max(0, Math.floor(Number(line.qty)));
              if (qty <= 0) continue;
              const sku = line.sku?.trim() || "—";
              const unitCost = Number.isFinite(line.price) ? line.price : null;

              ops.push(
                txn.query(
                  `INSERT INTO purchase_order_receipts (
                    purchase_order_id, product_id, sku, warehouse_location,
                    qty_received, unit_cost, line_name_snapshot
                  )
                  SELECT po.id, $2::uuid, $3, $4, $5::int, $6::numeric, $7
                  FROM purchase_orders po WHERE po.po_no = $1 LIMIT 1`,
                  [p.po_no, productId, sku, wh, qty, unitCost, line.name]
                )
              );
              ops.push(
                txn.query(
                  `UPDATE inventory SET
                    stock_qty = stock_qty + $1::int,
                    unit_cost = COALESCE($2::numeric, unit_cost),
                    last_counted_date = COALESCE($3::date, last_counted_date)
                  WHERE product_id = $4::uuid
                    AND (warehouse_location IS NOT DISTINCT FROM $5::varchar)`,
                  [qty, unitCost, p.po_date, productId, wh]
                )
              );
              ops.push(
                txn.query(
                  `INSERT INTO inventory (
                    product_id, sku, warehouse_location, stock_qty, unit_cost, last_counted_date
                  )
                  SELECT $1::uuid, $2, $3, $4::int, $5::numeric, $6::date
                  WHERE NOT EXISTS (
                    SELECT 1 FROM inventory i
                    WHERE i.product_id = $1::uuid
                      AND (i.warehouse_location IS NOT DISTINCT FROM $3::varchar)
                  )`,
                  [productId, sku, wh, qty, unitCost, p.po_date]
                )
              );
            }
          }
          return ops.length > 0 ? ops : [txn.query(`SELECT 1 AS noop`)];
        });

        break;
      }
      case "INVENTORY": {
        const parsedRows: z.infer<typeof inventoryImportRowSchema>[] = [];
        for (let i = 0; i < rawRows.length; i += 1) {
          const r = inventoryImportRowSchema.safeParse(rawRows[i]);
          if (!r.success) {
            rowErrors.push({
              row: i + 1,
              message: r.error.issues.map((x) => x.message).join("；"),
            });
          } else {
            parsedRows.push(r.data);
          }
        }
        if (rowErrors.length) {
          return NextResponse.json({ ok: false, error: "部分列未通過驗證", errors: rowErrors }, { status: 400 });
        }
        await sql.transaction((txn) =>
          parsedRows.map((inv) =>
            txn.query(
              `INSERT INTO inventory (
                product_id, sku, warehouse_location, stock_qty, unit_cost, last_counted_date
              ) VALUES ($1::uuid, $2, $3, $4::int, $5::numeric, $6::date)`,
              [
                inv.product_id,
                inv.sku,
                inv.warehouse_location ?? null,
                inv.stock_qty,
                inv.unit_cost ?? null,
                inv.last_counted_date ?? null,
              ]
            )
          )
        );
        break;
      }
    }

    return NextResponse.json({
      ok: true,
      documentType,
      inserted: rawRows.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      /quotations|purchase_orders|purchase_order_receipts|inventory|column|does not exist/i.test(msg)
        ? "請先建立資料表：npm run db:apply:documents-init（或執行 sql/quotations_po_inventory_init.sql）"
        : undefined;
    if (/unique|duplicate/i.test(msg)) {
      return NextResponse.json(
        { error: "違反唯一鍵（例如單號已存在），整批已回滾", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
        { status: 409 }
      );
    }
    if (/foreign key|violates foreign key/i.test(msg)) {
      return NextResponse.json(
        {
          error: "外鍵不存在（customer_id 或 product_id 無效），整批已回滾",
          detail: process.env.NODE_ENV !== "production" ? msg : undefined,
          hint,
        },
        { status: 400 }
      );
    }
    console.error("[POST /api/import-documents]", msg);
    return NextResponse.json(
      {
        error: "匯入失敗（交易已回滾）",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint,
      },
      { status: 500 }
    );
  }
}
