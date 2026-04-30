import { join } from "path";

/** 與 DocumentClassificationManager / API 共用的個人網盤實體類型 */
export const PERSONAL_DRIVE_ENTITY_TYPE = "PERSONAL_DRIVE";

/** 上傳檔案寫入本機目錄後，file_url 使用此前綴 + storageKey（UUID） */
export const CRM_LOCAL_FILE_URL_PREFIX = "crm-local://";

export type PersonalSharePermission = "view" | "download";

export function isPersonalDriveOwner(
  entityType: string | null | undefined,
  entityId: string | null | undefined,
  userId: string
): boolean {
  return entityType === PERSONAL_DRIVE_ENTITY_TYPE && !!entityId && entityId === userId;
}

export function parseCrmLocalStorageKey(fileUrl: string): string | null {
  if (!fileUrl.startsWith(CRM_LOCAL_FILE_URL_PREFIX)) return null;
  const key = fileUrl.slice(CRM_LOCAL_FILE_URL_PREFIX.length).trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
    return null;
  }
  return key;
}

export function getSystemDocumentUploadDir(): string {
  return join(process.cwd(), ".uploads", "system-documents");
}

export function getLocalDocumentAbsolutePath(storageKey: string): string {
  return join(getSystemDocumentUploadDir(), storageKey);
}

export function isLegacyMockFileUrl(fileUrl: string): boolean {
  return (
    fileUrl.includes("mock-storage.example.com") || fileUrl.startsWith("https://mock-storage.")
  );
}
