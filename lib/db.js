import { neon } from "@neondatabase/serverless";
import { httpErr } from "./http.js";

let runner = null;
export function setRunner(fn) { runner = fn; } // ใช้ตอนทดสอบในเครื่อง

function getRunner() {
  if (runner) return runner;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw httpErr(503, "ระบบยังไม่ได้เชื่อมฐานข้อมูล");
  const sql = neon(url);
  runner = (text, params) => sql.query(text, params);
  return runner;
}

export const q = (text, params = []) => getRunner()(text, params);
export const one = async (text, params) => (await q(text, params))[0] || null;

const SCHEMA = [
  `create table if not exists admins (
     id serial primary key, username text unique not null, name text not null,
     pass text not null, created_at timestamptz not null default now())`,
  `create table if not exists settings (key text primary key, value text not null)`,
  `create table if not exists courses (
     id serial primary key, code text not null default '', title text not null,
     description text not null default '', archived boolean not null default false,
     created_at timestamptz not null default now())`,
  `create table if not exists chapters (
     id serial primary key, course_id int not null references courses(id) on delete cascade,
     position int not null default 1, title text not null, description text not null default '',
     video_url text not null, due_at timestamptz, require_prev boolean not null default true,
     audience text not null default 'all', created_at timestamptz not null default now())`,
  `create table if not exists students (
     id serial primary key, code text unique not null, name text not null, pass text not null,
     must_change boolean not null default true, consent_at timestamptz, last_login timestamptz,
     created_at timestamptz not null default now())`,
  `create table if not exists enrollments (
     course_id int not null references courses(id) on delete cascade,
     student_id int not null references students(id) on delete cascade,
     created_at timestamptz not null default now(), primary key (course_id, student_id))`,
  `create table if not exists chapter_assign (
     chapter_id int not null references chapters(id) on delete cascade,
     student_id int not null references students(id) on delete cascade,
     primary key (chapter_id, student_id))`,
  `create table if not exists progress (
     student_id int not null references students(id) on delete cascade,
     chapter_id int not null references chapters(id) on delete cascade,
     max_pos real not null default 0, watched real not null default 0, duration real not null default 0,
     away int not null default 0, started_at timestamptz not null default now(),
     updated_at timestamptz not null default now(), completed_at timestamptz,
     primary key (student_id, chapter_id))`,
  `create table if not exists snapshots (
     id serial primary key, student_id int not null references students(id) on delete cascade,
     chapter_id int not null references chapters(id) on delete cascade,
     kind text not null default 'interval', faces int not null default 1, image text not null,
     taken_at timestamptz not null default now())`,
  `create index if not exists snapshots_sc on snapshots (student_id, chapter_id, taken_at)`,
  `create index if not exists chapters_course on chapters (course_id, position)`,
];

let ready = null;
export function migrate() {
  if (!ready) ready = (async () => { for (const s of SCHEMA) await q(s); })().catch(e => { ready = null; throw e; });
  return ready;
}

export const DEFAULT_SETTINGS = {
  siteName: "ห้องเรียนออนไลน์",
  institution: "",
  passPct: "90",
  snapshotMinutes: "5",
  driveApiKey: "",
};

export async function getSettings() {
  const rows = await q("select key, value from settings");
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  return {
    siteName: s.siteName, institution: s.institution, driveApiKey: s.driveApiKey,
    passPct: Math.min(100, Math.max(10, Number(s.passPct) || 90)),
    snapshotMinutes: Math.min(60, Math.max(1, Number(s.snapshotMinutes) || 5)),
  };
}
