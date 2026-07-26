import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Legacy user table kept for schema compatibility (not used by the local auth system).
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** External identifier. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Local accounts for the platform (teachers/trainees + the single admin).
 * Authentication is done via username/password with bcrypt hashing.
 * The admin account is identified by email a-z_2@hotmail.com and role='admin'.
 */
export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  /** Display name of the user */
  name: varchar("name", { length: 191 }).notNull(),
  /** Unique username used for login */
  username: varchar("username", { length: 64 }).notNull().unique(),
  /** Optional email; required only for the admin account */
  email: varchar("email", { length: 320 }),
  /** bcrypt hash of the password */
  passwordHash: varchar("passwordHash", { length: 191 }).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  points: int("points").default(0).notNull(),
  level: int("level").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;

/** Completed doors (badges). One row per account per door. */
export const completions = mysqlTable("completions", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  doorId: varchar("doorId", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Completion = typeof completions.$inferSelect;

/** Favorite doors. One row per account per door. */
export const favorites = mysqlTable("favorites", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  doorId: varchar("doorId", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Favorite = typeof favorites.$inferSelect;

/** Application plans written by users for a given door. */
export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  doorId: varchar("doorId", { length: 32 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Plan = typeof plans.$inferSelect;

/** Evidence files uploaded by teachers for a given door. */
export const evidences = mysqlTable("evidences", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  doorId: varchar("doorId", { length: 32 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  url: text("url").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 127 }).notNull(),
  fileSize: int("fileSize").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Evidence = typeof evidences.$inferSelect;
export type InsertEvidence = typeof evidences.$inferInsert;
