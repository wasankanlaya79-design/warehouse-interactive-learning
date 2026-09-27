(function () {
const { $, $$, esc, api, dur, minutes, date, dateTime, ago, due, toLocalInput, pct, videoKind, toast, busy, modal, confirmBox, spinner, bar, icon } = LR;
const app = $("#app");
let ME = null, SETTINGS = null;

const fail = e => { if (e.status === 401) return boot(); toast(e.message, "error"); };
const sm = svg => svg.replace("<svg", '<svg width="14" height="14"');

// ======================= เริ่มต้น =======================
async function boot() {
  try { const r = await api("adminMe"); ME = r.admin; SETTINGS = r.settings; }
  catch (e) {
    if (e.status !== 401) return fatal(e.message);
    let meta = { setupNeeded: false, siteName: "ห้องเรียนออนไลน์", institution: "" };
    try { meta = await api("meta"); } catch (e2) { return fatal(e2.message); }
    return meta.setupNeeded ? renderSetup(meta) : renderLogin(meta);
  }
  document.title = "ผู้ดูแลระบบ · " + SETTINGS.siteName;
  route();
}
window.addEventListener("hashchange", () => ME && route());

function fatal(msg) {
  app.innerHTML = `<div class="auth"><div class="card auth-card"><div class="empty">${icon.alert}<b>เปิดระบบไม่ได้</b><span>${esc(msg)}</span>
    <button class="btn primary" onclick="location.reload()">ลองอีกครั้ง</button></div></div></div>`;
}
const brand = s => `<div class="brand"><div class="brand-mark">${icon.logo}</div><div><b>${esc(s.siteName)}</b><small>${esc(s.institution || "ระบบจัดการการเรียน")}</small></div></div>`;

function renderSetup(meta) {
  app.innerHTML = `<div class="auth"><form class="card auth-card" id="f">${brand(meta)}
    <div class="stack-sm"><h1>ตั้งค่าระบบครั้งแรก</h1><p class="muted small">สร้างบัญชีผู้ดูแลระบบคนแรก ใช้รหัสเริ่มต้นระบบที่ได้รับตอนติดตั้ง</p></div>
    <label class="field"><span>รหัสเริ่มต้นระบบ</span><input id="code" required autocomplete="off"></label>
    <label class="field"><span>ชื่อที่แสดง</span><input id="name" required placeholder="เช่น อ.วสันต์"></label>
    <label class="field"><span>ชื่อผู้ใช้ (ภาษาอังกฤษ)</span><input id="user" required autocomplete="username" placeholder="เช่น wasan"></label>
    <label class="field"><span>รหัสผ่าน</span><input id="pw" type="password" required minlength="8" autocomplete="new-password"><small>อย่างน้อย 8 ตัวอักษร</small></label>
    <p class="err" id="err" hidden></p><button class="btn primary" id="go">สร้างบัญชีและเข้าสู่ระบบ</button></form></div>`;
  $("#f").onsubmit = e => { e.preventDefault(); busy($("#go"), async () => {
    try { await api("setupAdmin", { setupCode: $("#code").value.trim(), name: $("#name").value, username: $("#user").value, password: $("#pw").value }); location.hash = "#/"; boot(); }
    catch (err) { $("#err").textContent = err.message; $("#err").hidden = false; }
  }); };
}
function renderLogin(meta) {
  app.innerHTML = `<div class="auth"><form class="card auth-card" id="f">${brand(meta)}
    <div class="stack-sm"><h1>เข้าสู่ระบบผู้ดูแล</h1><p class="muted small">สำหรับอาจารย์และผู้ดูแลระบบ · <a href="/">ไปหน้านักศึกษา</a></p></div>
    <label class="field"><span>ชื่อผู้ใช้</span><input id="user" required autocomplete="username"></label>
    <label class="field"><span>รหัสผ่าน</span><input id="pw" type="password" required autocomplete="current-password"></label>
    <p class="err" id="err" hidden></p><button class="btn primary" id="go">เข้าสู่ระบบ</button></form></div>`;
  $("#f").onsubmit = e => { e.preventDefault(); busy($("#go"), async () => {
    try { await api("adminLogin", { username: $("#user").value, password: $("#pw").value }); boot(); }
    catch (err) { $("#err").textContent = err.message; $("#err").hidden = false; }
  }); };
  $("#user").focus();
}

// ======================= โครงหน้า =======================
const NAV = [
  ["dashboard", "ภาพรวม", icon.home], ["courses", "รายวิชาและบทเรียน", icon.book], ["students", "นักศึกษา", icon.users],
  ["reports", "รายงานผลการเรียน", icon.chart], ["photos", "ภาพยืนยันตัวตน", icon.camera], ["settings", "ตั้งค่า", icon.cog],
];
function shell(active, inner) {
  app.innerHTML = `<div class="mobilebar">${brand(SETTINGS)}<button class="btn icon" id="menu" aria-label="เมนู">${icon.menu}</button></div>
    <div class="layout"><aside class="side" id="side">${brand(SETTINGS)}
      <nav class="nav">${NAV.map(([k, l, i]) => `<a href="#/${k}" ${k === active ? 'aria-current="page"' : ""}>${i}${l}</a>`).join("")}</nav>
      <div class="side-foot"><div class="avatar">${esc(ME.name.charAt(0))}</div><div class="grow small" style="line-height:1.3"><b>${esc(ME.name)}</b><br><span class="muted tiny">${esc(ME.username)}</span></div>
        <button class="btn ghost icon" id="out" title="ออกจากระบบ" aria-label="ออกจากระบบ">${icon.logout}</button></div>
    </aside><main class="content" id="main">${inner}</main></div>`;
  $("#out").onclick = async () => { try { await api("adminLogout"); } catch {} ME = null; boot(); };
  $("#menu").onclick = () => $("#side").classList.toggle("open");
  $$(".nav a").forEach(a => a.onclick = () => $("#side").classList.remove("open"));
}
const head = (title, sub = "", actions = "") => `<div class="page-head"><div class="stack-sm" style="gap:2px"><h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ""}</div><div class="row">${actions}</div></div>`;
const emptyBox = (ic, title, text, action = "") => `<div class="empty">${ic}<b>${title}</b><span>${text}</span>${action}</div>`;

function route() {
  const [page = "dashboard", id] = location.hash.replace(/^#\/?/, "").split("/");
  const views = { dashboard: viewDashboard, courses: viewCourses, course: viewCourse, students: viewStudents, reports: viewReports, photos: viewPhotos, settings: viewSettings };
  (views[page] || viewDashboard)(id ? Number(id) : null);
}

// ======================= ภาพรวม =======================
async function viewDashboard() {
  shell("dashboard", head("ภาพรวม", "สรุปการเรียนของนักศึกษาทุกรายวิชา") + spinner);
  let d; try { d = await api("dashboard"); } catch (e) { return fail(e); }
  const t = d.totals;
  const assigned = d.perChapter.reduce((a, c) => a + c.assigned, 0), completed = d.perChapter.reduce((a, c) => a + c.completed, 0);
  const overdue = d.perChapter.filter(c => c.due_at && new Date(c.due_at) < Date.now() && c.completed < c.assigned);
  $("#main").innerHTML = head("ภาพรวม", "สรุปการเรียนของนักศึกษาทุกรายวิชา", `<a class="btn primary" href="#/courses">${icon.plus} เพิ่มบทเรียน</a>`) + `
    <section class="kpis">
      <div class="card kpi"><span class="tiny">นักศึกษาทั้งหมด</span><b>${t.students}</b><span class="tiny">ใน ${t.courses} รายวิชา</span></div>
      <div class="card kpi"><span class="tiny">บทเรียน</span><b>${t.chapters}</b><span class="tiny">บทที่เปิดอยู่</span></div>
      <div class="card kpi"><span class="tiny">เรียนผ่านแล้ว</span><b>${pct(completed, assigned)}%</b>${bar(pct(completed, assigned))}<span class="tiny">${completed} จาก ${assigned} งานที่มอบหมาย</span></div>
      <a class="card kpi" href="#/photos" style="text-decoration:none;color:inherit"><span class="tiny">ภาพที่ควรตรวจ</span><b style="color:${t.flagged ? "var(--danger)" : "inherit"}">${t.flagged}</b><span class="tiny">ไม่พบหน้า หรือพบหลายคน</span></a>
    </section>
    ${overdue.length ? `<div class="card card-pad row" style="border-color:var(--warn);gap:12px">${sm(icon.alert)}<span><b>มี ${overdue.length} บทที่เลยกำหนดแล้วแต่ยังมีคนเรียนไม่ครบ</b> · ${overdue.slice(0, 3).map(c => esc(c.title)).join(", ")}</span></div>` : ""}
    <section class="card"><div class="card-head"><h2>ความคืบหน้าแต่ละบท</h2><a class="btn sm" href="#/reports">ดูรายงานละเอียด</a></div>
      ${d.perChapter.length ? d.perChapter.map(c => `<div class="hbar"><div style="min-width:0"><b>${esc(c.title)}</b>
          <div class="meta"><span class="chip">${esc(c.course_code || c.course_title)}</span>${due(c.due_at, c.completed >= c.assigned && c.assigned)}${c.in_progress ? `<span class="badge accent">กำลังเรียน ${c.in_progress}</span>` : ""}</div></div>
          ${bar(pct(c.completed, c.assigned), c.assigned && c.completed === c.assigned)}<span class="mono small" style="text-align:right">${c.completed}/${c.assigned}</span></div>`).join("")
        : emptyBox(icon.book, "ยังไม่มีบทเรียน", "สร้างรายวิชาแล้วเพิ่มบทเรียนได้เลย", `<a class="btn primary" href="#/courses">สร้างรายวิชา</a>`)}
    </section>
    <section class="card"><div class="card-head"><h2>ความเคลื่อนไหวล่าสุด</h2></div>
      ${d.recent.length ? `<div class="table-wrap"><table><thead><tr><th>นักศึกษา</th><th>บทเรียน</th><th class="num">ดูถึง</th><th>สถานะ</th><th>เวลา</th></tr></thead><tbody>
        ${d.recent.map(r => `<tr><td><b>${esc(r.name)}</b><br><span class="mono tiny muted">${esc(r.code)}</span></td><td>${esc(r.chapter)}<br><span class="tiny muted">${esc(r.course_code)}</span></td>
          <td class="num">${pct(r.max_pos, r.duration)}%</td><td>${r.completed_at ? '<span class="badge ok">ผ่าน</span>' : '<span class="badge accent">กำลังเรียน</span>'}</td><td class="small muted">${ago(r.updated_at)}</td></tr>`).join("")}
        </tbody></table></div>` : emptyBox(icon.chart, "ยังไม่มีการเรียน", "เมื่อนักศึกษาเริ่มดูวิดีโอ ความเคลื่อนไหวจะขึ้นที่นี่")}
    </section>`;
}

// ======================= รายวิชา =======================
async function viewCourses() {
  shell("courses", head("รายวิชาและบทเรียน") + spinner);
  let r; try { r = await api("courses"); } catch (e) { return fail(e); }
  $("#main").innerHTML = head("รายวิชาและบทเรียน", "สร้างรายวิชา เพิ่มบทเรียน และเลือกนักศึกษาที่ต้องเรียน", `<button class="btn primary" id="add">${icon.plus} สร้างรายวิชา</button>`) +
    (r.courses.length ? `<div class="course-grid">${r.courses.map(c => `<a class="card course-tile" href="#/course/${c.id}">
        <div class="row between">${c.code ? `<span class="eyebrow">${esc(c.code)}</span>` : "<span></span>"}${c.archived ? '<span class="badge">เก็บเข้าคลัง</span>' : ""}</div>
        <h2>${esc(c.title)}</h2>${c.description ? `<p class="muted small">${esc(c.description)}</p>` : ""}
        <div class="stats"><span><b>${c.chapters}</b> บท</span><span><b>${c.students}</b> นักศึกษา</span></div></a>`).join("")}</div>`
      : `<div class="card">${emptyBox(icon.book, "ยังไม่มีรายวิชา", "เริ่มจากสร้างรายวิชาแรก แล้วค่อยเพิ่มบทเรียนกับรายชื่อนักศึกษา", `<button class="btn primary" id="add2">${icon.plus} สร้างรายวิชา</button>`)}</div>`);
  const open = () => courseForm(null, id => location.hash = `#/course/${id}`);
  $("#add").onclick = open; if ($("#add2")) $("#add2").onclick = open;
}

function courseForm(c, done) {
  const dlg = modal({ title: c ? "แก้ไขรายวิชา" : "สร้างรายวิชา", body: `<div class="form-grid">
      <label class="field"><span>รหัสวิชา</span><input id="code" value="${esc(c?.code)}" placeholder="เช่น CS101"></label>
      <label class="field"><span>ชื่อรายวิชา</span><input id="title" value="${esc(c?.title)}" required></label>
      <label class="field full"><span>คำอธิบาย</span><input id="desc" value="${esc(c?.description)}" placeholder="ไม่ใส่ก็ได้"></label>
      ${c ? `<label class="check full"><input type="checkbox" id="arch" ${c.archived ? "checked" : ""}> เก็บเข้าคลัง (นักศึกษาจะไม่เห็นรายวิชานี้)</label>` : ""}</div><p class="err" id="err" hidden></p>`,
    foot: `${c ? `<button class="btn danger" id="del" style="margin-right:auto">${icon.trash} ลบรายวิชา</button>` : ""}<button class="btn" data-close>ยกเลิก</button><button class="btn primary" id="save">บันทึก</button>` });
  $("#save", dlg).onclick = e => busy(e.currentTarget, async () => {
    try { const r = await api("saveCourse", { id: c?.id, code: $("#code", dlg).value, title: $("#title", dlg).value, description: $("#desc", dlg).value, archived: $("#arch", dlg)?.checked });
      dlg.close(); toast("บันทึกรายวิชาแล้ว"); done(r.id); }
    catch (err) { $("#err", dlg).textContent = err.message; $("#err", dlg).hidden = false; }
  });
  if (c) $("#del", dlg).onclick = async () => {
    if (!await confirmBox("ลบรายวิชานี้?", `บทเรียน ผลการเรียน และภาพยืนยันตัวตนทั้งหมดของ <b>${esc(c.title)}</b> จะถูกลบถาวร กู้คืนไม่ได้`, "ลบถาวร", true)) return;
    try { await api("deleteCourse", { id: c.id }); dlg.close(); toast("ลบรายวิชาแล้ว"); location.hash = "#/courses"; } catch (e) { fail(e); }
  };
  $("#title", dlg).focus();
}

let courseTab = "chapters";
async function viewCourse(id) {
  shell("courses", spinner);
  let d; try { d = await api("course", { id }); } catch (e) { return fail(e); }
  const c = d.course;
  $("#main").innerHTML = `<nav class="small"><a href="#/courses" class="muted" style="text-decoration:none">${sm(icon.back)} รายวิชาทั้งหมด</a></nav>` +
    head(esc(c.title), `${c.code ? esc(c.code) + " · " : ""}${d.chapters.length} บท · ${d.students.length} นักศึกษา${c.archived ? " · เก็บเข้าคลัง" : ""}`,
      `<button class="btn" id="edit">${icon.edit} แก้ไขรายวิชา</button><a class="btn" href="#/reports/${c.id}">${icon.chart} รายงาน</a>`) +
    `<div class="tabs" role="tablist"><button role="tab" data-t="chapters">บทเรียน (${d.chapters.length})</button><button role="tab" data-t="students">นักศึกษาในรายวิชา (${d.students.length})</button></div>
     <div id="tab"></div>`;
  $("#edit").onclick = () => courseForm(c, () => viewCourse(id));
  const show = t => { courseTab = t; $$(".tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.t === t)); t === "chapters" ? tabChapters(d) : tabEnrolled(d); };
  $$(".tabs button").forEach(b => b.onclick = () => show(b.dataset.t));
  show(courseTab);
}

function tabChapters(d) {
  const reload = () => viewCourse(d.course.id);
  $("#tab").innerHTML = `<section class="card"><div class="card-head"><h2>บทเรียน</h2><button class="btn primary" id="addCh">${icon.plus} เพิ่มบท</button></div>
    ${d.chapters.length ? d.chapters.map((ch, i) => `<div class="chrow">
        <div class="pos">${i + 1}</div>
        <div style="min-width:0"><b>${esc(ch.title)}</b>${ch.description ? `<p class="small muted">${esc(ch.description)}</p>` : ""}
          <div class="meta"><span class="chip">${videoKind(ch.video_url)}</span>
            ${ch.audience === "all" ? '<span class="badge">ทุกคนในรายวิชา</span>' : `<span class="badge accent">เฉพาะ ${ch.students.length} คน</span>`}
            ${ch.require_prev && i ? `<span class="badge">${sm(icon.lock)} ต้องผ่านบทก่อน</span>` : ""}${due(ch.due_at, false)}</div></div>
        <div class="row" style="flex-wrap:nowrap">
          <button class="btn ghost icon" data-up="${ch.id}" ${i ? "" : "disabled"} aria-label="เลื่อนขึ้น">${icon.up}</button>
          <button class="btn ghost icon" data-down="${ch.id}" ${i < d.chapters.length - 1 ? "" : "disabled"} aria-label="เลื่อนลง">${icon.down}</button>
          <button class="btn sm" data-edit="${ch.id}">${icon.edit} แก้ไข</button></div></div>`).join("")
      : emptyBox(icon.play, "ยังไม่มีบทเรียน", "เพิ่มบทแรกโดยวางลิงก์วิดีโอจาก Google Drive หรือ YouTube")}</section>`;
  $("#addCh").onclick = () => chapterForm(d, null, reload);
  $$("[data-edit]").forEach(b => b.onclick = () => chapterForm(d, d.chapters.find(x => x.id === +b.dataset.edit), reload));
  $$("[data-up],[data-down]").forEach(b => b.onclick = () => busy(b, async () => {
    try { await api("moveChapter", { id: +(b.dataset.up || b.dataset.down), dir: b.dataset.up ? "up" : "down" }); reload(); } catch (e) { fail(e); }
  }));
}

function chapterForm(d, ch, done) {
  const picked = new Set(ch?.students || []);
  const dlg = modal({ wide: true, title: ch ? "แก้ไขบทเรียน" : "เพิ่มบทเรียน", body: `<div class="form-grid">
      <label class="field full"><span>ชื่อบท</span><input id="title" value="${esc(ch?.title)}" required placeholder="เช่น บทที่ 1 แนะนำรายวิชา"></label>
      <label class="field full"><span>คำอธิบายสั้นๆ</span><input id="desc" value="${esc(ch?.description)}" placeholder="ไม่ใส่ก็ได้"></label>
      <label class="field full"><span>ลิงก์วิดีโอ</span><input id="url" value="${esc(ch?.video_url)}" required placeholder="วางลิงก์ Google Drive, YouTube หรือไฟล์ .mp4"><small id="urlHint"></small></label>
      <label class="field"><span>กำหนดส่ง</span><input id="due" type="datetime-local" value="${toLocalInput(ch?.due_at)}"><small>ไม่ใส่ก็ได้ ถ้าไม่มีกำหนด</small></label>
      <label class="field"><span>ลำดับ</span><input id="pos" type="number" min="1" value="${ch?.position || d.chapters.length + 1}"></label>
      <label class="check full"><input type="checkbox" id="prev" ${ch?.require_prev === false ? "" : "checked"}> ต้องเรียนบทก่อนหน้าให้ผ่านก่อน ถึงจะเปิดบทนี้ได้</label>
      <div class="field full"><span>นักศึกษาที่ต้องเรียนบทนี้</span>
        <div class="seg"><label><input type="radio" name="aud" value="all" ${ch?.audience !== "selected" ? "checked" : ""}>ทุกคนในรายวิชา (${d.students.length} คน)</label><label><input type="radio" name="aud" value="selected" ${ch?.audience === "selected" ? "checked" : ""}>เลือกเฉพาะบางคน</label></div></div>
      <div class="full stack-sm" id="pick">
        <div class="row"><input id="q" placeholder="ค้นหาชื่อหรือรหัส" class="grow" style="flex:1 1 200px"><button type="button" class="btn sm" id="all">เลือกทั้งหมด</button><button type="button" class="btn sm" id="none">ล้าง</button></div>
        <div class="checklist" id="list"></div><small class="muted" id="cnt"></small></div>
    </div><p class="err" id="err" hidden></p>`,
    foot: `${ch ? `<button class="btn danger" id="del" style="margin-right:auto">${icon.trash} ลบบทนี้</button>` : ""}<button class="btn" data-close>ยกเลิก</button><button class="btn primary" id="save">บันทึกบทเรียน</button>` });
  const hint = () => {
    const u = $("#url", dlg).value, k = videoKind(u);
    $("#urlHint", dlg).textContent = !u ? "รองรับ Google Drive, YouTube และลิงก์ไฟล์วิดีโอโดยตรง"
      : k === "Google Drive" ? `Google Drive · ตั้งแชร์ไฟล์เป็น "ทุกคนที่มีลิงก์"${SETTINGS.driveApiKey ? "" : " · ถ้าไฟล์ใหญ่เกิน 100 MB ต้องใส่ Google API key ในหน้าตั้งค่าก่อน"}`
      : k === "YouTube" ? "YouTube · ตั้งเป็น \"ไม่เป็นสาธารณะ (Unlisted)\" ได้ แต่อย่าตั้งเป็นส่วนตัว" : "ลิงก์ไฟล์วิดีโอโดยตรง เช่น .mp4";
  };
  const list = () => {
    const sel = $("[name=aud]:checked", dlg).value === "selected";
    $("#pick", dlg).hidden = !sel;
    const q = $("#q", dlg).value.trim().toLowerCase();
    const rows = d.students.filter(s => !q || (s.code + " " + s.name).toLowerCase().includes(q));
    $("#list", dlg).innerHTML = rows.map(s => `<label><input type="checkbox" value="${s.id}" ${picked.has(s.id) ? "checked" : ""}><span class="mono small">${esc(s.code)}</span> ${esc(s.name)}</label>`).join("")
      || `<div class="empty small">${d.students.length ? "ไม่พบรายชื่อที่ค้นหา" : "ยังไม่มีนักศึกษาในรายวิชานี้ เพิ่มได้ที่แท็บ \"นักศึกษาในรายวิชา\""}</div>`;
    $$("#list input", dlg).forEach(i => i.onchange = () => { i.checked ? picked.add(+i.value) : picked.delete(+i.value); cnt(); });
    cnt();
  };
  const cnt = () => $("#cnt", dlg).textContent = `เลือกไว้ ${picked.size} จาก ${d.students.length} คน`;
  $("#url", dlg).oninput = hint; hint();
  $$("[name=aud]", dlg).forEach(r => r.onchange = list); $("#q", dlg).oninput = list; list();
  $("#all", dlg).onclick = () => { const q = $("#q", dlg).value.trim().toLowerCase(); d.students.filter(s => !q || (s.code + " " + s.name).toLowerCase().includes(q)).forEach(s => picked.add(s.id)); list(); };
  $("#none", dlg).onclick = () => { picked.clear(); list(); };
  $("#save", dlg).onclick = e => busy(e.currentTarget, async () => {
    const dueV = $("#due", dlg).value;
    try {
      await api("saveChapter", { id: ch?.id, courseId: d.course.id, title: $("#title", dlg).value, description: $("#desc", dlg).value,
        videoUrl: $("#url", dlg).value.trim(), dueAt: dueV ? new Date(dueV).toISOString() : null, position: +$("#pos", dlg).value,
        requirePrev: $("#prev", dlg).checked, audience: $("[name=aud]:checked", dlg).value, students: [...picked] });
      dlg.close(); toast("บันทึกบทเรียนแล้ว"); done();
    } catch (err) { $("#err", dlg).textContent = err.message; $("#err", dlg).hidden = false; }
  });
  if (ch) $("#del", dlg).onclick = async () => {
    if (!await confirmBox("ลบบทนี้?", `ผลการเรียนและภาพยืนยันตัวตนของบท <b>${esc(ch.title)}</b> จะถูกลบถาวร`, "ลบถาวร", true)) return;
    try { await api("deleteChapter", { id: ch.id }); dlg.close(); toast("ลบบทแล้ว"); done(); } catch (e) { fail(e); }
  };
}

function tabEnrolled(d) {
  const reload = () => viewCourse(d.course.id);
  $("#tab").innerHTML = `<section class="card"><div class="card-head"><h2>นักศึกษาในรายวิชา</h2>
      <div class="row"><a class="btn" href="#/students" id="imp">นำเข้ารายชื่อใหม่</a><button class="btn primary" id="addSt">${icon.plus} เพิ่มนักศึกษาเข้าวิชา</button></div></div>
    ${d.students.length ? `<div class="table-wrap"><table><thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th></th></tr></thead><tbody>
      ${d.students.map(s => `<tr><td class="mono">${esc(s.code)}</td><td>${esc(s.name)}</td><td style="text-align:right"><button class="btn sm danger" data-rm="${s.id}">นำออก</button></td></tr>`).join("")}</tbody></table></div>`
      : emptyBox(icon.users, "ยังไม่มีนักศึกษาในรายวิชานี้", "เพิ่มจากรายชื่อที่มีอยู่แล้ว หรือนำเข้ารายชื่อใหม่ทั้งห้อง")}</section>`;
  $("#imp").onclick = e => { e.preventDefault(); importDialog(d.course.id, reload); };
  $$("[data-rm]").forEach(b => b.onclick = async () => {
    const s = d.students.find(x => x.id === +b.dataset.rm);
    if (!await confirmBox("นำออกจากรายวิชา?", `${esc(s.name)} จะไม่เห็นบทเรียนของวิชานี้ ผลการเรียนที่มีอยู่ยังเก็บไว้`, "นำออก", true)) return;
    try { await api("enroll", { courseId: d.course.id, studentIds: [s.id], remove: true }); toast("นำออกแล้ว"); reload(); } catch (e) { fail(e); }
  });
  $("#addSt").onclick = async () => {
    let all; try { all = (await api("students")).students; } catch (e) { return fail(e); }
    const inCourse = new Set(d.students.map(s => s.id)), avail = all.filter(s => !inCourse.has(s.id)), picked = new Set();
    const dlg = modal({ title: "เพิ่มนักศึกษาเข้าวิชา", body: avail.length ? `<input id="q" placeholder="ค้นหาชื่อหรือรหัส"><div class="checklist" id="list"></div><small class="muted" id="cnt"></small>`
        : `<p class="muted">นักศึกษาทุกคนในระบบอยู่ในรายวิชานี้แล้ว ถ้าจะเพิ่มคนใหม่ ใช้ปุ่ม "นำเข้ารายชื่อใหม่"</p>`,
      foot: `<button class="btn" data-close>ยกเลิก</button>${avail.length ? '<button class="btn primary" id="ok">เพิ่มเข้าวิชา</button>' : ""}` });
    if (!avail.length) return;
    const draw = () => { const q = $("#q", dlg).value.trim().toLowerCase();
      $("#list", dlg).innerHTML = avail.filter(s => !q || (s.code + s.name).toLowerCase().includes(q)).map(s => `<label><input type="checkbox" value="${s.id}" ${picked.has(s.id) ? "checked" : ""}><span class="mono small">${esc(s.code)}</span> ${esc(s.name)}</label>`).join("");
      $$("#list input", dlg).forEach(i => i.onchange = () => { i.checked ? picked.add(+i.value) : picked.delete(+i.value); $("#cnt", dlg).textContent = `เลือกไว้ ${picked.size} คน`; }); };
    $("#q", dlg).oninput = draw; draw();
    $("#ok", dlg).onclick = e => busy(e.currentTarget, async () => {
      if (!picked.size) return toast("เลือกนักศึกษาอย่างน้อย 1 คน");
      try { await api("enroll", { courseId: d.course.id, studentIds: [...picked] }); dlg.close(); toast(`เพิ่ม ${picked.size} คนเข้าวิชาแล้ว`); reload(); } catch (err) { fail(err); }
    });
  };
}

// ======================= นักศึกษา =======================
function importDialog(courseId, done, courses) {
  const dlg = modal({ wide: true, title: "นำเข้ารายชื่อนักศึกษา", body: `
    <p class="small muted">คัดลอกจาก Excel มาวางได้เลย บรรทัดละคน เรียงเป็น <b>รหัสนักศึกษา · ชื่อ-สกุล · รหัสผ่าน</b> คั่นด้วยแท็บหรือจุลภาค
      ถ้าไม่ใส่รหัสผ่าน ระบบจะใช้รหัสนักศึกษาเป็นรหัสผ่านแรก นักศึกษาต้องเปลี่ยนรหัสใหม่ตอนเข้าครั้งแรก ถ้ารหัสซ้ำกับที่มีอยู่ ระบบจะอัปเดตชื่อให้</p>
    <textarea id="txt" placeholder="6501001	สมชาย ใจดี&#10;6501002	สมหญิง รักเรียน	pass1234"></textarea>
    ${courses ? `<label class="field"><span>เพิ่มเข้ารายวิชา</span><select id="course"><option value="">ไม่เพิ่มเข้ารายวิชา</option>${courses.map(c => `<option value="${c.id}">${esc((c.code ? c.code + " · " : "") + c.title)}</option>`).join("")}</select></label>` : ""}
    <p class="small" id="prev"></p><p class="err" id="err" hidden></p>`,
    foot: `<button class="btn" data-close>ยกเลิก</button><button class="btn primary" id="ok">นำเข้า</button>` });
  const parse = () => $("#txt", dlg).value.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => l.split(/\t|,/).map(x => x.trim()))
    .filter(p => !/^(รหัส|code|id)/i.test(p[0]));
  $("#txt", dlg).oninput = () => { const rows = parse(), bad = rows.filter(p => !p[0] || !p[1]).length;
    $("#prev", dlg).innerHTML = rows.length ? `พบ <b>${rows.length - bad}</b> รายชื่อ${bad ? ` · <span style="color:var(--danger)">${bad} บรรทัดไม่ครบ จะถูกข้าม</span>` : ""}` : ""; };
  $("#ok", dlg).onclick = e => busy(e.currentTarget, async () => {
    const rows = parse().filter(p => p[0] && p[1]).map(p => ({ code: p[0], name: p[1], password: p[2] || "" }));
    if (!rows.length) { $("#err", dlg).textContent = "ยังไม่มีรายชื่อที่ถูกต้อง"; $("#err", dlg).hidden = false; return; }
    try { const r = await api("importStudents", { rows, courseId: courseId || +($("#course", dlg)?.value) || null });
      dlg.close(); toast(`เพิ่มใหม่ ${r.added} คน · อัปเดต ${r.updated} คน`); done(); }
    catch (err) { $("#err", dlg).textContent = err.message; $("#err", dlg).hidden = false; }
  });
  $("#txt", dlg).focus();
}

async function viewStudents() {
  shell("students", head("นักศึกษา") + spinner);
  let S, C; try { [S, C] = await Promise.all([api("students"), api("courses")]); } catch (e) { return fail(e); }
  const students = S.students, courses = C.courses, cname = new Map(courses.map(c => [c.id, c.code || c.title]));
  const sel = new Set();
  $("#main").innerHTML = head("นักศึกษา", `ทั้งหมด ${students.length} คน`, `<button class="btn primary" id="imp">${icon.plus} นำเข้ารายชื่อ</button>`) + `
    <section class="card"><div class="card-head"><div class="row grow"><input id="q" placeholder="ค้นหาชื่อหรือรหัส" style="max-width:280px">
        <select id="fc" style="max-width:220px"><option value="">ทุกรายวิชา</option>${courses.map(c => `<option value="${c.id}">${esc(c.code || c.title)}</option>`).join("")}</select></div>
        <button class="btn danger" id="delSel" hidden>${icon.trash} ลบที่เลือก</button></div>
      <div class="table-wrap"><table><thead><tr><th style="width:36px"><input type="checkbox" id="selAll" aria-label="เลือกทั้งหมด"></th><th>รหัส</th><th>ชื่อ-สกุล</th><th>รายวิชา</th><th>สถานะบัญชี</th><th>เข้าล่าสุด</th><th></th></tr></thead>
      <tbody id="tb"></tbody></table></div></section>`;
  const filtered = () => { const q = $("#q").value.trim().toLowerCase(), fc = +$("#fc").value;
    return students.filter(s => (!q || (s.code + " " + s.name).toLowerCase().includes(q)) && (!fc || s.courses.includes(fc))); };
  const draw = () => {
    const rows = filtered();
    $("#tb").innerHTML = rows.map(s => `<tr><td><input type="checkbox" data-sel="${s.id}" ${sel.has(s.id) ? "checked" : ""} aria-label="เลือก ${esc(s.name)}"></td>
      <td class="mono">${esc(s.code)}</td><td>${esc(s.name)}</td><td>${s.courses.map(id => `<span class="chip">${esc(cname.get(id) || "")}</span>`).join("") || '<span class="muted small">–</span>'}</td>
      <td>${s.must_change ? '<span class="badge warn">ยังไม่ตั้งรหัสใหม่</span>' : '<span class="badge ok">พร้อมใช้งาน</span>'} ${s.consent_at ? '<span class="badge" title="ยินยอม PDPA แล้ว">ยินยอมแล้ว</span>' : ""}</td>
      <td class="small muted">${s.last_login ? ago(s.last_login) : "ยังไม่เคยเข้า"}</td>
      <td style="text-align:right;white-space:nowrap"><button class="btn sm" data-edit="${s.id}">${icon.edit} แก้ไข</button></td></tr>`).join("")
      || `<tr><td colspan="7">${emptyBox(icon.users, students.length ? "ไม่พบรายชื่อที่ค้นหา" : "ยังไม่มีนักศึกษา", students.length ? "ลองเปลี่ยนคำค้นหา" : "กด \"นำเข้ารายชื่อ\" แล้ววางรายชื่อจาก Excel ได้เลย")}</td></tr>`;
    $$("[data-sel]").forEach(c => c.onchange = () => { c.checked ? sel.add(+c.dataset.sel) : sel.delete(+c.dataset.sel); tool(); });
    $$("[data-edit]").forEach(b => b.onclick = () => editStudent(students.find(s => s.id === +b.dataset.edit)));
    tool();
  };
  const tool = () => { $("#delSel").hidden = !sel.size; $("#delSel").innerHTML = `${icon.trash} ลบที่เลือก (${sel.size})`; };
  $("#q").oninput = draw; $("#fc").onchange = draw;
  $("#selAll").onchange = e => { filtered().forEach(s => e.target.checked ? sel.add(s.id) : sel.delete(s.id)); draw(); };
  $("#imp").onclick = () => importDialog(null, viewStudents, courses);
  $("#delSel").onclick = async () => {
    if (!await confirmBox(`ลบนักศึกษา ${sel.size} คน?`, "ผลการเรียนและภาพยืนยันตัวตนของนักศึกษาที่เลือกจะถูกลบถาวร", "ลบถาวร", true)) return;
    try { await api("deleteStudents", { ids: [...sel] }); toast("ลบแล้ว"); viewStudents(); } catch (e) { fail(e); }
  };
  draw();

  function editStudent(s) {
    const dlg = modal({ title: "แก้ไขข้อมูลนักศึกษา", body: `
      <label class="field"><span>รหัสนักศึกษา</span><input value="${esc(s.code)}" disabled></label>
      <label class="field"><span>ชื่อ-สกุล</span><input id="name" value="${esc(s.name)}"></label>
      <div class="card card-pad stack-sm" style="box-shadow:none;background:var(--surface-2)"><b>รีเซ็ตรหัสผ่าน</b>
        <p class="small muted">ใช้เมื่อนักศึกษาลืมรหัส ถ้าไม่ใส่ รหัสผ่านจะกลับเป็นรหัสนักศึกษา และนักศึกษาต้องตั้งรหัสใหม่ตอนเข้าครั้งถัดไป</p>
        <div class="row"><input id="pw" placeholder="รหัสผ่านชั่วคราว (ไม่ใส่ก็ได้)" class="grow" style="flex:1 1 200px"><button class="btn" id="reset">${icon.key} รีเซ็ต</button></div></div>`,
      foot: `<button class="btn" data-close>ปิด</button><button class="btn primary" id="save">บันทึกชื่อ</button>` });
    $("#save", dlg).onclick = e => busy(e.currentTarget, async () => { try { await api("updateStudent", { id: s.id, name: $("#name", dlg).value }); dlg.close(); toast("บันทึกแล้ว"); viewStudents(); } catch (err) { fail(err); } });
    $("#reset", dlg).onclick = e => busy(e.currentTarget, async () => {
      try { await api("updateStudent", { id: s.id, resetPassword: true, password: $("#pw", dlg).value });
        toast(`รีเซ็ตแล้ว รหัสผ่านชั่วคราวคือ ${$("#pw", dlg).value || s.code}`); s.must_change = true; } catch (err) { fail(err); }
    });
  }
}

// ======================= รายงาน =======================
async function viewReports(courseId) {
  shell("reports", head("รายงานผลการเรียน") + spinner);
  let C; try { C = (await api("courses")).courses; } catch (e) { return fail(e); }
  if (!C.length) { $("#main").innerHTML = head("รายงานผลการเรียน") + `<div class="card">${emptyBox(icon.chart, "ยังไม่มีรายวิชา", "สร้างรายวิชาและบทเรียนก่อน รายงานจะขึ้นที่นี่", `<a class="btn primary" href="#/courses">สร้างรายวิชา</a>`)}</div>`; return; }
  if (!courseId || !C.some(c => c.id === courseId)) courseId = C[0].id;
  let R; try { R = await api("report", { courseId }); } catch (e) { return fail(e); }
  const assignedTo = (ch, sid) => ch.students === null || ch.students.includes(sid);
  const prog = new Map(R.progress.map(p => [p.student_id + ":" + p.chapter_id, p]));
  let full = 0, need = 0, done = 0;
  const rows = R.students.map(s => {
    let n = 0, dn = 0;
    const cells = R.chapters.map(ch => {
      if (!assignedTo(ch, s.id)) return '<td class="na">·</td>';
      n++; const p = prog.get(s.id + ":" + ch.id), pc = p ? pct(p.max_pos, p.duration) : 0;
      if (p?.completed_at) dn++;
      const flag = p?.flagged ? '<span class="flag" title="มีภาพที่ควรตรวจ"></span>' : "";
      const late = ch.due_at && !p?.completed_at && new Date(ch.due_at) < Date.now();
      return `<td><button class="cell ${p?.completed_at ? "ok" : pc ? "mid" : "none"}" data-s="${s.id}" data-c="${ch.id}">${p?.completed_at ? "✓" : pc ? pc + "%" : late ? '<span style="color:var(--danger)">เลย</span>' : "–"}${flag}</button></td>`;
    }).join("");
    need += n; done += dn; if (n && dn === n) full++;
    return `<tr><td class="mono sticky-col">${esc(s.code)}</td><td>${esc(s.name)}</td>${cells}<td class="num"><b class="${n && dn === n ? "" : ""}" style="color:${n && dn === n ? "var(--ok)" : "inherit"}">${dn}/${n}</b></td></tr>`;
  }).join("");
  $("#main").innerHTML = head("รายงานผลการเรียน", "กดที่ช่องไหนก็ได้ เพื่อดูรายละเอียดและภาพยืนยันตัวตนของนักศึกษาคนนั้นในบทนั้น",
      `<select id="course" style="width:auto;max-width:320px">${C.map(c => `<option value="${c.id}" ${c.id === courseId ? "selected" : ""}>${esc((c.code ? c.code + " · " : "") + c.title)}</option>`).join("")}</select>
       <button class="btn primary" id="csv">${icon.download} ดาวน์โหลด Excel</button>`) + `
    <section class="kpis">
      <div class="card kpi"><span class="tiny">นักศึกษาในรายวิชา</span><b>${R.students.length}</b></div>
      <div class="card kpi"><span class="tiny">เรียนครบทุกบทแล้ว</span><b>${full}</b><span class="tiny">${pct(full, R.students.length)}% ของห้อง</span></div>
      <div class="card kpi"><span class="tiny">งานที่ผ่านแล้ว</span><b>${pct(done, need)}%</b>${bar(pct(done, need))}<span class="tiny">${done} จาก ${need}</span></div>
    </section>
    <section class="card">${R.students.length && R.chapters.length ? `<div class="table-wrap"><table class="matrix"><thead><tr><th class="sticky-col">รหัส</th><th>ชื่อ-สกุล</th>
        ${R.chapters.map((c, i) => `<th title="${esc(c.title)}">บท ${i + 1}${c.due_at ? `<br><span class="tiny muted" style="font-weight:400">${date(c.due_at)}</span>` : ""}</th>`).join("")}<th class="num">ผ่าน</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="card-body tiny muted row" style="gap:14px"><span>✓ ผ่านแล้ว</span><span style="color:var(--warn)">% กำลังเรียน</span><span>– ยังไม่เริ่ม</span><span style="color:var(--danger)">เลย = เกินกำหนดแล้วยังไม่ผ่าน</span><span>· ไม่ได้มอบหมาย</span><span><span class="flag" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--danger)"></span> มีภาพที่ควรตรวจ</span></div>`
      : emptyBox(icon.chart, "ยังไม่มีข้อมูล", R.chapters.length ? "ยังไม่มีนักศึกษาในรายวิชานี้" : "รายวิชานี้ยังไม่มีบทเรียน")}</section>`;
  $("#course").onchange = e => location.hash = `#/reports/${e.target.value}`;
  $$(".cell").forEach(b => b.onclick = () => detail(R.students.find(s => s.id === +b.dataset.s), R.chapters.find(c => c.id === +b.dataset.c), prog.get(b.dataset.s + ":" + b.dataset.c)));
  $("#csv").onclick = () => {
    const out = [["รหัสนักศึกษา", "ชื่อ-สกุล", "บทที่", "ชื่อบท", "กำหนดส่ง", "ดูถึง (%)", "เวลาที่ดูจริง (นาที)", "ลุกออกจากจอ (ครั้ง)", "ภาพยืนยัน", "ภาพที่ควรตรวจ", "สถานะ", "ผ่านเมื่อ", "อัปเดตล่าสุด"]];
    R.chapters.forEach((ch, i) => R.students.filter(s => assignedTo(ch, s.id)).forEach(s => {
      const p = prog.get(s.id + ":" + ch.id) || {};
      out.push([s.code, s.name, i + 1, ch.title, ch.due_at ? dateTime(ch.due_at) : "", pct(p.max_pos, p.duration), Math.round((p.watched || 0) / 6) / 10, p.away || 0, p.snaps || 0, p.flagged || 0,
        p.completed_at ? "ผ่าน" : p.max_pos ? "กำลังเรียน" : "ยังไม่เริ่ม", p.completed_at ? dateTime(p.completed_at) : "", p.updated_at ? dateTime(p.updated_at) : ""]);
    }));
    const csv = "﻿" + out.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `รายงาน-${R.course.code || R.course.id}-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove();
  };
}

async function detail(s, ch, p) {
  const dlg = modal({ wide: true, title: `${s.name} · ${ch.title}`, body: `
    <div class="kpis">
      <div class="card kpi"><span class="tiny">ดูถึง</span><b>${p ? pct(p.max_pos, p.duration) : 0}%</b><span class="tiny">${p ? dur(p.max_pos) + " / " + dur(p.duration) : "ยังไม่เริ่ม"}</span></div>
      <div class="card kpi"><span class="tiny">เวลาที่ดูจริง</span><b>${p ? Math.round(p.watched / 60) : 0}</b><span class="tiny">นาที</span></div>
      <div class="card kpi"><span class="tiny">ลุกออกจากจอ</span><b>${p?.away || 0}</b><span class="tiny">ครั้ง</span></div>
      <div class="card kpi"><span class="tiny">สถานะ</span><b style="font-size:1.1rem;font-family:var(--font)">${p?.completed_at ? '<span class="badge ok">ผ่านแล้ว</span>' : p ? '<span class="badge accent">กำลังเรียน</span>' : '<span class="badge">ยังไม่เริ่ม</span>'}</b>
        <span class="tiny">${p?.completed_at ? "ผ่านเมื่อ " + dateTime(p.completed_at) : p ? "ล่าสุด " + ago(p.updated_at) : ""}</span></div></div>
    <h3>ภาพยืนยันตัวตน</h3><div id="shots">${spinner}</div>` });
  try { const r = await api("snapshots", { studentId: s.id, chapterId: ch.id }); $("#shots", dlg).innerHTML = shotsGrid(r.snapshots, false); bindZoom(dlg); }
  catch (e) { $("#shots", dlg).innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}

// ======================= ภาพยืนยันตัวตน =======================
const KIND = { start: ["เริ่มเรียน", ""], interval: ["ตามรอบเวลา", ""], noface: ["ไม่พบใบหน้า", "danger"], multi: ["พบหลายคน", "warn"] };
function shotsGrid(list, who = true) {
  if (!list.length) return emptyBox(icon.camera, "ยังไม่มีภาพ", "ภาพจะถูกบันทึกเมื่อนักศึกษาเปิดกล้องและเริ่มเรียน");
  return `<div class="shots">${list.map(x => `<figure class="card shot" style="margin:0"><img src="${x.image}" alt="ภาพของ ${esc(x.name)} เวลา ${esc(dateTime(x.taken_at))}" loading="lazy">
    <div>${who ? `<b>${esc(x.name)}</b><span class="mono tiny muted">${esc(x.code)} · ${esc(x.chapter)}</span>` : ""}
      <span class="row" style="gap:6px"><span class="badge ${KIND[x.kind]?.[1] || ""}">${KIND[x.kind]?.[0] || x.kind}</span><span class="tiny muted">${dateTime(x.taken_at)}</span></span></div></figure>`).join("")}</div>`;
}
function bindZoom(root) {
  $$(".shot img", root).forEach(img => img.onclick = () => modal({ wide: true, title: img.alt, body: `<img src="${img.src}" alt="" style="width:100%;border-radius:8px">` }));
}

async function viewPhotos() {
  shell("photos", head("ภาพยืนยันตัวตน") + spinner);
  let C; try { C = (await api("courses")).courses; } catch (e) { return fail(e); }
  $("#main").innerHTML = head("ภาพยืนยันตัวตน", "ภาพนิ่งที่ระบบถ่ายระหว่างเรียน ใช้ตรวจว่าเป็นนักศึกษาตัวจริง แสดงล่าสุด 120 ภาพ") + `
    <div class="card card-pad row"><select id="fc" style="max-width:260px"><option value="">ทุกรายวิชา</option>${C.map(c => `<option value="${c.id}">${esc(c.code || c.title)}</option>`).join("")}</select>
      <label class="check" style="align-items:center"><input type="checkbox" id="flag" checked> เฉพาะภาพที่ควรตรวจ (ไม่พบหน้า / พบหลายคน)</label></div>
    <div id="grid">${spinner}</div>`;
  const load = async () => {
    $("#grid").innerHTML = spinner;
    try { const r = await api("snapshots", { courseId: +$("#fc").value || null, flaggedOnly: $("#flag").checked }); $("#grid").innerHTML = shotsGrid(r.snapshots); bindZoom($("#grid")); }
    catch (e) { fail(e); }
  };
  $("#fc").onchange = load; $("#flag").onchange = load; load();
}

// ======================= ตั้งค่า =======================
async function viewSettings() {
  shell("settings", head("ตั้งค่า") + spinner);
  let A; try { A = (await api("admins")).admins; } catch (e) { return fail(e); }
  const s = SETTINGS;
  $("#main").innerHTML = head("ตั้งค่า", "ปรับข้อมูลระบบ เกณฑ์การเรียน และบัญชีผู้ดูแล") + `
    <form class="card" id="gen"><div class="card-head"><h2>ข้อมูลทั่วไปและเกณฑ์การเรียน</h2></div><div class="card-body form-grid">
      <label class="field"><span>ชื่อระบบ</span><input id="siteName" value="${esc(s.siteName)}"></label>
      <label class="field"><span>ชื่อสถาบัน / หน่วยงาน</span><input id="institution" value="${esc(s.institution)}" placeholder="เช่น คณะวิทยาศาสตร์ มหาวิทยาลัย..."></label>
      <label class="field"><span>เกณฑ์ผ่าน (% ของความยาววิดีโอ)</span><input id="passPct" type="number" min="10" max="100" value="${s.passPct}"></label>
      <label class="field"><span>ถ่ายภาพยืนยันตัวตนทุกกี่นาที</span><input id="snapshotMinutes" type="number" min="1" max="60" value="${s.snapshotMinutes}"></label>
      <label class="field full"><span>Google API key สำหรับเล่นไฟล์จาก Google Drive</span><input id="driveApiKey" value="${esc(s.driveApiKey)}" placeholder="AIza..." autocomplete="off">
        <small>จำเป็นสำหรับไฟล์ใหญ่เกิน 100 MB ขอได้ฟรี: เข้า <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener">Google Cloud Console</a> → สร้างโปรเจกต์ → Enable "Google Drive API" → Credentials → Create credentials → API key แล้วกด Restrict ให้ใช้ได้เฉพาะ Google Drive API</small></label>
      <div class="full row"><button class="btn primary" id="saveGen">บันทึกการตั้งค่า</button></div></div></form>

    <section class="card"><div class="card-head"><h2>บัญชีผู้ดูแลระบบ</h2><button class="btn" id="addA">${icon.plus} เพิ่มผู้ดูแล</button></div>
      <div class="table-wrap"><table><thead><tr><th>ชื่อ</th><th>ชื่อผู้ใช้</th><th>สร้างเมื่อ</th><th></th></tr></thead><tbody>
      ${A.map(a => `<tr><td>${esc(a.name)} ${a.id === ME.id ? '<span class="badge accent">คุณ</span>' : ""}</td><td class="mono">${esc(a.username)}</td><td class="small muted">${date(a.created_at)}</td>
        <td style="text-align:right">${a.id === ME.id ? `<button class="btn sm" id="myPw">${icon.key} เปลี่ยนรหัสผ่าน</button>` : `<button class="btn sm danger" data-rm="${a.id}">นำออก</button>`}</td></tr>`).join("")}</tbody></table></div></section>

    <section class="card"><div class="card-head"><h2>ข้อมูลส่วนบุคคล (PDPA)</h2></div><div class="card-body stack-sm">
      <p class="small muted">ภาพยืนยันตัวตนเป็นข้อมูลส่วนบุคคล ควรลบเมื่อหมดความจำเป็น เช่น หลังประกาศผลการเรียนของภาคเรียนนั้น</p>
      <div class="row"><span>ลบภาพที่เก่ากว่า</span><input id="days" type="number" min="1" value="180" style="width:100px"><span>วัน</span><button class="btn danger" id="purge">${icon.trash} ลบภาพเก่า</button></div></div></section>`;

  $("#gen").onsubmit = e => { e.preventDefault(); busy($("#saveGen"), async () => {
    const settings = {}; ["siteName", "institution", "passPct", "snapshotMinutes", "driveApiKey"].forEach(k => settings[k] = $("#" + k).value.trim());
    try { SETTINGS = (await api("saveSettings", { settings })).settings; toast("บันทึกการตั้งค่าแล้ว"); viewSettings(); } catch (err) { fail(err); }
  }); };
  $("#myPw").onclick = () => {
    const dlg = modal({ title: "เปลี่ยนรหัสผ่าน", body: `<label class="field"><span>รหัสผ่านปัจจุบัน</span><input id="o" type="password" autocomplete="current-password"></label>
      <label class="field"><span>รหัสผ่านใหม่</span><input id="n" type="password" autocomplete="new-password"><small>อย่างน้อย 8 ตัวอักษร</small></label><p class="err" id="err" hidden></p>`,
      foot: `<button class="btn" data-close>ยกเลิก</button><button class="btn primary" id="ok">บันทึก</button>` });
    $("#ok", dlg).onclick = e => busy(e.currentTarget, async () => { try { await api("adminPassword", { old: $("#o", dlg).value, password: $("#n", dlg).value }); dlg.close(); toast("เปลี่ยนรหัสผ่านแล้ว"); }
      catch (err) { $("#err", dlg).textContent = err.message; $("#err", dlg).hidden = false; } });
  };
  $("#addA").onclick = () => {
    const dlg = modal({ title: "เพิ่มผู้ดูแลระบบ", body: `<p class="small muted">ผู้ดูแลทุกคนจัดการได้ทุกอย่าง รวมถึงดูภาพยืนยันตัวตน</p>
      <label class="field"><span>ชื่อที่แสดง</span><input id="nm"></label><label class="field"><span>ชื่อผู้ใช้ (ภาษาอังกฤษ)</span><input id="us"></label>
      <label class="field"><span>รหัสผ่าน</span><input id="pw" type="password" autocomplete="new-password"><small>อย่างน้อย 8 ตัวอักษร</small></label><p class="err" id="err" hidden></p>`,
      foot: `<button class="btn" data-close>ยกเลิก</button><button class="btn primary" id="ok">เพิ่ม</button>` });
    $("#ok", dlg).onclick = e => busy(e.currentTarget, async () => { try { await api("addAdmin", { name: $("#nm", dlg).value, username: $("#us", dlg).value, password: $("#pw", dlg).value }); dlg.close(); toast("เพิ่มผู้ดูแลแล้ว"); viewSettings(); }
      catch (err) { $("#err", dlg).textContent = err.message; $("#err", dlg).hidden = false; } });
  };
  $$("[data-rm]").forEach(b => b.onclick = async () => {
    if (!await confirmBox("นำผู้ดูแลออก?", "บัญชีนี้จะเข้าหน้าแอดมินไม่ได้อีก", "นำออก", true)) return;
    try { await api("removeAdmin", { id: +b.dataset.rm }); toast("นำออกแล้ว"); viewSettings(); } catch (e) { fail(e); }
  });
  $("#purge").onclick = async () => {
    const days = +$("#days").value || 180;
    if (!await confirmBox("ลบภาพเก่า?", `ภาพยืนยันตัวตนที่เก่ากว่า ${days} วันจะถูกลบถาวร`, "ลบภาพ", true)) return;
    try { const r = await api("deleteSnapshots", { olderThanDays: days }); toast(`ลบแล้ว ${r.deleted} ภาพ`); } catch (e) { fail(e); }
  };
}

boot();
})();
