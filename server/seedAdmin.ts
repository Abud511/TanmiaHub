/**
 * تهيئة حساب المشرف المعتمد الوحيد تلقائياً عند إقلاع الخادم.
 * البريد الإداري: a-z_2@hotmail.com
 * كلمة المرور الافتراضية تُقرأ من ADMIN_DEFAULT_PASSWORD أو تكون "Admin@2026"
 * ويُنصح بتغييرها بعد أول دخول عبر تحديث قاعدة البيانات.
 */
import { ADMIN_EMAIL } from "../shared/doors";
import { createAccount, getAccountByEmail } from "./db";
import { hashPassword } from "./localAuth";

export const ADMIN_USERNAME = "admin";

export async function seedAdminAccount() {
  try {
    const existing = await getAccountByEmail(ADMIN_EMAIL);
    if (existing) return;
    const password = process.env.ADMIN_DEFAULT_PASSWORD || "Admin@2026";
    const passwordHash = await hashPassword(password);
    await createAccount({
      name: "المشرف العام",
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: "admin",
    });
    console.log("[Seed] Admin account created for", ADMIN_EMAIL);
  } catch (error) {
    console.error("[Seed] Failed to seed admin account:", error);
  }
}
