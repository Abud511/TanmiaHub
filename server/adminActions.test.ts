/**
 * اختبارات ميزات الإدارة الجديدة: حذف الحساب، إعادة تعيين كلمة المرور،
 * وتعديل/حذف الخطط التطبيقية.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { hashPassword, verifyPassword } from "./localAuth";

function createCtx(account: NonNullable<TrpcContext["account"]>): TrpcContext {
  return {
    user: null,
    account,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: () => undefined,
      clearCookie: () => undefined,
    } as unknown as TrpcContext["res"],
  };
}

const ts = Date.now();
let userAccount: Awaited<ReturnType<typeof db.getAccountByUsername>>;
let adminAccount: Awaited<ReturnType<typeof db.getAccountByUsername>>;

beforeAll(async () => {
  // إنشاء مستخدم تجريبي ومشرف تجريبي مباشرة في قاعدة البيانات
  await db.createAccount({
    name: "مستخدم اختبار",
    username: `qa_user_${ts}`,
    passwordHash: await hashPassword("1234"),
    role: "user",
  });
  userAccount = await db.getAccountByUsername(`qa_user_${ts}`);

  await db.createAccount({
    name: "مشرف اختبار",
    username: `qa_admin_${ts}`,
    passwordHash: await hashPassword("1234"),
    role: "admin",
  });
  adminAccount = await db.getAccountByUsername(`qa_admin_${ts}`);
});

describe("تعديل وحذف الخطط التطبيقية", () => {
  it("يتيح للمستخدم تعديل خطته وحذفها، ويمنع العبث بخطط الآخرين", async () => {
    const caller = appRouter.createCaller(createCtx(userAccount!));
    await caller.progress.savePlan({ doorId: "door1", content: "خطة أولى للاختبار" });
    const summary = await caller.progress.summary();
    const plan = summary.plans.find(p => p.content === "خطة أولى للاختبار");
    expect(plan).toBeDefined();

    // تعديل الخطة
    await caller.progress.updatePlan({ planId: plan!.id, content: "خطة معدلة للاختبار" });
    const afterUpdate = await caller.progress.summary();
    expect(afterUpdate.plans.find(p => p.id === plan!.id)?.content).toBe("خطة معدلة للاختبار");

    // مستخدم آخر لا يستطيع حذفها
    const otherCaller = appRouter.createCaller(createCtx(adminAccount!));
    await expect(otherCaller.progress.deletePlan({ planId: plan!.id })).rejects.toThrow();

    // صاحبها يحذفها بنجاح
    const del = await caller.progress.deletePlan({ planId: plan!.id });
    expect(del.success).toBe(true);
    const afterDelete = await caller.progress.summary();
    expect(afterDelete.plans.find(p => p.id === plan!.id)).toBeUndefined();
  });
});

describe("صلاحيات المشرف: إعادة تعيين كلمة المرور وحذف الحساب", () => {
  it("يعيد المشرف تعيين كلمة مرور مستخدم", async () => {
    const adminCaller = appRouter.createCaller(createCtx(adminAccount!));
    const res = await adminCaller.admin.resetUserPassword({
      accountId: userAccount!.id,
      newPassword: "9999",
    });
    expect(res.success).toBe(true);
    const updated = await db.getAccountById(userAccount!.id);
    expect(await verifyPassword("9999", updated!.passwordHash)).toBe(true);

    // تسجيل دخول فعلي بكلمة المرور الجديدة عبر إجراء login
    const publicCaller = appRouter.createCaller({
      user: null,
      account: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        cookie: () => undefined,
        clearCookie: () => undefined,
      } as unknown as TrpcContext["res"],
    });
    const loginRes = await publicCaller.account.login({
      username: `qa_user_${ts}`,
      password: "9999",
    });
    expect(loginRes.username).toBe(`qa_user_${ts}`);
    expect(loginRes.sessionToken).toBeTruthy();

    // الدخول بكلمة المرور القديمة يجب أن يفشل
    await expect(
      publicCaller.account.login({ username: `qa_user_${ts}`, password: "1234" }),
    ).rejects.toThrow();
  });

  it("يمنع غير المشرف من استخدام إجراءات الإدارة", async () => {
    const userCaller = appRouter.createCaller(createCtx(userAccount!));
    await expect(
      userCaller.admin.resetUserPassword({ accountId: adminAccount!.id, newPassword: "0000" }),
    ).rejects.toThrow();
    await expect(userCaller.admin.deleteUser({ accountId: adminAccount!.id })).rejects.toThrow();
  });

  it("يمنع حذف حساب إداري ويحذف حساب المستخدم مع بياناته", async () => {
    const adminCaller = appRouter.createCaller(createCtx(adminAccount!));

    // لا يمكن حذف حساب إداري
    await expect(adminCaller.admin.deleteUser({ accountId: adminAccount!.id })).rejects.toThrow();

    // إنشاء بيانات مرتبطة للمستخدم قبل الحذف (خطة + مفضلة + إنجاز)
    const userCaller = appRouter.createCaller(createCtx(userAccount!));
    await userCaller.progress.savePlan({ doorId: "door2", content: "خطة قبل الحذف" });
    const beforeDelete = await userCaller.progress.summary();
    expect(beforeDelete.plans.length).toBeGreaterThan(0);

    // حذف المستخدم التجريبي مع بياناته
    const res = await adminCaller.admin.deleteUser({ accountId: userAccount!.id });
    expect(res.success).toBe(true);
    expect(await db.getAccountById(userAccount!.id)).toBeUndefined();

    // التحقق من زوال البيانات المرتبطة (الخطط) من قاعدة البيانات
    const remainingPlans = await db.getPlans(userAccount!.id);
    expect(remainingPlans.length).toBe(0);
  });
});

describe("تغيير كلمة المرور الذاتي", () => {
  it("يغير المستخدم كلمة مروره بعد التحقق من الحالية", async () => {
    const caller = appRouter.createCaller(createCtx(adminAccount!));
    await expect(
      caller.progress.changePassword({ currentPassword: "wrong", newPassword: "5678" }),
    ).rejects.toThrow();
    const res = await caller.progress.changePassword({
      currentPassword: "1234",
      newPassword: "5678",
    });
    expect(res.success).toBe(true);
    const updated = await db.getAccountById(adminAccount!.id);
    expect(await verifyPassword("5678", updated!.passwordHash)).toBe(true);
    // تنظيف: حذف المشرف التجريبي مباشرة من قاعدة البيانات
    await db.adminDeleteAccount(adminAccount!.id);
  });
});
