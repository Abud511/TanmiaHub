/**
 * سكربت إعداد قاعدة البيانات — يُنشئ الجداول المطلوبة تلقائياً.
 * الاستخدام: node setup-db.mjs
 * يتطلب ضبط DATABASE_URL في ملف .env أولاً.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const sql = `
CREATE TABLE IF NOT EXISTS accounts (
  id INT AUTO_INCREMENT NOT NULL,
  name VARCHAR(191) NOT NULL,
  username VARCHAR(64) NOT NULL,
  email VARCHAR(320),
  passwordHash VARCHAR(191) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  points INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  createdAt TIMESTAMP NOT NULL DEFAULT (now()),
  lastSignedIn TIMESTAMP NOT NULL DEFAULT (now()),
  CONSTRAINT accounts_id PRIMARY KEY(id),
  CONSTRAINT accounts_username_unique UNIQUE(username)
);
CREATE TABLE IF NOT EXISTS completions (
  id INT AUTO_INCREMENT NOT NULL,
  accountId INT NOT NULL,
  doorId VARCHAR(32) NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT (now()),
  CONSTRAINT completions_id PRIMARY KEY(id)
);
CREATE TABLE IF NOT EXISTS favorites (
  id INT AUTO_INCREMENT NOT NULL,
  accountId INT NOT NULL,
  doorId VARCHAR(32) NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT (now()),
  CONSTRAINT favorites_id PRIMARY KEY(id)
);
CREATE TABLE IF NOT EXISTS plans (
  id INT AUTO_INCREMENT NOT NULL,
  accountId INT NOT NULL,
  doorId VARCHAR(32) NOT NULL,
  content TEXT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT (now()),
  updatedAt TIMESTAMP NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT plans_id PRIMARY KEY(id)
);
CREATE TABLE IF NOT EXISTS evidences (
  id INT AUTO_INCREMENT NOT NULL,
  accountId INT NOT NULL,
  doorId VARCHAR(32) NOT NULL,
  fileKey VARCHAR(512) NOT NULL,
  url TEXT NOT NULL,
  fileName VARCHAR(255) NOT NULL,
  mimeType VARCHAR(127) NOT NULL,
  fileSize INT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT (now()),
  CONSTRAINT evidences_id PRIMARY KEY(id)
);
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT NOT NULL,
  openId VARCHAR(64) NOT NULL,
  name TEXT,
  email VARCHAR(320),
  loginMethod VARCHAR(64),
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  createdAt TIMESTAMP NOT NULL DEFAULT (now()),
  updatedAt TIMESTAMP NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  lastSignedIn TIMESTAMP NOT NULL DEFAULT (now()),
  CONSTRAINT users_id PRIMARY KEY(id),
  CONSTRAINT users_openId_unique UNIQUE(openId)
);
`;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("خطأ: يجب ضبط DATABASE_URL في ملف .env أولاً");
    process.exit(1);
  }
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  for (const stmt of sql.split(";").map(s => s.trim()).filter(Boolean)) {
    await conn.query(stmt);
  }
  await conn.end();
  console.log("✔ تم إنشاء جداول قاعدة البيانات بنجاح");
  console.log("ملاحظة: حساب المشرف يُنشأ تلقائياً عند أول تشغيل للخادم");
}

main().catch(err => {
  console.error("فشل إعداد قاعدة البيانات:", err.message);
  process.exit(1);
});
