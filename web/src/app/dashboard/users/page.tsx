import { asc, eq } from "drizzle-orm";

import { saveUser } from "@/actions/admin";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { roles, userRoles, users } from "@/db/schema";
import { canManageUsers } from "@/lib/authz";

export default async function UsersPage() {
  const session = await auth();
  const canEdit = canManageUsers(session);

  const db = getDb();
  const allUsers = await db.select().from(users).orderBy(asc(users.email));
  const allRoles = await db.select().from(roles).orderBy(asc(roles.slug));

  const roleMap = await db
    .select({
      userId: userRoles.userId,
      roleId: userRoles.roleId,
      slug: roles.slug,
      name: roles.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id));

  const labels = new Map<string, { slug: string; name: string }[]>();
  for (const r of roleMap) {
    if (!labels.has(r.userId)) labels.set(r.userId, []);
    labels.get(r.userId)!.push({ slug: r.slug, name: r.name });
  }

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">用戶與角色</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">指派角色以控制後續模組存取。</p>

      <div className="crm-table-shell">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">姓名</th>
              <th className="px-3 py-2">角色</th>
              <th className="px-3 py-2">狀態</th>
              {canEdit ? <th className="px-3 py-2">操作</th> : null}
            </tr>
          </thead>
          <tbody>
            {allUsers.map((u) => (
              <tr key={u.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.name}</td>
                <td className="px-3 py-2">
                  {(labels.get(u.id) ?? []).map((x) => x.name).join("、") || "—"}
                </td>
                <td className="px-3 py-2">{u.isActive ? "啟用" : "停用"}</td>
                {canEdit ? (
                  <td className="px-3 py-2 align-top">
                    <details>
                      <summary className="cursor-pointer text-xs underline">調整角色</summary>
                      <form action={saveUser} className="mt-2 space-y-2 rounded bg-zinc-50 p-3 dark:bg-zinc-950">
                        <input type="hidden" name="mode" value="updateRoles" />
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="email" value={u.email} />
                        <input type="hidden" name="name" value={u.name} />
                        <div className="flex flex-col gap-1">
                          {allRoles.map((r) => (
                            <label key={r.id} className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                name="roleIds"
                                value={r.id}
                                defaultChecked={labels.get(u.id)?.some((x) => x.slug === r.slug)}
                              />
                              {r.name} ({r.slug})
                            </label>
                          ))}
                        </div>
                        <button type="submit" className="rounded bg-zinc-900 px-2 py-1 text-xs text-white">
                          更新角色
                        </button>
                      </form>
                    </details>
                    <form action={saveUser} className="mt-2">
                      <input type="hidden" name="mode" value="toggleActive" />
                      <input type="hidden" name="userId" value={u.id} />
                      <button type="submit" className="text-xs text-zinc-600 underline">
                        {u.isActive ? "停用帳號" : "啟用帳號"}
                      </button>
                    </form>
                    <form action={saveUser} className="mt-1">
                      <input type="hidden" name="mode" value="delete" />
                      <input type="hidden" name="userId" value={u.id} />
                      <button type="submit" className="text-xs text-red-600">
                        刪除
                      </button>
                    </form>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit ? (
        <form action={saveUser} className="mt-8 max-w-md space-y-3 rounded border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
          <p className="text-sm font-medium">新增用戶</p>
          <input type="hidden" name="mode" value="create" />
          <input name="email" type="email" required placeholder="Email" className="w-full rounded border px-2 py-1 text-sm" />
          <input name="name" required placeholder="姓名" className="w-full rounded border px-2 py-1 text-sm" />
          <input name="password" type="password" minLength={8} required placeholder="密碼（至少 8 字）" className="w-full rounded border px-2 py-1 text-sm" />
          <div className="flex flex-col gap-1 text-sm">
            {allRoles.map((r) => (
              <label key={r.id} className="flex items-center gap-2">
                <input type="checkbox" name="roleIds" value={r.id} />
                {r.name}
              </label>
            ))}
          </div>
          <button type="submit" className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white">
            建立
          </button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-zinc-500">僅超級管理員或管理員可管理帳號。</p>
      )}
    </div>
  );
}
