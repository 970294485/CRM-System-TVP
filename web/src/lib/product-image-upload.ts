import { mkdir, writeFile } from "fs/promises";
import path from "path";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function safeBase(name: string): string {
  const base = path.basename(name || "image").replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(0, 120) || "image";
}

export async function saveProductImageFiles(files: File[], batchId: string): Promise<string[]> {
  const urls: string[] = [];
  const dir = path.join(process.cwd(), "public", "uploads", "products", batchId);
  await mkdir(dir, { recursive: true });

  for (const file of files) {
    if (!file || typeof file === "string") continue;
    if (!file.size) continue;
    if (file.size > MAX_BYTES) {
      throw new Error(`圖片超過 5MB：${file.name || "未命名"}`);
    }
    const type = file.type || "";
    if (type && !ALLOWED.has(type)) {
      throw new Error(`不支援的圖片類型：${type}`);
    }
    const base = safeBase(file.name);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, base), buf);
    urls.push(`/uploads/products/${batchId}/${base}`);
  }
  return urls;
}
