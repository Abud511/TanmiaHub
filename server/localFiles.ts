import { promises as fs } from "fs";
import path from "path";

/**
 * تخزين ملفات محلي على قرص الخادم (مجلد uploads/ في جذر المشروع).
 * يُستخدم لرفع شواهد المعلمين — لا يعتمد على أي خدمة خارجية.
 */
const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

/** تنظيف المفتاح لمنع اختراق المسارات (path traversal) */
function sanitizeKey(relKey: string): string {
  const cleaned = relKey
    .replace(/\\/g, "/")
    .split("/")
    .filter(seg => seg && seg !== "." && seg !== "..")
    .join("/");
  if (!cleaned) throw new Error("مفتاح ملف غير صالح");
  return cleaned;
}

/** حفظ ملف على القرص المحلي وإرجاع المفتاح والرابط العام */
export async function filePut(
  relKey: string,
  data: Buffer,
): Promise<{ key: string; url: string }> {
  const key = sanitizeKey(relKey);
  const absPath = path.join(UPLOADS_ROOT, key);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, data);
  return { key, url: `/uploads/${key}` };
}

/** حذف ملف من القرص المحلي (يتجاهل الأخطاء إن لم يوجد) */
export async function fileDelete(relKey: string): Promise<void> {
  try {
    const key = sanitizeKey(relKey);
    await fs.unlink(path.join(UPLOADS_ROOT, key));
  } catch {
    // الملف غير موجود — لا شيء يلزم
  }
}

export { UPLOADS_ROOT };
