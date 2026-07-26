import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  accounts,
  completions,
  evidences,
  favorites,
  InsertAccount,
  plans,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== نظام الحسابات المحلي ====================

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

export async function createAccount(data: InsertAccount) {
  const db = await requireDb();
  const result = await db.insert(accounts).values(data);
  return result;
}

export async function getAccountByUsername(username: string) {
  const db = await requireDb();
  const rows = await db.select().from(accounts).where(eq(accounts.username, username)).limit(1);
  return rows[0];
}

export async function getAccountByEmail(email: string) {
  const db = await requireDb();
  const rows = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
  return rows[0];
}

export async function getAccountById(id: number) {
  const db = await requireDb();
  const rows = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  return rows[0];
}

export async function touchLastSignedIn(accountId: number) {
  const db = await requireDb();
  await db.update(accounts).set({ lastSignedIn: new Date() }).where(eq(accounts.id, accountId));
}

export async function updateAccountPoints(accountId: number, points: number, level: number) {
  const db = await requireDb();
  await db.update(accounts).set({ points, level }).where(eq(accounts.id, accountId));
}

// ==================== التقدم: الإنجازات والمفضلة والخطط ====================

export async function getCompletions(accountId: number) {
  const db = await requireDb();
  return db.select().from(completions).where(eq(completions.accountId, accountId));
}

export async function addCompletion(accountId: number, doorId: string) {
  const db = await requireDb();
  const existing = await db
    .select()
    .from(completions)
    .where(and(eq(completions.accountId, accountId), eq(completions.doorId, doorId)))
    .limit(1);
  if (existing.length > 0) return false;
  await db.insert(completions).values({ accountId, doorId });
  return true;
}

export async function getFavorites(accountId: number) {
  const db = await requireDb();
  return db.select().from(favorites).where(eq(favorites.accountId, accountId));
}

export async function toggleFavorite(accountId: number, doorId: string) {
  const db = await requireDb();
  const existing = await db
    .select()
    .from(favorites)
    .where(and(eq(favorites.accountId, accountId), eq(favorites.doorId, doorId)))
    .limit(1);
  if (existing.length > 0) {
    await db
      .delete(favorites)
      .where(and(eq(favorites.accountId, accountId), eq(favorites.doorId, doorId)));
    return { favorited: false };
  }
  await db.insert(favorites).values({ accountId, doorId });
  return { favorited: true };
}

export async function getPlans(accountId: number) {
  const db = await requireDb();
  return db.select().from(plans).where(eq(plans.accountId, accountId)).orderBy(desc(plans.createdAt));
}

export async function addPlan(accountId: number, doorId: string, content: string) {
  const db = await requireDb();
  await db.insert(plans).values({ accountId, doorId, content });
}

export async function updatePlan(planId: number, accountId: number, content: string) {
  const db = await requireDb();
  const existing = await db
    .select({ id: plans.id })
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.accountId, accountId)))
    .limit(1);
  if (existing.length === 0) return false;
  await db.update(plans).set({ content }).where(eq(plans.id, planId));
  return true;
}

export async function deletePlan(planId: number, accountId: number) {
  const db = await requireDb();
  const existing = await db
    .select({ id: plans.id })
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.accountId, accountId)))
    .limit(1);
  if (existing.length === 0) return false;
  await db.delete(plans).where(eq(plans.id, planId));
  return true;
}

export async function updateAccountPassword(accountId: number, passwordHash: string) {
  const db = await requireDb();
  await db.update(accounts).set({ passwordHash }).where(eq(accounts.id, accountId));
}

/** حذف حساب مستخدم مع جميع بياناته (إنجازات، مفضلة، خطط) */
export async function adminDeleteAccount(accountId: number) {
  const db = await requireDb();
  await db.delete(completions).where(eq(completions.accountId, accountId));
  await db.delete(favorites).where(eq(favorites.accountId, accountId));
  await db.delete(plans).where(eq(plans.accountId, accountId));
  await db.delete(evidences).where(eq(evidences.accountId, accountId));
  await db.delete(accounts).where(eq(accounts.id, accountId));
}

// ==================== الشواهد ====================

export async function addEvidence(data: {
  accountId: number;
  doorId: string;
  fileKey: string;
  url: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}) {
  const db = await requireDb();
  await db.insert(evidences).values(data);
}

export async function getEvidences(accountId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(evidences)
    .where(eq(evidences.accountId, accountId))
    .orderBy(desc(evidences.createdAt));
}

export async function getEvidenceById(evidenceId: number, accountId: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(evidences)
    .where(and(eq(evidences.id, evidenceId), eq(evidences.accountId, accountId)))
    .limit(1);
  return rows[0];
}

