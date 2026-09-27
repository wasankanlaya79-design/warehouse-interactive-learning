import { q, one, getSettings } from "./db.js";
import { httpErr, need, str, int, num } from "./http.js";
import { hashPassword, checkPassword, setSession, clearSession } from "./auth.js";

const me = ctx => { need(ctx.studentId, 401, "กรุณาเข้าสู่ระบบ"); return ctx.studentId; };

async function visibleChapters(sid) {
  const rows = await q(
    `select c.id, c.course_id, c.position, c.title, c.description, c.due_at, c.require_prev,
            co.title as course_title, co.code as course_code, co.description as course_desc,
            p.max_pos, p.watched, p.duration, p.away, p.completed_at, p.updated_at
       from chapters c
       join courses co on co.id = c.course_id and not co.archived
       join enrollments e on e.course_id = c.course_id and e.student_id = $1
       left join progress p on p.chapter_id = c.id and p.student_id = $1
      where c.audience = 'all' or exists (select 1 from chapter_assign a where a.chapter_id = c.id and a.student_id = $1)
      order by co.id, c.position, c.id`, [sid]);
  const courses = new Map();
  for (const r of rows) {
    if (!courses.has(r.course_id)) courses.set(r.course_id, { id: r.course_id, code: r.course_code, title: r.course_title, description: r.course_desc, chapters: [] });
    const list = courses.get(r.course_id).chapters;
    const prev = list[list.length - 1];
    list.push({
      id: r.id, position: r.position, title: r.title, description: r.description, dueAt: r.due_at,
      locked: !!(r.require_prev && prev && !prev.completedAt),
      maxPos: num(r.max_pos), watched: num(r.watched), duration: num(r.duration), away: num(r.away),
      completedAt: r.completed_at, updatedAt: r.updated_at,
    });
  }
  return [...courses.values()];
}

