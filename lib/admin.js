import { q, one, getSettings, DEFAULT_SETTINGS } from "./db.js";
import { httpErr, need, str, int, num } from "./http.js";
import { hashPassword, checkPassword, setSession, clearSession } from "./auth.js";

const admin = ctx => { need(ctx.adminId, 401, "กรุณาเข้าสู่ระบบแอดมิน"); return ctx.adminId; };
const ids = v => (Array.isArray(v) ? v : []).map(int).filter(n => n > 0);
const dateOrNull = v => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d.toISOString(); };

async function studentsOfChapter(ch) {
  return ch.audience === "all"
    ? q("select student_id from enrollments where course_id = $1", [ch.course_id])
    : q(`select a.student_id from chapter_assign a join enrollments e on e.student_id = a.student_id and e.course_id = $2
          where a.chapter_id = $1`, [ch.id, ch.course_id]);
}

export const adminRoutes = {
  async meta() {
    const n = await one("select count(*)::int as n from admins");
    const s = await getSettings();
    return { setupNeeded: n.n === 0, siteName: s.siteName, institution: s.institution };
  },

  async setupAdmin({ body, res }) {
    const n = await one("select count(*)::int as n from admins");
    need(n.n === 0, 400, "ระบบตั้งค่าไปแล้ว");
    need(process.env.SETUP_CODE && str(body.setupCode) === process.env.SETUP_CODE, 400, "รหัสเริ่มต้นระบบไม่ถูกต้อง");
    const username = str(body.username, 64).toLowerCase(), name = str(body.name, 120), pw = String(body.password || "");
    need(/^[a-z0-9._-]{3,}$/.test(username), 400, "ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษหรือตัวเลข อย่างน้อย 3 ตัว");
    need(name, 400, "ใส่ชื่อที่จะแสดงด้วยนะ");
    need(pw.length >= 8, 400, "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
    const a = await one("insert into admins (username, name, pass) values ($1, $2, $3) returning id", [username, name, hashPassword(pw)]);
    setSession(res, "a", a.id);
    return { ok: true };
  },

  async adminLogin({ body, res }) {
    const a = await one("select id, pass from admins where username = $1", [str(body.username, 64).toLowerCase()]);
    if (!a || !checkPassword(String(body.password || ""), a.pass)) throw httpErr(400, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    setSession(res, "a", a.id);
    return { ok: true };
  },

  async adminLogout({ res }) { clearSession(res, "a"); return { ok: true }; },

  async adminMe(ctx) {
    const a = await one("select id, username, name from admins where id = $1", [admin(ctx)]);
    if (!a) { clearSession(ctx.res, "a"); throw httpErr(401, "ไม่พบบัญชีนี้แล้ว"); }
    return { admin: a, settings: await getSettings() };
  },

  async adminPassword(ctx) {
    const a = await one("select pass from admins where id = $1", [admin(ctx)]);
    need(checkPassword(String(ctx.body.old || ""), a.pass), 400, "รหัสผ่านเดิมไม่ถูกต้อง");
    const pw = String(ctx.body.password || "");
    need(pw.length >= 8, 400, "รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร");
    await q("update admins set pass = $2 where id = $1", [ctx.adminId, hashPassword(pw)]);
    return { ok: true };
  },

  async admins(ctx) {
    admin(ctx);
    return { admins: await q("select id, username, name, created_at from admins order by id") };
  },

  async addAdmin(ctx) {
    admin(ctx);
    const username = str(ctx.body.username, 64).toLowerCase(), name = str(ctx.body.name, 120), pw = String(ctx.body.password || "");
    need(/^[a-z0-9._-]{3,}$/.test(username), 400, "ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษหรือตัวเลข อย่างน้อย 3 ตัว");
    need(name && pw.length >= 8, 400, "ใส่ชื่อ และรหัสผ่านอย่างน้อย 8 ตัวอักษร");
    const dup = await one("select 1 from admins where username = $1", [username]);
    need(!dup, 400, "มีชื่อผู้ใช้นี้แล้ว");
    await q("insert into admins (username, name, pass) values ($1, $2, $3)", [username, name, hashPassword(pw)]);
    return { ok: true };
  },

  async removeAdmin(ctx) {
    admin(ctx);
    const id = int(ctx.body.id);
    need(id !== ctx.adminId, 400, "ลบบัญชีที่กำลังใช้อยู่ไม่ได้");
    await q("delete from admins where id = $1", [id]);
    return { ok: true };
  },

  // ---------- ภาพรวม ----------
  async dashboard(ctx) {
    admin(ctx);
    const totals = await one(`select
        (select count(*)::int from students) as students,
        (select count(*)::int from courses where not archived) as courses,
        (select count(*)::int from chapters c join courses co on co.id = c.course_id and not co.archived) as chapters,
        (select count(*)::int from snapshots where kind in ('noface','multi')) as flagged`);
    const perChapter = await q(`
      with need as (
        select c.id as chapter_id, e.student_id from chapters c
          join courses co on co.id = c.course_id and not co.archived
          join enrollments e on e.course_id = c.course_id
         where c.audience = 'all' or exists (select 1 from chapter_assign a where a.chapter_id = c.id and a.student_id = e.student_id))
      select c.id, c.title, c.position, c.due_at, co.id as course_id, co.title as course_title, co.code as course_code,
             count(n.student_id)::int as assigned,
             count(p.completed_at)::int as completed,
             count(p.student_id) filter (where p.completed_at is null)::int as in_progress
        from chapters c join courses co on co.id = c.course_id and not co.archived
        left join need n on n.chapter_id = c.id
        left join progress p on p.chapter_id = c.id and p.student_id = n.student_id
       group by c.id, co.id order by co.id, c.position, c.id`);
    const recent = await q(`select p.updated_at, p.max_pos, p.duration, p.completed_at, s.code, s.name, c.title as chapter, co.code as course_code
        from progress p join students s on s.id = p.student_id join chapters c on c.id = p.chapter_id join courses co on co.id = c.course_id
       order by p.updated_at desc limit 12`);
    return { totals, perChapter, recent };
  },

  // ---------- รายวิชา ----------
  async courses(ctx) {
    admin(ctx);
    return { courses: await q(`select co.*, (select count(*)::int from chapters where course_id = co.id) as chapters,
        (select count(*)::int from enrollments where course_id = co.id) as students
        from courses co order by co.archived, co.id desc`) };
  },

  async saveCourse(ctx) {
    admin(ctx);
    const b = ctx.body, id = int(b.id), title = str(b.title, 200);
    need(title, 400, "ใส่ชื่อรายวิชาก่อนนะ");
    const vals = [str(b.code, 40), title, str(b.description, 2000), !!b.archived];
    const r = id
      ? await one("update courses set code = $2, title = $3, description = $4, archived = $5 where id = $1 returning id", [id, ...vals])
      : await one("insert into courses (code, title, description, archived) values ($1, $2, $3, $4) returning id", vals);
    need(r, 404, "ไม่พบรายวิชานี้");
    return { id: r.id };
  },

  async deleteCourse(ctx) {
    admin(ctx);
    await q("delete from courses where id = $1", [int(ctx.body.id)]);
    return { ok: true };
  },

  async course(ctx) {
    admin(ctx);
    const id = int(ctx.body.id);
    const course = await one("select * from courses where id = $1", [id]);
    need(course, 404, "ไม่พบรายวิชานี้");
    const chapters = await q("select * from chapters where course_id = $1 order by position, id", [id]);
    const assign = await q("select a.chapter_id, a.student_id from chapter_assign a join chapters c on c.id = a.chapter_id where c.course_id = $1", [id]);
    const students = await q(`select s.id, s.code, s.name from enrollments e join students s on s.id = e.student_id
        where e.course_id = $1 order by s.code`, [id]);
    for (const c of chapters) c.students = assign.filter(a => a.chapter_id === c.id).map(a => a.student_id);
    return { course, chapters, students };
  },

  async saveChapter(ctx) {
    admin(ctx);
    const b = ctx.body, id = int(b.id), courseId = int(b.courseId);
    const title = str(b.title, 200), url = str(b.videoUrl, 1000);
    need(title, 400, "ใส่ชื่อบทก่อนนะ");
    need(/^https?:\/\//.test(url), 400, "ลิงก์วิดีโอต้องขึ้นต้นด้วย https://");
    const audience = b.audience === "selected" ? "selected" : "all";
    const vals = [int(b.position) || 1, title, str(b.description, 3000), url, dateOrNull(b.dueAt), b.requirePrev !== false, audience];
    let r;
    if (id) r = await one(`update chapters set position = $2, title = $3, description = $4, video_url = $5, due_at = $6,
                             require_prev = $7, audience = $8 where id = $1 returning id`, [id, ...vals]);
    else {
      need(await one("select 1 from courses where id = $1", [courseId]), 404, "ไม่พบรายวิชานี้");
      r = await one(`insert into chapters (course_id, position, title, description, video_url, due_at, require_prev, audience)
                     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`, [courseId, ...vals]);
    }
    need(r, 404, "ไม่พบบทนี้");
    await q("delete from chapter_assign where chapter_id = $1", [r.id]);
    const sel = audience === "selected" ? ids(b.students) : [];
    if (sel.length) await q(`insert into chapter_assign (chapter_id, student_id) select $1, unnest($2::int[]) on conflict do nothing`, [r.id, sel]);
    return { id: r.id };
  },

  async deleteChapter(ctx) {
    admin(ctx);
    await q("delete from chapters where id = $1", [int(ctx.body.id)]);
    return { ok: true };
  },

  async moveChapter(ctx) {
    admin(ctx);
    const ch = await one("select id, course_id, position from chapters where id = $1", [int(ctx.body.id)]);
    need(ch, 404, "ไม่พบบทนี้");
    const list = await q("select id from chapters where course_id = $1 order by position, id", [ch.course_id]);
    const i = list.findIndex(x => x.id === ch.id), j = i + (ctx.body.dir === "up" ? -1 : 1);
    if (j < 0 || j >= list.length) return { ok: true };
    [list[i], list[j]] = [list[j], list[i]];
    await q("update chapters c set position = x.pos from unnest($1::int[]) with ordinality as x(id, pos) where c.id = x.id", [list.map(x => x.id)]);
    return { ok: true };
  },

  async enroll(ctx) {
    admin(ctx);
    const courseId = int(ctx.body.courseId), list = ids(ctx.body.studentIds);
    need(await one("select 1 from courses where id = $1", [courseId]), 404, "ไม่พบรายวิชานี้");
    if (ctx.body.remove) await q("delete from enrollments where course_id = $1 and student_id = any($2::int[])", [courseId, list]);
    else if (list.length) await q("insert into enrollments (course_id, student_id) select $1, unnest($2::int[]) on conflict do nothing", [courseId, list]);
    return { ok: true };
  },

  // ---------- นักศึกษา ----------
  async students(ctx) {
    admin(ctx);
    const students = await q(`select s.id, s.code, s.name, s.must_change, s.consent_at, s.last_login, s.created_at,
        coalesce(array_agg(e.course_id) filter (where e.course_id is not null), '{}') as courses
        from students s left join enrollments e on e.student_id = s.id group by s.id order by s.code`);
    for (const s of students) s.courses = (Array.isArray(s.courses) ? s.courses : String(s.courses).replace(/[{}]/g, "").split(",").filter(Boolean)).map(Number);
    return { students };
  },

  async importStudents(ctx) {
    admin(ctx);
    const rows = Array.isArray(ctx.body.rows) ? ctx.body.rows.slice(0, 2000) : [];
    const courseId = int(ctx.body.courseId);
    let added = 0, updated = 0;
    const touched = [];
    for (const row of rows) {
      const code = str(row.code, 64), name = str(row.name, 200), pw = str(row.password, 100);
      if (!code || !name) continue;
      need(/^[A-Za-z0-9._-]+$/.test(code), 400, `รหัสนักศึกษา "${code}" ใช้ได้แค่ตัวอังกฤษ ตัวเลข จุด ขีด`);
      const old = await one("select id from students where code = $1", [code]);
      if (old) {
        await q("update students set name = $2 where id = $1", [old.id, name]);
        if (pw) await q("update students set pass = $2, must_change = true where id = $1", [old.id, hashPassword(pw)]);
        touched.push(old.id); updated++;
      } else {
        const r = await one("insert into students (code, name, pass) values ($1, $2, $3) returning id", [code, name, hashPassword(pw || code)]);
        touched.push(r.id); added++;
      }
    }
    if (courseId && touched.length) await q("insert into enrollments (course_id, student_id) select $1, unnest($2::int[]) on conflict do nothing", [courseId, touched]);
    return { added, updated };
  },

  async updateStudent(ctx) {
    admin(ctx);
    const id = int(ctx.body.id), name = str(ctx.body.name, 200);
    if (name) await q("update students set name = $2 where id = $1", [id, name]);
    if (ctx.body.resetPassword) {
      const s = await one("select code from students where id = $1", [id]);
      need(s, 404, "ไม่พบนักศึกษา");
      const pw = str(ctx.body.password, 100) || s.code;
      await q("update students set pass = $2, must_change = true where id = $1", [id, hashPassword(pw)]);
    }
    return { ok: true };
  },

  async deleteStudents(ctx) {
    admin(ctx);
    await q("delete from students where id = any($1::int[])", [ids(ctx.body.ids)]);
    return { ok: true };
  },

  // ---------- รายงาน ----------
  async report(ctx) {
    admin(ctx);
    const courseId = int(ctx.body.courseId);
    const course = await one("select * from courses where id = $1", [courseId]);
    need(course, 404, "ไม่พบรายวิชานี้");
    const chapters = await q("select id, position, title, due_at, audience from chapters where course_id = $1 order by position, id", [courseId]);
    const students = await q(`select s.id, s.code, s.name, s.last_login from enrollments e join students s on s.id = e.student_id
        where e.course_id = $1 order by s.code`, [courseId]);
    const assign = await q("select a.chapter_id, a.student_id from chapter_assign a join chapters c on c.id = a.chapter_id where c.course_id = $1", [courseId]);
    const progress = await q(`select p.student_id, p.chapter_id, p.max_pos, p.watched, p.duration, p.away, p.started_at, p.updated_at, p.completed_at,
        (select count(*)::int from snapshots x where x.student_id = p.student_id and x.chapter_id = p.chapter_id) as snaps,
        (select count(*)::int from snapshots x where x.student_id = p.student_id and x.chapter_id = p.chapter_id and x.kind in ('noface','multi')) as flagged
        from progress p join chapters c on c.id = p.chapter_id where c.course_id = $1`, [courseId]);
    for (const c of chapters) c.students = c.audience === "all" ? null : assign.filter(a => a.chapter_id === c.id).map(a => a.student_id);
    return { course, chapters, students, progress };
  },

  async snapshots(ctx) {
    admin(ctx);
    const sid = int(ctx.body.studentId), cid = int(ctx.body.chapterId);
    const flaggedOnly = !!ctx.body.flaggedOnly;
    const rows = await q(`select x.id, x.kind, x.faces, x.image, x.taken_at, s.code, s.name, c.title as chapter
        from snapshots x join students s on s.id = x.student_id join chapters c on c.id = x.chapter_id
       where ($1::int is null or x.student_id = $1) and ($2::int is null or x.chapter_id = $2)
         and ($3::int is null or c.course_id = $3) and (not $4 or x.kind in ('noface','multi'))
       order by x.taken_at desc limit 120`, [sid, cid, int(ctx.body.courseId), flaggedOnly]);
    return { snapshots: rows };
  },

  async deleteSnapshots(ctx) {
    admin(ctx);
    const days = Math.max(1, int(ctx.body.olderThanDays) || 180);
    const r = await q("delete from snapshots where taken_at < now() - make_interval(days => $1) returning id", [days]);
    return { deleted: r.length };
  },

  // ---------- ตั้งค่า ----------
  async saveSettings(ctx) {
    admin(ctx);
    const b = ctx.body.settings || {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (b[key] === undefined) continue;
      await q("insert into settings (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value", [key, str(b[key], 300)]);
    }
    return { settings: await getSettings() };
  },
};

export { studentsOfChapter };
