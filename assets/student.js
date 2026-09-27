const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const { $, esc, api, beacon, dur, minutes, dateTime, due, pct, ytId, driveId, toast, busy, modal, icon, spinner, bar } = LR;
const app = $("#app");
let ME = null;          // { student, settings, courses }

// ======================= เริ่มต้น / เส้นทาง =======================
async function boot() {
  try { ME = await api("me"); }
  catch (e) { if (e.status === 401) return renderLogin(); return renderFatal(e.message); }
  document.title = ME.settings.siteName;
  if (ME.student.mustChange) return renderForcePassword();
  if (/^#\/learn\//.test(location.hash)) route(); else renderHome();
}
window.addEventListener("hashchange", () => ME && !ME.student.mustChange && route());

async function route() {
  const m = location.hash.match(/^#\/learn\/(\d+)/);
  leavePlayer();
  if (m) return renderPlayer(Number(m[1]));
  try { ME = await api("me"); } catch (e) { if (e.status === 401) return renderLogin(); }
  renderHome();
}

function renderFatal(msg) {
  app.innerHTML = `<div class="auth"><div class="card auth-card"><div class="empty">${icon.alert}<b>เปิดระบบไม่ได้</b><span>${esc(msg)}</span>
    <button class="btn primary" onclick="location.reload()">ลองอีกครั้ง</button></div></div></div>`;
}

function brand(s) {
  return `<div class="brand"><div class="brand-mark">${icon.logo}</div><div><b>${esc(s.siteName)}</b>${s.institution ? `<small>${esc(s.institution)}</small>` : ""}</div></div>`;
}

// ======================= เข้าสู่ระบบ =======================
async function renderLogin() {
  let meta = { siteName: "ห้องเรียนออนไลน์", institution: "" };
  try { meta = await api("meta"); } catch {}
  document.title = meta.siteName;
  app.innerHTML = `<div class="auth"><form class="card auth-card" id="f">
      ${brand(meta)}
      <div class="stack-sm"><h1>เข้าสู่ระบบ</h1><p class="muted small">ใช้รหัสนักศึกษาและรหัสผ่านที่ได้รับจากอาจารย์</p></div>
      <label class="field"><span>รหัสนักศึกษา</span><input id="code" autocomplete="username" inputmode="text" required></label>
      <label class="field"><span>รหัสผ่าน</span><input id="pw" type="password" autocomplete="current-password" required>
        <small>เข้าครั้งแรก รหัสผ่านคือรหัสนักศึกษา ถ้าอาจารย์ไม่ได้แจ้งเป็นอย่างอื่น</small></label>
      <p class="err" id="err" hidden></p>
      <button class="btn primary" id="go">เข้าสู่ระบบ</button>
    </form></div>`;
  $("#f").onsubmit = e => { e.preventDefault(); busy($("#go"), async () => {
    $("#err").hidden = true;
    try { await api("studentLogin", { code: $("#code").value.trim(), password: $("#pw").value }); await boot(); }
    catch (err) { $("#err").textContent = err.message; $("#err").hidden = false; }
  }); };
  $("#code").focus();
}

function passwordForm(forced) {
  return `<label class="field"><span>รหัสผ่านปัจจุบัน</span><input id="old" type="password" autocomplete="current-password" required></label>
    <label class="field"><span>รหัสผ่านใหม่</span><input id="npw" type="password" autocomplete="new-password" minlength="6" required><small>อย่างน้อย 6 ตัวอักษร</small></label>
    <label class="field"><span>ยืนยันรหัสผ่านใหม่</span><input id="npw2" type="password" autocomplete="new-password" required></label>
    <p class="err" id="perr" hidden></p>`;
}
async function submitPassword(root) {
  const err = $("#perr", root); err.hidden = true;
  const pw = $("#npw", root).value;
  if (pw !== $("#npw2", root).value) { err.textContent = "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน"; err.hidden = false; return false; }
  try { await api("studentPassword", { old: $("#old", root).value, password: pw }); return true; }
  catch (e) { err.textContent = e.message; err.hidden = false; return false; }
}

function renderForcePassword() {
  app.innerHTML = `<div class="auth"><form class="card auth-card" id="f">
      ${brand(ME.settings)}
      <div class="stack-sm"><h1>ตั้งรหัสผ่านใหม่</h1><p class="muted small">เพื่อความปลอดภัยของบัญชี ต้องเปลี่ยนรหัสผ่านก่อนเริ่มเรียนครั้งแรก</p></div>
      ${passwordForm(true)}
      <div class="row between"><button type="button" class="btn ghost" id="out">ออกจากระบบ</button><button class="btn primary" id="go">บันทึกรหัสผ่าน</button></div>
    </form></div>`;
  $("#out").onclick = logout;
  $("#f").onsubmit = e => { e.preventDefault(); busy($("#go"), async () => { if (await submitPassword(app)) { toast("เปลี่ยนรหัสผ่านแล้ว"); await boot(); } }); };
}

async function logout() {
  leavePlayer(); stopCamera();
  try { await api("studentLogout"); } catch {}
  ME = null; location.hash = ""; renderLogin();
}

// ======================= โครงหน้า =======================
function shell(inner) {
  const s = ME.student;
  app.innerHTML = `<header class="topbar"><div class="topbar-in">
      <a href="#/" style="text-decoration:none;color:inherit">${brand(ME.settings)}</a>
      <div class="userbtn">
        <div class="avatar" aria-hidden="true">${esc(s.name.trim().charAt(0))}</div>
        <div class="small who" style="line-height:1.3"><b>${esc(s.name)}</b><br><span class="muted mono tiny">${esc(s.code)}</span></div>
        <button class="btn ghost icon" id="pwBtn" title="เปลี่ยนรหัสผ่าน" aria-label="เปลี่ยนรหัสผ่าน">${icon.key}</button>
        <button class="btn ghost icon" id="outBtn" title="ออกจากระบบ" aria-label="ออกจากระบบ">${icon.logout}</button>
      </div></div></header><main id="main">${inner}</main>`;
  $("#outBtn").onclick = logout;
  $("#pwBtn").onclick = () => {
    const dlg = modal({ title: "เปลี่ยนรหัสผ่าน", body: passwordForm(false),
      foot: `<button class="btn" data-close>ยกเลิก</button><button class="btn primary" id="savePw">บันทึก</button>` });
    $("#savePw", dlg).onclick = e => busy(e.currentTarget, async () => { if (await submitPassword(dlg)) { dlg.close(); toast("เปลี่ยนรหัสผ่านแล้ว"); } });
  };
}

// ======================= หน้าแรก =======================
function renderHome() {
  const all = ME.courses.flatMap(c => c.chapters);
  const done = all.filter(c => c.completedAt).length;
  const overdue = all.filter(c => !c.completedAt && c.dueAt && new Date(c.dueAt) < Date.now()).length;
  const soon = all.filter(c => !c.completedAt && c.dueAt && new Date(c.dueAt) >= Date.now() && new Date(c.dueAt) - Date.now() < 3 * 864e5).length;
  const next = all.find(c => !c.completedAt && !c.locked);
  const firstName = ME.student.name.trim().split(/\s+/)[0];

  shell(`
    <section class="hello">
      <div class="stack-sm"><p class="eyebrow">บทเรียนของฉัน</p><h1>สวัสดี ${esc(firstName)}</h1>
        <p class="muted">${all.length ? `ผ่านแล้ว ${done} จาก ${all.length} บท` : "ยังไม่มีบทเรียนที่ต้องเรียนตอนนี้"}</p></div>
      ${next ? `<a class="btn primary" href="#/learn/${next.id}">${icon.play} ${next.watched ? "เรียนต่อ" : "เริ่มเรียน"}: ${esc(next.title)}</a>` : ""}
    </section>
    ${all.length ? `<section class="kpis three">
      <div class="card kpi"><span class="tiny">ผ่านแล้ว</span><b>${done}<span class="muted" style="font-size:1rem"> / ${all.length}</span></b>${bar(pct(done, all.length), done === all.length)}</div>
      <div class="card kpi"><span class="tiny">ใกล้ครบกำหนด (3 วัน)</span><b style="color:${soon ? "var(--warn)" : "inherit"}">${soon}</b><span class="tiny">บท</span></div>
      <div class="card kpi"><span class="tiny">เกินกำหนด</span><b style="color:${overdue ? "var(--danger)" : "inherit"}">${overdue}</b><span class="tiny">บท</span></div>
    </section>` : ""}
    ${ME.courses.map(courseCard).join("") || `<div class="card"><div class="empty">${icon.book}<b>ยังไม่มีรายวิชา</b><span>เมื่ออาจารย์เพิ่มคุณเข้ารายวิชา บทเรียนจะขึ้นที่นี่</span></div></div>`}
  `);
}

function courseCard(c) {
  const n = c.chapters.length, d = c.chapters.filter(x => x.completedAt).length;
  return `<section class="card">
    <div class="course-head"><div class="stack-sm" style="gap:2px">${c.code ? `<span class="eyebrow">${esc(c.code)}</span>` : ""}<h2>${esc(c.title)}</h2>
      ${c.description ? `<p class="muted small">${esc(c.description)}</p>` : ""}</div>
      <div class="stack-sm" style="gap:4px;justify-items:end"><span class="small muted">ผ่าน ${d}/${n} บท</span>${bar(pct(d, n), d === n && n)}</div></div>
    ${c.chapters.map(lessonRow).join("")}
  </section>`;
}

function lessonRow(ch, i) {
  const p = pct(ch.maxPos, ch.duration), done = !!ch.completedAt;
  const status = done ? `<span class="badge ok">${icon.check.replace("<svg", '<svg width="12" height="12"')} ผ่านแล้ว</span>`
    : ch.locked ? `<span class="badge">${icon.lock.replace("<svg", '<svg width="12" height="12"')} ต้องผ่านบทก่อนหน้า</span>`
    : p ? `<span class="badge accent">กำลังเรียน</span>` : "";
  const action = ch.locked ? `<button class="btn sm" disabled>${icon.lock} ล็อกอยู่</button>`
    : `<a class="btn sm ${done ? "" : "primary"}" href="#/learn/${ch.id}">${done ? "ดูซ้ำ" : p ? "เรียนต่อ" : "เริ่มเรียน"}</a>`;
  return `<div class="lesson ${ch.locked ? "locked" : ""}">
    <div class="lnum ${done ? "done" : p ? "doing" : ""}">${done ? icon.check : ch.locked ? icon.lock : i + 1}</div>
    <div style="min-width:0"><b>${esc(ch.title)}</b>
      ${ch.description ? `<p class="muted small">${esc(ch.description)}</p>` : ""}
      <div class="lmeta">${status}${due(ch.dueAt, done)}${ch.duration ? `<span class="tiny muted">ความยาว ${dur(ch.duration)}</span>` : ""}</div></div>
    <div class="lright"><div class="lpct"><span class="tiny muted mono">${p}%</span>${bar(p, done)}</div>${action}</div>
  </div>`;
}

// ======================= กล้อง + ตรวจจับใบหน้า =======================
const CAM = { stream: null, detector: null, lastFace: 0, faces: 0, multiSince: 0, loop: null };
const GRACE = 1500;
const faceSeen = () => !!CAM.stream && performance.now() - CAM.lastFace < GRACE;

async function loadDetector() {
  if (CAM.detector) return CAM.detector;
  const { FaceDetector, FilesetResolver } = await import(MP);
  const fs = await FilesetResolver.forVisionTasks(MP + "/wasm");
  CAM.detector = await FaceDetector.createFromOptions(fs, {
    baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite", delegate: "GPU" },
    runningMode: "VIDEO", minDetectionConfidence: 0.55 });
  return CAM.detector;
}
async function startCamera() {
  if (!CAM.stream) CAM.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
  try { await loadDetector(); }
  catch (e) { console.error(e); stopCamera(); throw Object.assign(new Error("detector"), { name: "DetectorError" }); }
  CAM.lastFace = performance.now();
  attachCamera();
  if (!CAM.loop) detectLoop();
}
function stopCamera() {
  if (CAM.stream) CAM.stream.getTracks().forEach(t => t.stop());
  CAM.stream = null; clearTimeout(CAM.loop); CAM.loop = null; CAM.faces = 0;
}
function attachCamera() { const v = $("#cam"); if (v && CAM.stream && v.srcObject !== CAM.stream) v.srcObject = CAM.stream; }
function detectLoop() {
  const v = $("#cam"), cv = $("#overlay");
  try {
    if (v && CAM.detector && v.readyState >= 2) {
      const r = CAM.detector.detectForVideo(v, performance.now());
      CAM.faces = r.detections.length;
      if (CAM.faces) CAM.lastFace = performance.now();
      CAM.multiSince = CAM.faces > 1 ? (CAM.multiSince || performance.now()) : 0;
      if (cv) {
        cv.width = v.videoWidth; cv.height = v.videoHeight;
        const ctx = cv.getContext("2d"); ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.lineWidth = 3; ctx.strokeStyle = CAM.faces > 1 ? "#f0a94b" : "#3cc29c";
        for (const d of r.detections) { const b = d.boundingBox; ctx.strokeRect(b.originX, b.originY, b.width, b.height); }
      }
    }
  } catch (e) { console.warn(e); }
  CAM.loop = setTimeout(detectLoop, 200);
}
function grabFrame() {
  const v = $("#cam"); if (!v || v.readyState < 2) return null;
  const c = document.createElement("canvas"); c.width = 320; c.height = 240;
  c.getContext("2d").drawImage(v, 0, 0, 320, 240);
  return c.toDataURL("image/jpeg", 0.6);
}

// ======================= หน้าเรียน =======================
let P = null;   // สถานะของบทที่กำลังเรียน
let yt = null, ytReady = null;

async function renderPlayer(id) {
  shell(spinner);
  let info;
  try { info = await api("startChapter", { chapterId: id }); }
  catch (e) { shell(`<div class="card"><div class="empty">${icon.lock}<b>เปิดบทนี้ไม่ได้</b><span>${esc(e.message)}</span><a class="btn" href="#/">กลับหน้าบทเรียน</a></div></div>`); return; }
  const ch = info.chapter;
  P = { id, info, maxPos: ch.maxPos, watched: ch.watched, duration: ch.duration, away: ch.away, completed: !!ch.completedAt,
        mode: null, autoPaused: false, dirty: false, lastSave: performance.now(), saving: false,
        snapStart: false, lastSnap: 0, lastMulti: 0, awaySince: 0, awayShot: false, lastTick: performance.now() };

  $("#main").innerHTML = `
    <nav class="crumb"><a href="#/">${icon.back.replace("<svg", '<svg width="14" height="14"')} บทเรียนของฉัน</a><span>/</span><span>${esc(info.course.code || info.course.title)}</span></nav>
    <div class="row between"><div class="stack-sm" style="gap:2px"><h1>${esc(ch.title)}</h1>${ch.description ? `<p class="muted">${esc(ch.description)}</p>` : ""}</div>${due(ch.dueAt, P.completed)}</div>
    <div class="player">
      <div class="stack">
        <div class="stage"><video id="vid" playsinline controls controlslist="nodownload noplaybackrate" disablepictureinpicture hidden></video>
          <div id="ytWrap"></div>
          <div class="veil" id="veil">${icon.camera}<div><b id="veilT">เปิดกล้องก่อนเริ่มเรียน</b><span id="veilS">วิดีโอจะเล่นได้เมื่อกล้องเห็นหน้าคุณ</span></div></div></div>
        <div class="card card-pad stack-sm"><h3>กติกาการเรียนบทนี้</h3><ul class="rules">
          <li>ต้องดูให้ถึง ${info.passPct}% ของความยาววิดีโอ ถึงจะนับว่าผ่าน</li>
          <li>ถ้ากล้องไม่เห็นหน้า หรือสลับไปหน้าอื่น วิดีโอจะหยุดเอง และนับเป็นการลุกออกจากจอ</li>
          <li>ย้อนกลับไปดูซ้ำได้ แต่ข้ามไปข้างหน้าหรือเร่งความเร็วไม่ได้</li>
          <li>ระบบจะถ่ายภาพจากกล้องทุก ${info.snapshotMinutes} นาที เพื่อยืนยันว่าเป็นคุณที่เรียนจริง</li>
          <li>ปิดหน้านี้ไปก่อนได้ กลับมาจะเล่นต่อจากจุดที่ดูถึง</li></ul></div>
      </div>
      <aside class="stack">
        <div class="card card-pad stack-sm">
          <div class="row between"><h3>กล้อง</h3><span class="badge" id="camState"><span class="dot"></span>ยังไม่เปิด</span></div>
          <div class="cam"><video id="cam" playsinline muted autoplay></video><canvas id="overlay"></canvas><span class="rec" id="rec" hidden><i></i>กำลังตรวจ</span></div>
          <button class="btn primary" id="camBtn">${icon.camera} เปิดกล้อง</button>
          <p class="tiny muted">ภาพสดประมวลผลในเครื่องของคุณ ระบบเก็บเฉพาะภาพนิ่งยืนยันตัวตนตามรอบเวลาเท่านั้น</p>
        </div>
        <div class="card card-pad stack-sm">
          <div class="row between"><h3>ความคืบหน้า</h3><span class="badge" id="passBadge"></span></div>
          <div id="progBar">${bar(0)}</div>
          <dl class="kv"><dt>ดูถึง</dt><dd id="kPos">0:00</dd><dt>ความยาว</dt><dd id="kDur">–</dd>
            <dt>เวลาที่ดูจริง</dt><dd id="kWatch">0:00</dd><dt>ลุกออกจากจอ</dt><dd id="kAway">0 ครั้ง</dd></dl>
          <p class="tiny muted" id="saveState">บันทึกอัตโนมัติทุก 20 วินาที</p>
        </div>
      </aside>
    </div>`;

  $("#camBtn").onclick = () => requestCamera();
  loadVideo(ch.videoUrl, info.driveApiKey);
  if (CAM.stream && info.consentAt) { await startCamera().catch(() => {}); updateCamUi(); }
  else if (info.consentAt) {
    try { const st = await navigator.permissions.query({ name: "camera" }); if (st.state === "granted") await requestCamera(); } catch {}
  }
}

async function requestCamera() {
  if (!P) return;
  if (!P.info.consentAt && !ME.student.consentAt) { const ok = await askConsent(); if (!ok) return; }
  const btn = $("#camBtn");
  await busy(btn, async () => {
    btn.textContent = "กำลังเปิดกล้อง…";
    try { await startCamera(); updateCamUi(); }
    catch (e) {
      console.error(e);
      toast(e.name === "NotAllowedError" ? "ต้องอนุญาตให้ใช้กล้อง กดไอคอนกล้องที่ช่องที่อยู่เว็บ แล้วเลือก \"อนุญาต\"" :
            e.name === "NotFoundError" ? "ไม่พบกล้องในเครื่องนี้" :
            e.name === "DetectorError" ? "โหลดตัวตรวจจับใบหน้าไม่สำเร็จ ตรวจการเชื่อมต่ออินเทอร์เน็ต แล้วกดเปิดกล้องอีกครั้ง" : "เปิดกล้องไม่ได้ ลองรีเฟรชหน้าแล้วเปิดใหม่", "error");
    }
  });
  updateCamUi();
}

function askConsent() {
  return new Promise(resolve => {
    let ok = false;
    const dlg = modal({ title: "ขอความยินยอมใช้กล้องและเก็บภาพ", body: `<div class="consent">
        <p>ระบบนี้ใช้กล้องเพื่อยืนยันว่าคุณเรียนด้วยตัวเองจริง ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA) เราขอแจ้งว่า</p>
        <ul><li>ภาพสดจากกล้องประมวลผลในเครื่องของคุณ ไม่ได้ส่งออกไปแบบต่อเนื่อง</li>
          <li>ระบบเก็บภาพนิ่งขนาดเล็ก ตอนเริ่มเรียน ทุก ${P.info.snapshotMinutes} นาที และตอนที่ไม่พบใบหน้าหรือพบหลายคน</li>
          <li>ภาพใช้เพื่อยืนยันการเข้าเรียนเท่านั้น ผู้ที่ดูได้คืออาจารย์ผู้สอนและผู้ดูแลระบบ</li>
          <li>ภาพจะถูกลบตามรอบที่ผู้ดูแลระบบกำหนด ถ้าต้องการให้ลบก่อน ติดต่ออาจารย์ผู้สอนได้</li></ul>
        <label class="check"><input type="checkbox" id="agree"> ข้าพเจ้าได้อ่านและยินยอมให้ใช้กล้องและเก็บภาพตามรายละเอียดข้างต้น</label></div>`,
      foot: `<button class="btn" data-close>ไม่ยินยอม</button><button class="btn primary" id="okC" disabled>ยินยอมและเปิดกล้อง</button>`,
      onClose: () => resolve(ok) });
    $("#agree", dlg).onchange = e => { $("#okC", dlg).disabled = !e.target.checked; };
    $("#okC", dlg).onclick = e => busy(e.currentTarget, async () => {
      try { await api("consent"); ME.student.consentAt = P.info.consentAt = new Date().toISOString(); ok = true; dlg.close(); }
      catch (err) { toast(err.message, "error"); }
    });
  });
}

function updateCamUi() {
  if (!$("#camBtn")) return;
  $("#camBtn").hidden = !!CAM.stream;
  $("#rec").hidden = !CAM.stream;
  attachCamera();
}

// ---------- ตัวเล่นวิดีโอ ----------
const player = {
  play() { P?.mode === "yt" ? yt?.playVideo?.() : $("#vid")?.play().catch(() => {}); },
  pause() { P?.mode === "yt" ? yt?.pauseVideo?.() : $("#vid")?.pause(); },
  playing() { if (P?.mode === "yt") return yt?.getPlayerState?.() === 1; const v = $("#vid"); return !!(v && !v.paused && !v.ended); },
  time() { return P?.mode === "yt" ? (yt?.getCurrentTime?.() || 0) : ($("#vid")?.currentTime || 0); },
  duration() { if (P?.mode === "yt") return yt?.getDuration?.() || 0; const v = $("#vid"); return v && isFinite(v.duration) ? v.duration : 0; },
  seek(t) { P?.mode === "yt" ? yt?.seekTo?.(t, true) : ($("#vid").currentTime = t); },
};

function loadVideo(url, key) {
  const y = ytId(url), g = driveId(url);
  if (y) return loadYT(y);
  P.mode = "html";
  const v = $("#vid"); v.hidden = false;
  v.src = g ? (key ? `https://www.googleapis.com/drive/v3/files/${g}?alt=media&key=${encodeURIComponent(key)}` : `https://drive.google.com/uc?export=download&id=${g}`) : url;
  v.addEventListener("loadedmetadata", () => { if (P) { P.duration = v.duration || P.duration; if (P.maxPos > 1 && P.maxPos < v.duration - 2) v.currentTime = P.maxPos; } });
  v.addEventListener("play", () => { if (!faceSeen()) v.pause(); });
  v.addEventListener("seeking", () => { if (P && v.currentTime > P.maxPos + 2) { v.currentTime = P.maxPos; toast("ข้ามไปข้างหน้าไม่ได้ ต้องดูตามลำดับ"); } });
  v.addEventListener("ratechange", () => { if (v.playbackRate > 1) v.playbackRate = 1; });
  v.addEventListener("error", () => {
    if (!v.getAttribute("src")) return;
    toast(g ? (key ? "เปิดไฟล์จาก Google Drive ไม่ได้ ไฟล์ต้องแชร์เป็น \"ทุกคนที่มีลิงก์\" แจ้งอาจารย์ได้เลย"
                   : "เปิดไฟล์จาก Google Drive ไม่ได้ ถ้าไฟล์ใหญ่ อาจารย์ต้องตั้งค่า Google API key ก่อน")
            : "เล่นวิดีโอนี้ไม่ได้ แจ้งอาจารย์ให้ตรวจลิงก์ได้เลย", "error");
  });
}
function loadYT(id) {
  P.mode = "yt";
  if (!ytReady) {
    ytReady = new Promise(r => { window.onYouTubeIframeAPIReady = r; });
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
  }
  $("#ytWrap").innerHTML = '<div id="yt"></div>';
  const mine = P;
  ytReady.then(() => {
    if (P !== mine) return;
    yt = new YT.Player("yt", { videoId: id,
      playerVars: { rel: 0, playsinline: 1, modestbranding: 1, disablekb: 1, start: Math.floor(P.maxPos), origin: location.origin },
      events: {
        onStateChange: e => { if (e.data === 1 && !faceSeen()) yt.pauseVideo(); },
        onPlaybackRateChange: () => { if (yt.getPlaybackRate() > 1) yt.setPlaybackRate(1); },
        onError: () => toast("เล่นวิดีโอ YouTube นี้ไม่ได้ อาจถูกตั้งเป็นส่วนตัวหรือปิดการฝัง แจ้งอาจารย์ได้เลย", "error"),
      } });
  });
}

function leavePlayer() {
  if (!P) return;
  if (P.dirty) beacon("saveProgress", payload());
  try { yt?.destroy?.(); } catch {}
  yt = null; P = null;
  stopCamera();
}
const payload = () => ({ chapterId: P.id, maxPos: P.maxPos, watched: P.watched, duration: P.duration, away: P.away });

async function save() {
  if (!P || P.saving) return;
  const mine = P; mine.saving = true; mine.dirty = false; mine.lastSave = performance.now();
  try {
    const r = await api("saveProgress", payload());
    if (r.progress.completedAt && !mine.completed) { mine.completed = true; toast("ผ่านบทนี้แล้ว เก่งมาก"); }
    const s = $("#saveState"); if (s && P === mine) s.textContent = "บันทึกล่าสุด " + new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    mine.dirty = true;
    if (e.status === 401) return logout();
    const s = $("#saveState"); if (s) s.textContent = "บันทึกไม่สำเร็จ กำลังลองใหม่…";
  }
  mine.saving = false;
}

async function snap(kind) {
  if (!P || !ME.student.consentAt) return;
  const image = grabFrame(); if (!image) return;
  P.lastSnap = Date.now();
  try { await api("snapshot", { chapterId: P.id, image, faces: CAM.faces, kind }); } catch (e) { console.warn(e); }
}

// ---------- ลูปหลัก ----------
setInterval(() => {
  if (!P) return;
  const now = performance.now(), dt = Math.min(1, (now - P.lastTick) / 1000); P.lastTick = now;
  const present = faceSeen() && !document.hidden;
  const playing = player.playing();

  const st = $("#camState");
  if (st && CAM.stream) {
    const multi = CAM.faces > 1;
    st.className = "badge " + (multi ? "warn" : present ? "ok" : "danger");
    st.innerHTML = `<span class="dot"></span>${multi ? `พบ ${CAM.faces} คน` : present ? "เห็นหน้าอยู่" : "ไม่เห็นหน้า"}`;
  }

  if (!present && playing) { player.pause(); P.autoPaused = true; P.away++; P.dirty = true; }
  if (present && P.autoPaused) { P.autoPaused = false; player.play(); }

  const t = player.time(), d = player.duration();
  if (d) P.duration = d;
  if (t > P.maxPos + 2) { player.seek(P.maxPos); toast("ข้ามไปข้างหน้าไม่ได้ ต้องดูตามลำดับ"); }
  else if (playing && present) { P.watched += dt; P.dirty = true; if (t > P.maxPos) P.maxPos = t; }

  // ภาพยืนยันตัวตน
  if (CAM.stream) {
    const wall = Date.now();
    if (present && !P.snapStart) { P.snapStart = true; snap("start"); }
    else if (present && playing && wall - P.lastSnap > P.info.snapshotMinutes * 60000) snap("interval");
    if (CAM.multiSince && now - CAM.multiSince > 3000 && wall - P.lastMulti > 120000) { P.lastMulti = wall; snap("multi"); toast("ตรวจพบมากกว่า 1 คนหน้ากล้อง ระบบบันทึกภาพไว้แล้ว"); }
    if (!present && !document.hidden) { P.awaySince ||= now; if (!P.awayShot && now - P.awaySince > 8000) { P.awayShot = true; snap("noface"); } }
    else { P.awaySince = 0; P.awayShot = false; }
  }

  if (!P.completed && P.duration && P.maxPos >= P.duration * P.info.passPct / 100 - 0.5 && now - P.lastSave > 3000) save();
  else if (P.dirty && now - P.lastSave > 20000) save();

  // UI
  const veil = $("#veil");
  if (veil) {
    veil.hidden = !!CAM.stream && present;
    $("#veilT").textContent = !CAM.stream ? "เปิดกล้องก่อนเริ่มเรียน" : "ไม่เห็นหน้าคุณ";
    $("#veilS").textContent = !CAM.stream ? "กดปุ่ม \"เปิดกล้อง\" ทางขวา วิดีโอจะเล่นได้เมื่อกล้องเห็นหน้าคุณ" : "วิดีโอหยุดไว้ก่อน กลับมาหน้ากล้องแล้วจะเล่นต่อให้";
  }
  const p = pct(P.maxPos, P.duration);
  const pb = $("#progBar"); if (pb) pb.innerHTML = bar(p, P.completed);
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set("#kPos", dur(P.maxPos)); set("#kDur", P.duration ? dur(P.duration) : "–");
  set("#kWatch", dur(P.watched)); set("#kAway", P.away + " ครั้ง");
  const pbg = $("#passBadge");
  if (pbg) { pbg.className = "badge " + (P.completed ? "ok" : "accent"); pbg.textContent = P.completed ? "ผ่านแล้ว" : `${p}% จาก ${P.info.passPct}%`; }
}, 250);

document.addEventListener("visibilitychange", () => {
  if (!P || !document.hidden) return;
  if (player.playing()) { player.pause(); P.autoPaused = true; P.away++; }
  beacon("saveProgress", payload()); P.dirty = false; P.lastSave = performance.now();
});
window.addEventListener("pagehide", () => { if (P) beacon("saveProgress", payload()); });

boot();
