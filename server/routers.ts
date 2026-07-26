import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ADMIN_EMAIL, computeLevel, doorsData, POINTS_PER_DOOR } from "../shared/doors";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { accountProcedure, localAdminProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import {
  clearSessionCookie,
  createSessionToken,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from "./localAuth";
import { fileDelete, filePut } from "./localFiles";

/** أنواع ملفات الشواهد المسموح بها (صور + PDF + Word) */
const ALLOWED_EVIDENCE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

/** الحد الأقصى لحجم الشاهد: 10MB */
const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024;
/** الحد الأقصى لعدد الشواهد لكل باب */
const MAX_EVIDENCES_PER_DOOR = 10;

const usernameSchema = z
  .string()
  .trim()
  .min(3, "اسم المستخدم يجب أن يكون 3 أحرف على الأقل")
  .max(64)
  .regex(/^[^\s]+$/, "اسم المستخدم يجب ألا يحتوي على مسافات");

const passwordSchema = z.string().min(4, "كلمة المرور يجب أن تكون 4 أحرف على الأقل").max(128);

function sanitizeAccount(account: {
  id: number;
  name: string;
  username: string;
  role: "user" | "admin";
  points: number;
  level: number;
}) {
  return {
    id: account.id,
    name: account.name,
    username: account.username,
    role: account.role,
    points: account.points,
    level: account.level,
  };
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ==================== المصادقة المحلية ====================
  account: router({
    /** الحساب الحالي من الجلسة */
    me: publicProcedure.query(({ ctx }) => (ctx.account ? sanitizeAccount(ctx.account) : null)),

    /** إنشاء حساب متدرب جديد */
    register: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(2, "الاسم يجب أن يكون حرفين على الأقل").max(191),
          username: usernameSchema,
          password: passwordSchema,
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const username = input.username.toLowerCase();
        const existing = await db.getAccountByUsername(username);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "اسم المستخدم مستخدم من قبل، اختر اسماً آخر",
          });
        }
        const passwordHash = await hashPassword(input.password);
        await db.createAccount({
          name: input.name,
          username,
          passwordHash,
          role: "user",
        });
        const account = await db.getAccountByUsername(username);
        if (!account) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إنشاء الحساب" });
        }
        const token = await createSessionToken(account.id);
        setSessionCookie(ctx.req, ctx.res, token);
        return { ...sanitizeAccount(account), sessionToken: token };
      }),

    /** تسجيل دخول المتدرب باسم المستخدم */
    login: publicProcedure
      .input(z.object({ username: z.string().trim().min(1), password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const account = await db.getAccountByUsername(input.username.toLowerCase());
        if (!account || !(await verifyPassword(input.password, account.passwordHash))) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "اسم المستخدم أو كلمة المرور غير صحيحة",
          });
        }
        await db.touchLastSignedIn(account.id);
        const token = await createSessionToken(account.id);
        setSessionCookie(ctx.req, ctx.res, token);
        return { ...sanitizeAccount(account), sessionToken: token };
      }),

    /** تسجيل دخول المشرف بالإيميل المعتمد حصرياً */
    adminLogin: publicProcedure
      .input(z.object({ email: z.string().trim().min(1), password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const email = input.email.toLowerCase();
        if (email !== ADMIN_EMAIL.toLowerCase()) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "هذا البريد الإلكتروني غير مصرح له بالدخول الإداري",
          });
        }
        const account = await db.getAccountByEmail(ADMIN_EMAIL);
        if (!account || account.role !== "admin") {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "حساب المشرف غير مهيأ بعد",
          });
        }
        if (!(await verifyPassword(input.password, account.passwordHash))) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "كلمة المرور غير صحيحة",
          });
        }
        await db.touchLastSignedIn(account.id);
        const token = await createSessionToken(account.id);
        setSessionCookie(ctx.req, ctx.res, token);
        return { ...sanitizeAccount(account), sessionToken: token };
      }),

    /** تسجيل الخروج */
    logout: publicProcedure.mutation(({ ctx }) => {
      clearSessionCookie(ctx.req, ctx.res);
      return { success: true } as const;
    }),
  }),

  // ==================== تقدم المتدرب ====================
  progress: router({
    /** ملخص تقدم المستخدم الحالي: الإنجازات والمفضلة والخطط */
    summary: accountProcedure.query(async ({ ctx }) => {
      const [comps, favs, userPlans] = await Promise.all([
        db.getCompletions(ctx.account.id),
        db.getFavorites(ctx.account.id),
        db.getPlans(ctx.account.id),
      ]);
      return {
        points: ctx.account.points,
        level: ctx.account.level,
        badges: comps.map(c => c.doorId),
        favorites: favs.map(f => f.doorId),
        plans: userPlans.map(p => ({
          id: p.id,
          doorId: p.doorId,
          content: p.content,
          createdAt: p.createdAt,
        })),
      };
    }),

    /** إكمال باب والحصول على النقاط والشارة */
    completeDoor: accountProcedure
      .input(z.object({ doorId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const door = doorsData.find(d => d.id === input.doorId);
        if (!door) throw new TRPCError({ code: "NOT_FOUND", message: "الباب غير موجود" });
        const added = await db.addCompletion(ctx.account.id, input.doorId);
        if (!added) {
          return { alreadyCompleted: true, points: ctx.account.points, level: ctx.account.level };
        }
        const newPoints = ctx.account.points + POINTS_PER_DOOR;
        const newLevel = computeLevel(newPoints);
        await db.updateAccountPoints(ctx.account.id, newPoints, newLevel);
        return { alreadyCompleted: false, points: newPoints, level: newLevel };
      }),

    /** تبديل حالة المفضلة لباب */
    toggleFavorite: accountProcedure
      .input(z.object({ doorId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const door = doorsData.find(d => d.id === input.doorId);
        if (!door) throw new TRPCError({ code: "NOT_FOUND", message: "الباب غير موجود" });
        return db.toggleFavorite(ctx.account.id, input.doorId);
      }),

    /** حفظ خطة تطبيقية */
    savePlan: accountProcedure
      .input(
        z.object({
          doorId: z.string(),
          content: z.string().trim().min(5, "اكتب خطة لا تقل عن 5 أحرف").max(5000),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const door = doorsData.find(d => d.id === input.doorId);
        if (!door) throw new TRPCError({ code: "NOT_FOUND", message: "الباب غير موجود" });
        await db.addPlan(ctx.account.id, input.doorId, input.content);
        return { success: true } as const;
      }),

    /** تعديل خطة تطبيقية موجودة (لصاحبها فقط) */
    updatePlan: accountProcedure
      .input(
        z.object({
          planId: z.number(),
          content: z.string().trim().min(5, "اكتب خطة لا تقل عن 5 أحرف").max(5000),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const ok = await db.updatePlan(input.planId, ctx.account.id, input.content);
        if (!ok) throw new TRPCError({ code: "NOT_FOUND", message: "الخطة غير موجودة" });
        return { success: true } as const;
      }),

    /** حذف خطة تطبيقية (لصاحبها فقط) */
    deletePlan: accountProcedure
      .input(z.object({ planId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const ok = await db.deletePlan(input.planId, ctx.account.id);
        if (!ok) throw new TRPCError({ code: "NOT_FOUND", message: "الخطة غير موجودة" });
        return { success: true } as const;
      }),

    /** تغيير كلمة المرور للحساب الحالي (متدرب أو مشرف) */
    changePassword: accountProcedure
      .input(
        z.object({
          currentPassword: z.string().min(1, "أدخل كلمة المرور الحالية"),
          newPassword: passwordSchema,
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const account = await db.getAccountById(ctx.account.id);
        if (!account || !(await verifyPassword(input.currentPassword, account.passwordHash))) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "كلمة المرور الحالية غير صحيحة" });
        }
        const passwordHash = await hashPassword(input.newPassword);
        await db.updateAccountPassword(ctx.account.id, passwordHash);
        return { success: true } as const;
      }),

    /** رفع شاهد (ملف أو صورة) لباب معين */
    uploadEvidence: accountProcedure
      .input(
        z.object({
          doorId: z.string(),
          fileName: z.string().trim().min(1).max(200),
          mimeType: z.string(),
          /** محتوى الملف base64 */
          data: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const door = doorsData.find(d => d.id === input.doorId);
        if (!door) throw new TRPCError({ code: "NOT_FOUND", message: "الباب غير موجود" });

        const ext = ALLOWED_EVIDENCE_TYPES[input.mimeType];
        if (!ext) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "نوع الملف غير مسموح. المسموح: صور (JPG, PNG, WebP, GIF) أو PDF أو Word",
          });
        }

        const buffer = Buffer.from(input.data, "base64");
        if (buffer.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "الملف فارغ" });
        }
        if (buffer.length > MAX_EVIDENCE_SIZE) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "حجم الملف يتجاوز الحد الأقصى (10 ميجابايت)",
          });
        }

        const existingCount = await db.countEvidencesForDoor(ctx.account.id, input.doorId);
        if (existingCount >= MAX_EVIDENCES_PER_DOOR) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "وصلت للحد الأقصى من الشواهد لهذا الباب (10 شواهد)",
          });
        }

        // اسم آمن للتخزين لا يعتمد على اسم الملف الأصلي
        const safeKey = `evidences/acc${ctx.account.id}/${input.doorId}/evidence-${Date.now()}.${ext}`;
        const { key, url } = await filePut(safeKey, buffer);

        await db.addEvidence({
          accountId: ctx.account.id,
          doorId: input.doorId,
          fileKey: key,
          url,
          fileName: input.fileName,
          mimeType: input.mimeType,
          fileSize: buffer.length,
        });
        return { success: true, url } as const;
      }),

    /** شواهد المستخدم الحالي */
    myEvidences: accountProcedure.query(async ({ ctx }) => {
      const rows = await db.getEvidences(ctx.account.id);
      return rows.map(e => ({
        id: e.id,
        doorId: e.doorId,
        url: e.url,
        fileName: e.fileName,
        mimeType: e.mimeType,
        fileSize: e.fileSize,
        createdAt: e.createdAt,
      }));
    }),

    /** حذف شاهد (لصاحبه فقط) مع حذف الملف من القرص */
    deleteEvidence: accountProcedure
      .input(z.object({ evidenceId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getEvidenceById(input.evidenceId, ctx.account.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "الشاهد غير موجود" });
        const ok = await db.deleteEvidence(input.evidenceId, ctx.account.id);
        if (!ok) throw new TRPCError({ code: "NOT_FOUND", message: "الشاهد غير موجود" });
        await fileDelete(existing.fileKey);
        return { success: true } as const;
      }),
  }),

  // ==================== لوحة المشرف ====================
  admin: router({
    /** قائمة المستخدمين مع نقاطهم ومستوياتهم */
    users: localAdminProcedure.query(async () => {
      const [accountsList, allCompletions] = await Promise.all([
        db.adminListAccounts(),
        db.adminAllCompletions(),
      ]);
      const completionsByAccount = new Map<number, string[]>();
      for (const c of allCompletions) {
        const list = completionsByAccount.get(c.accountId) ?? [];
        list.push(c.doorId);
        completionsByAccount.set(c.accountId, list);
      }
      return accountsList.map(a => ({
        ...a,
        badges: completionsByAccount.get(a.id) ?? [],
      }));
    }),

    /** جميع الخطط التطبيقية المكتوبة */
    plans: localAdminProcedure.query(() => db.adminAllPlans()),

    /** الإحصائيات العامة للداشبورد */
    stats: localAdminProcedure.query(() => db.adminStats()),

    /** حذف حساب مستخدم وجميع بياناته (لا يمكن حذف حساب المشرف) */
    deleteUser: localAdminProcedure
      .input(z.object({ accountId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (input.accountId === ctx.account.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكنك حذف حسابك الإداري" });
        }
        const target = await db.getAccountById(input.accountId);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "الحساب غير موجود" });
        if (target.role === "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن حذف حساب إداري" });
        }
        await db.adminDeleteAccount(input.accountId);
        return { success: true } as const;
      }),

    /** إعادة تعيين كلمة مرور مستخدم عند فقدان بياناته */
    resetUserPassword: localAdminProcedure
      .input(z.object({ accountId: z.number(), newPassword: passwordSchema }))
      .mutation(async ({ input }) => {
        const target = await db.getAccountById(input.accountId);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "الحساب غير موجود" });
        const passwordHash = await hashPassword(input.newPassword);
        await db.updateAccountPassword(input.accountId, passwordHash);
        return { success: true } as const;
      }),

    /** جميع الشواهد المرفوعة من المستخدمين */
    evidences: localAdminProcedure.query(() => db.adminAllEvidences()),

    /** تقرير شامل لمعلم واحد: البيانات + الإنجازات + الخطط + الشواهد */
    teacherReport: localAdminProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ input }) => {
        const report = await db.adminTeacherReport(input.accountId);
        if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "المعلم غير موجود" });
        return report;
      }),
  }),
});

export type AppRouter = typeof appRouter;
