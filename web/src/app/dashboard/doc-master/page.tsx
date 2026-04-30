import Link from "next/link";
import { asc } from "drizzle-orm";

import { auth } from "@/auth";
import { PtCurrencyPanel, type PtCurrencyDTO } from "@/components/pt-data-master/pt-currency-panel";
import { PtLookupPanel, type PtLookupDTO } from "@/components/pt-data-master/pt-lookup-panel";
import { PtNumberingPanel, type NumberSequenceDTO } from "@/components/pt-data-master/pt-numbering-panel";
import { getDb } from "@/db";
import {
  numberSequences,
  ptCurrencies,
  ptMasterLookupEntries,
} from "@/db/schema";
import {
  PT_PAYMENT_TERMS_SLUG,
  PT_SHIPPING_METHODS_SLUG,
} from "@/lib/pt-master-kinds";
import { canEditSettings } from "@/lib/authz";

const VALID_TABS = ["numbering", "dictionary", "currency"] as const;
type DocTab = (typeof VALID_TABS)[number];

function parseTab(tab: string | undefined): DocTab {
  if (tab && VALID_TABS.includes(tab as DocTab)) return tab as DocTab;
  return "numbering";
}

export default async function DocMasterPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const searchParams = await props.searchParams;
  const tab = parseTab(searchParams.tab);
  const session = await auth();
  const editable = canEditSettings(session);
  const db = getDb();

  const seqRows = await db.select().from(numberSequences).orderBy(asc(numberSequences.entityType));
  const sequenceDtos: NumberSequenceDTO[] = seqRows.map((r) => ({
    id: r.id,
    entityType: r.entityType,
    prefix: r.prefix,
    suffix: r.suffix,
    padLength: r.padLength,
    nextNumber: r.nextNumber,
    resetPolicy: r.resetPolicy,
    dateSegment: r.dateSegment,
  }));

  const lookupRows = await db
    .select()
    .from(ptMasterLookupEntries)
    .orderBy(
      asc(ptMasterLookupEntries.dictionaryKindSlug),
      asc(ptMasterLookupEntries.sortOrder),
      asc(ptMasterLookupEntries.label),
    );
  const byKind: Record<string, PtLookupDTO[]> = {};
  for (const r of lookupRows) {
    const dto: PtLookupDTO = {
      id: r.id,
      dictionaryKindSlug: r.dictionaryKindSlug,
      label: r.label,
      sortOrder: r.sortOrder,
      isActive: r.isActive,
    };
    if (!byKind[r.dictionaryKindSlug]) byKind[r.dictionaryKindSlug] = [];
    byKind[r.dictionaryKindSlug].push(dto);
  }
  const lookupSlugs = [PT_PAYMENT_TERMS_SLUG, PT_SHIPPING_METHODS_SLUG] as const;

  const currRows = await db.select().from(ptCurrencies).orderBy(asc(ptCurrencies.sortOrder), asc(ptCurrencies.isoCode));
  const currDtos: PtCurrencyDTO[] = currRows.map((r) => ({
    id: r.id,
    isoCode: r.isoCode,
    label: r.label,
    quoteTwdPerUnit: r.quoteTwdPerUnit == null ? null : String(r.quoteTwdPerUnit),
    sortOrder: r.sortOrder,
    isActive: r.isActive,
  }));

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">文件編號及基礎資料管理</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        集中維護單據取號規則、全系統共用下拉項目與幣別匯率快照。
        {!editable ? " 您目前為唯讀權限。" : null}
      </p>

      <nav className="mb-8 flex flex-wrap gap-2 border-b border-zinc-200 pb-px dark:border-zinc-800" aria-label="文件主檔分頁">
        {([
          ["numbering", "文件編號"],
          ["dictionary", "基礎選項池"],
          ["currency", "幣別與匯率"],
        ] as const).map(([id, zh]) => {
          const active = tab === id;
          return (
            <Link
              key={id}
              href={`/dashboard/doc-master?tab=${id}`}
              className={`inline-flex rounded-md px-3 py-2 text-sm font-medium ${
                active
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
              scroll={false}
            >
              {zh}
            </Link>
          );
        })}
      </nav>

      {tab === "numbering" ? <PtNumberingPanel rows={sequenceDtos} editable={editable} /> : null}
      {tab === "dictionary" ? <PtLookupPanel byKind={byKind} kindSlugs={lookupSlugs} editable={editable} /> : null}
      {tab === "currency" ? <PtCurrencyPanel rows={currDtos} editable={editable} /> : null}
    </div>
  );
}
