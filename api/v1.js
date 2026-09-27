import { migrate } from "../lib/db.js";
import { sessions } from "../lib/auth.js";
import { studentRoutes } from "../lib/student.js";
import { adminRoutes } from "../lib/admin.js";

const routes = { ...studentRoutes, ...adminRoutes };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    let body = req.body;
    if (typeof body === "string") body = body ? JSON.parse(body) : {};
    if (Buffer.isBuffer(body)) body = JSON.parse(body.toString("utf8") || "{}");
    body = body || {};
    const fn = Object.hasOwn(routes, body.action) ? routes[body.action] : null;
    if (!fn) return res.status(404).json({ error: "ไม่รู้จักคำสั่งนี้" });
    await migrate();
    const out = await fn({ req, res, body, ...sessions(req) });
    return res.status(200).json(out ?? { ok: true });
  } catch (e) {
    const status = e.expose && e.status >= 400 && e.status < 600 ? e.status : 500;
    if (status >= 500 && status !== 503) console.error(e);
    return res.status(status).json({ error: status === 500 ? "ระบบขัดข้อง ลองใหม่อีกครั้งนะ" : e.message, status });
  }
}