export async function deleteEvidence(evidenceId: number, accountId: number) {
  const db = await requireDb();
  const existing = await db
    .select({ id: evidences.id })
    .from(evidences)
    .where(and(eq(evidences.id, evidenceId), eq(evidences.accountId, accountId)))
    .limit(1);
  if (existing.length === 0) return false;
  await db.delete(evidences).where(eq(evidences.id, evidenceId));
  return true;
}

export async function countEvidencesForDoor(accountId: number, doorId: string) {
  const db = await requireDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(evidences)
    .where(and(eq(evidences.accountId, accountId), eq(evidences.doorId, doorId)));
  return Number(row?.count ?? 0);
}

export async function adminAllEvidences() {
  const db = await requireDb();
  return db
    .select({
      id: evidences.id,
      accountId: evidences.accountId,
      doorId: evidences.doorId,
      url: evidences.url,
      fileName: evidences.fileName,
      mimeType: evidences.mimeType,
      fileSize: evidences.fileSize,
      createdAt: evidences.createdAt,
      accountName: accounts.name,
      accountUsername: accounts.username,
    })
    .from(evidences)
    .innerJoin(accounts, eq(evidences.accountId, accounts.id))
    .orderBy(desc(evidences.createdAt));
}

/** تقرير شامل لمعلم واحد: البيانات + الإنجازات + الخطط + الشواهد */
export async function adminTeacherReport(accountId: number) {
  const db = await requireDb();
  const account = await getAccountById(accountId);
  if (!account || account.role !== "user") return null;
  const teacherCompletions = await db
    .select()
    .from(completions)
    .where(eq(completions.accountId, accountId))
    .orderBy(desc(completions.createdAt));
  const teacherPlans = await db
    .select()
    .from(plans)
    .where(eq(plans.accountId, accountId))
    .orderBy(desc(plans.createdAt));
  const teacherEvidences = await db
    .select()
    .from(evidences)
    .where(eq(evidences.accountId, accountId))
    .orderBy(desc(evidences.createdAt));
  return {
    account: {
      id: account.id,
      name: account.name,
      username: account.username,
      points: account.points,
      level: account.level,
      createdAt: account.createdAt,
      lastSignedIn: account.lastSignedIn,
    },
    completions: teacherCompletions,
    plans: teacherPlans,
    evidences: teacherEvidences,
  };
}

// ==================== استعلامات المشرف ====================

export async function adminListAccounts() {
  const db = await requireDb();
  return db
    .select({
      id: accounts.id,
      name: accounts.name,
      username: accounts.username,
      role: accounts.role,
      points: accounts.points,
      level: accounts.level,
      createdAt: accounts.createdAt,
      lastSignedIn: accounts.lastSignedIn,
    })
    .from(accounts)
    .where(eq(accounts.role, "user"))
    .orderBy(desc(accounts.points));
}

export async function adminAllCompletions() {
  const db = await requireDb();
  return db.select().from(completions);
}

export async function adminAllPlans() {
  const db = await requireDb();
  return db
    .select({
      id: plans.id,
      accountId: plans.accountId,
      doorId: plans.doorId,
      content: plans.content,
      createdAt: plans.createdAt,
      accountName: accounts.name,
      accountUsername: accounts.username,
    })
    .from(plans)
    .innerJoin(accounts, eq(plans.accountId, accounts.id))
    .orderBy(desc(plans.createdAt));
}

export async function adminStats() {
  const db = await requireDb();
  const [userCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(accounts)
    .where(eq(accounts.role, "user"));
  const [avgPoints] = await db
    .select({ avg: sql<number>`coalesce(avg(points), 0)` })
    .from(accounts)
    .where(eq(accounts.role, "user"));
  const [planCount] = await db.select({ count: sql<number>`count(*)` }).from(plans);
  const doorCompletions = await db
    .select({ doorId: completions.doorId, count: sql<number>`count(*)` })
    .from(completions)
    .groupBy(completions.doorId)
    .orderBy(desc(sql`count(*)`));
  const [completionCount] = await db.select({ count: sql<number>`count(*)` }).from(completions);
  return {
    totalUsers: Number(userCount?.count ?? 0),
    avgPoints: Math.round(Number(avgPoints?.avg ?? 0)),
    totalPlans: Number(planCount?.count ?? 0),
    totalCompletions: Number(completionCount?.count ?? 0),
    doorCompletions: doorCompletions.map(d => ({ doorId: d.doorId, count: Number(d.count) })),
  };
}
