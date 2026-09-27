import crypto from "node:crypto";
import { httpErr } from "./http.js";

const DAYS = 14;

function secret() {
  const s = process.env.SESSION_SECRET || process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!s) throw httpErr(503, "ระบบยังไม่ได้ตั้งค่า");
  return s;
}

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(pw), salt, 32).toString("hex");
  return `${salt}:${hash}`;
}
export function checkPassword(pw, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(String(pw), salt, 32);
  const real = Buffer.from(hash, "hex");
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}

const sign = body => crypto.createHmac("sha256", secret()).update(body).digest("base64url");

function makeToken(role, id) {
  const body = Buffer.from(JSON.stringify({ r: role, id, exp: Date.now() + DAYS * 864e5 })).toString("base64url");
  return `${body}.${sign(body)}`;
}
function readToken(t) {
  if (!t) return null;
  const [body, sig] = String(t).split(".");
  if (!body || !sig) return null;
  const good = sign(body);
  if (good.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return null;
  try {
    const d = JSON.parse(Buffer.from(body, "base64url").toString());
    return d.exp > Date.now() ? d : null;
  } catch { return null; }
}

const COOKIE = { a: "lr_admin", s: "lr_student" };

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function addCookie(res, value) {
  const prev = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", [...(Array.isArray(prev) ? prev : prev ? [prev] : []), value]);
}

export function setSession(res, role, id) {
  addCookie(res, `${COOKIE[role]}=${makeToken(role, id)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}`);
}
export function clearSession(res, role) {
  addCookie(res, `${COOKIE[role]}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}
export function sessions(req) {
  const c = cookies(req);
  const a = readToken(c[COOKIE.a]);
  const s = readToken(c[COOKIE.s]);
  return { adminId: a && a.r === "a" ? a.id : null, studentId: s && s.r === "s" ? s.id : null };
}
