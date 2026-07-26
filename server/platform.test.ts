/**
 * اختبارات المنطق الأساسي: المستويات، حصرية المشرف، وحماية المسارات
 */
import { describe, expect, it } from "vitest";
import type { Account } from "../drizzle/schema";
import { ADMIN_EMAIL, computeLevel, doorsData, levelProgress, POINTS_PER_DOOR } from "../shared/doors";
import type { TrpcContext } from "./_core/context";
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken } from "./localAuth";
import { appRouter } from "./routers";

function makeCtx(account: Account | null): TrpcContext {
  return {
    user: null,
    account,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 1,
    name: "متدرب تجريبي",
    username: "testuser",
    email: null,
    passwordHash: "x",
    role: "user",
    points: 0,
    level: 1,
    createdAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

describe("بيانات الأبواب", () => {
  it("تحتوي على 16 باباً تدريبياً بمعرفات فريدة", () => {
    expect(doorsData).toHaveLength(16);
    const ids = new Set(doorsData.map(d => d.id));
    expect(ids.size).toBe(16);
  });

  it("كل باب يحتوي على اختبار بإجابة صحيحة ضمن الخيارات", () => {
    for (const door of doorsData) {
      expect(door.quiz.opts.length).toBeGreaterThanOrEqual(2);
      expect(door.quiz.ans).toBeGreaterThanOrEqual(0);
      expect(door.quiz.ans).toBeLessThan(door.quiz.opts.length);
    }
  });
});

describe("نظام المستويات", () => {
  it("يحسب المستويات حسب النقاط بشكل صحيح", () => {
    expect(computeLevel(0)).toBe(1);
    expect(computeLevel(49)).toBe(1);
    expect(computeLevel(50)).toBe(2);
    expect(computeLevel(149)).toBe(2);
    expect(computeLevel(150)).toBe(3);
    expect(computeLevel(299)).toBe(3);
    expect(computeLevel(300)).toBe(4);
    expect(computeLevel(500)).toBe(4);
  });

  it("إنجاز جميع الأبواب يوصل للمستوى الرابع تقريباً", () => {
    const maxPoints = doorsData.length * POINTS_PER_DOOR;
    expect(maxPoints).toBe(160);
    expect(computeLevel(maxPoints)).toBe(3);
  });

  it("يحسب نسبة التقدم للمستوى التالي", () => {
    expect(levelProgress(0).percent).toBe(0);
    expect(levelProgress(25).percent).toBe(50);
    expect(levelProgress(300).percent).toBe(100);
    expect(levelProgress(300).toNext).toBe(0);
  });
});

describe("تشفير كلمات المرور والجلسات", () => {
  it("يشفر كلمة المرور ويتحقق منها", async () => {
    const hash = await hashPassword("MySecret123");
    expect(hash).not.toBe("MySecret123");
    expect(await verifyPassword("MySecret123", hash)).toBe(true);
    expect(await verifyPassword("WrongPass", hash)).toBe(false);
  });

  it("ينشئ رمز جلسة صالحاً ويتحقق منه", async () => {
    const token = await createSessionToken(42);
    const accountId = await verifySessionToken(token);
    expect(accountId).toBe(42);
  });

  it("يرفض رمز جلسة تالفاً", async () => {
    expect(await verifySessionToken("invalid.token.here")).toBeNull();
  });
});

describe("حصرية حساب المشرف", () => {
  it("البريد الإداري المعتمد هو a-z_2@hotmail.com فقط", () => {
    expect(ADMIN_EMAIL).toBe("a-z_2@hotmail.com");
  });

  it("يرفض دخول المشرف لأي بريد آخر", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.account.adminLogin({ email: "someone@example.com", password: "whatever" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يمنع المستخدم العادي من الوصول لبيانات المشرف", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAccount({ role: "user" })));
    await expect(caller.admin.users()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.stats()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.plans()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يمنع الزائر غير المسجل من الوصول للتقدم", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.progress.summary()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("التحقق من مدخلات التسجيل", () => {
  it("يرفض اسم مستخدم قصيراً", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.account.register({ name: "أحمد", username: "ab", password: "123456" }),
    ).rejects.toThrow();
  });

  it("يرفض كلمة مرور قصيرة", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.account.register({ name: "أحمد", username: "ahmed123", password: "123" }),
    ).rejects.toThrow();
  });

  it("يرفض اسم مستخدم يحتوي على مسافات", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(
      caller.account.register({ name: "أحمد", username: "ah med", password: "123456" }),
    ).rejects.toThrow();
  });

  it("يرفض إكمال باب غير موجود", async () => {
    const caller = appRouter.createCaller(makeCtx(makeAccount()));
    await expect(caller.progress.completeDoor({ doorId: "door99" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