export const studentRoutes = {
  async studentLogin({ body, res }) {
    const code = str(body.code, 64), pw = String(body.password || "");
    const s = await one("select id, pass, must_change from students where code = $1", [code]);
    if (!s || !checkPassword(pw, s.pass)) throw httpErr(400, "รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง");
    await q("update students set last_login = now() where id = $1", [s.id]);
    setSession(res, "s", s.id);
    return { ok: true, mustChange: s.must_change };
  },

  async studentLogout({ res }) { clearSession(res, "s"); return { ok: true }; },

  async me(ctx) {
    const sid = me(ctx);
    const s = await one("select id, code, name, must_change, consent_at from students where id = $1", [sid]);
    if (!s) { clearSession(ctx.res, "s"); throw httpErr(401, "ไม่พบบัญชีนี้แล้ว"); }
    const st = await getSettings();
    return {
      student: { code: s.code, name: s.name, mustChange: s.must_change, consentAt: s.consent_at },
      settings: { siteName: st.siteName, institution: st.institution, passPct: st.passPct, snapshotMinutes: st.snapshotMinutes },
      courses: s.must_change ? [] : await visibleChapters(sid),
    };
  },

  async studentPassword(ctx) {
    const sid = me(ctx);
    const s = await one("select pass from students where id = $1", [sid]);
    need(checkPassword(String(ctx.body.old || ""), s.pass), 400, "รหัสผ่านเดิมไม่ถูกต้อง");
    const pw = String(ctx.body.password || "");
    need(pw.length >= 6, 400, "รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร");
    need(pw !== String(ctx.body.old), 400, "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม");
    await q("update students set pass = $2, must_change = false where id = $1", [sid, hashPassword(pw)]);
    return { ok: true };
  },

  async consent(ctx) {
    const sid = me(ctx);
    await q("update students set consent_at = coalesce(consent_at, now()) where id = $1", [sid]);
    return { ok: true };
  },

  async startChapter(ctx) {
    const sid = me(ctx), cid = int(ctx.body.chapterId);
    const s = await one("select must_change, consent_at from students where id = $1", [sid]);
    need(!s.must_change, 403, "ต้องเปลี่ยนรหัสผ่านก่อนเริ่มเรียน");
    const courses = await visibleChapters(sid);
    let ch = null, course = null;
    for (const c of courses) { const f = c.chapters.find(x => x.id === cid); if (f) { ch = f; course = c; } }
    need(ch, 404, "ไม่พบบทเรียนนี้ หรือบทนี้ไม่ได้อยู่ในรายการที่คุณต้องเรียน");
    need(!ch.locked, 403, "ต้องเรียนบทก่อนหน้าให้ผ่านก่อน ถึงจะเปิดบทนี้ได้");
    const row = await one("select video_url from chapters where id = $1", [cid]);
    await q(`insert into progress (student_id, chapter_id) values ($1, $2)
             on conflict (student_id, chapter_id) do update set updated_at = now()`, [sid, cid]);
    const st = await getSettings();
    return { course: { id: course.id, title: course.title, code: course.code }, chapter: { ...ch, videoUrl: row.video_url },
             driveApiKey: st.driveApiKey, passPct: st.passPct, snapshotMinutes: st.snapshotMinutes, consentAt: s.consent_at };
  },

  async saveProgress(ctx) {
    const sid = me(ctx), cid = int(ctx.body.chapterId);
    const p = await one("select * from progress where student_id = $1 and chapter_id = $2", [sid, cid]);
    need(p, 404, "ยังไม่ได้เริ่มบทนี้");
    const { passPct } = await getSettings();
    // กันการปลอมตัวเลข: ดูเพิ่มได้ไม่เกินเวลาจริงที่ผ่านไป
    const elapsed = Math.max(0, (Date.now() - new Date(p.updated_at).getTime()) / 1000);
    const allow = elapsed * 1.2 + 8;
    const duration = num(ctx.body.duration) > 0 ? num(ctx.body.duration) : num(p.duration);
    let maxPos = Math.max(num(p.max_pos), Math.min(num(ctx.body.maxPos), num(p.max_pos) + allow));
    if (duration > 0) maxPos = Math.min(maxPos, duration);
    const watched = Math.max(num(p.watched), Math.min(num(ctx.body.watched), num(p.watched) + allow));
    const away = Math.max(num(p.away), Math.min(int(ctx.body.away) || 0, num(p.away) + 50));
    const done = !p.completed_at && duration > 0 && maxPos >= duration * passPct / 100 - 1;
    const r = await one(
      `update progress set max_pos = $3, watched = $4, duration = $5, away = $6, updated_at = now(),
              completed_at = case when $7 then now() else completed_at end
        where student_id = $1 and chapter_id = $2 returning max_pos, watched, duration, away, completed_at`,
      [sid, cid, maxPos, watched, duration, away, done]);
    return { progress: { maxPos: num(r.max_pos), watched: num(r.watched), duration: num(r.duration), away: num(r.away), completedAt: r.completed_at } };
  },

  async snapshot(ctx) {
    const sid = me(ctx), cid = int(ctx.body.chapterId);
    const img = String(ctx.body.image || "");
    need(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(img) && img.length < 300000, 400, "รูปภาพไม่ถูกต้อง");
    const s = await one("select consent_at from students where id = $1", [sid]);
    need(s && s.consent_at, 403, "ยังไม่ได้ให้ความยินยอมการถ่ายภาพ");
    const p = await one("select 1 from progress where student_id = $1 and chapter_id = $2", [sid, cid]);
    need(p, 404, "ยังไม่ได้เริ่มบทนี้");
    const recent = await one("select 1 from snapshots where student_id = $1 and taken_at > now() - interval '20 seconds'", [sid]);
    if (recent) return { ok: true, skipped: true };
    const kind = ["start", "interval", "multi", "noface"].includes(ctx.body.kind) ? ctx.body.kind : "interval";
    await q("insert into snapshots (student_id, chapter_id, kind, faces, image) values ($1, $2, $3, $4, $5)",
      [sid, cid, kind, Math.max(0, Math.min(9, int(ctx.body.faces) ?? 1)), img]);
    return { ok: true };
  },
};
