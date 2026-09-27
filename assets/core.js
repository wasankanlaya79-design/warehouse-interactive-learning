/* ตัวช่วยที่ใช้ร่วมกันทั้งหน้านักศึกษาและหน้าแอดมิน */
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function api(action, body = {}) {
    let r;
    try {
      r = await fetch("/api/v1", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }) });
    } catch { throw Object.assign(new Error("เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง"), { status: 0 }); }
    let j = {};
    try { j = await r.json(); } catch {}
    if (!r.ok) throw Object.assign(new Error(j.error || "ระบบขัดข้อง ลองใหม่อีกครั้ง"), { status: r.status });
    return j;
  }
  function beacon(action, body) {
    try { return navigator.sendBeacon("/api/v1", new Blob([JSON.stringify({ action, ...body })], { type: "text/plain" })); }
    catch { return false; }
  }

  // ---------- เวลา ----------
  const pad = n => String(n).padStart(2, "0");
  function dur(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }
  const minutes = sec => `${Math.round((sec || 0) / 60)} นาที`;
  const d = v => (v ? new Date(v) : null);
  const date = v => v ? d(v).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "–";
  const dateTime = v => v ? d(v).toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–";
  function ago(v) {
    if (!v) return "–";
    const s = (Date.now() - d(v)) / 1000;
    if (s < 60) return "เมื่อสักครู่";
    if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
    if (s < 86400) return `${Math.floor(s / 3600)} ชั่วโมงที่แล้ว`;
    if (s < 86400 * 7) return `${Math.floor(s / 86400)} วันที่แล้ว`;
    return date(v);
  }
  function due(v, done) {
    if (!v) return "";
    const left = (d(v) - Date.now()) / 864e5;
    if (done) return `<span class="badge">กำหนด ${esc(dateTime(v))}</span>`;
    if (left < 0) return `<span class="badge danger"><span class="dot"></span>เกินกำหนด ${esc(date(v))}</span>`;
    if (left < 3) return `<span class="badge warn"><span class="dot"></span>เหลือ ${left < 1 ? Math.max(1, Math.round(left * 24)) + " ชม." : Math.ceil(left) + " วัน"}</span>`;
    return `<span class="badge">ส่งภายใน ${esc(dateTime(v))}</span>`;
  }
  const toLocalInput = v => { if (!v) return ""; const x = d(v); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`; };
  const pct = (a, b) => (b > 0 ? Math.min(100, Math.round(a / b * 100)) : 0);

  // ---------- วิดีโอ ----------
  const ytId = u => (String(u).match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([\w-]{11})/) || [])[1] || null;
  const driveId = u => (String(u).match(/drive\.google\.com\/(?:.*?\/d\/|.*[?&]id=)([\w-]{20,})/) || [])[1] || null;
  const videoKind = u => ytId(u) ? "YouTube" : driveId(u) ? "Google Drive" : "ไฟล์วิดีโอ";

  // ---------- UI ----------
  function toast(msg, type = "") {
    let box = $(".toasts");
    if (!box) { box = document.createElement("div"); box.className = "toasts"; box.setAttribute("role", "status"); document.body.appendChild(box); }
    const t = document.createElement("div"); t.className = "toast " + type; t.textContent = msg;
    box.appendChild(t); setTimeout(() => t.remove(), type === "error" ? 6000 : 3200);
  }
  async function busy(btn, fn) {
    if (!btn) return fn();
    const old = btn.innerHTML; btn.disabled = true;
    try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = old; }
  }
  function modal({ title, body = "", foot = "", wide = false, onClose }) {
    const dlg = document.createElement("dialog");
    dlg.className = "modal" + (wide ? " wide" : "");
    dlg.innerHTML = `<div class="modal-head"><h2>${esc(title)}</h2><button class="btn ghost icon" data-close aria-label="ปิด">${icon.x}</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ""}`;
    document.body.appendChild(dlg);
    dlg.addEventListener("click", e => { if (e.target.closest("[data-close]") || e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => { dlg.remove(); onClose && onClose(); });
    dlg.showModal();
    return dlg;
  }
  function confirmBox(title, message, okLabel = "ยืนยัน", danger = false) {
    return new Promise(resolve => {
      let ok = false;
      const dlg = modal({ title, body: `<p>${message}</p>`,
        foot: `<button class="btn" data-close>ยกเลิก</button><button class="btn ${danger ? "danger" : "primary"}" data-ok>${esc(okLabel)}</button>`,
        onClose: () => resolve(ok) });
      dlg.querySelector("[data-ok]").onclick = () => { ok = true; dlg.close(); };
    });
  }
  const spinner = '<div class="loading"><div class="spinner"></div></div>';
  function bar(p, done) { return `<div class="bar ${done ? "ok" : ""}"><i style="width:${p}%"></i></div>`; }

  const s = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const icon = {
    logo: s('<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M7 9.5V15c0 1.5 2.2 3 5 3s5-1.5 5-3V9.5"/><path d="M21 7v6"/>'),
    home: s('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
    book: s('<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5z"/><path d="M4 19a2 2 0 012-2h13"/>'),
    users: s('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M17.5 14.5c2.2.3 3.6 1.8 4 4.5"/>'),
    chart: s('<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>'),
    camera: s('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
    cog: s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
    logout: s('<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'),
    plus: s('<path d="M12 5v14M5 12h14"/>'),
    x: s('<path d="M18 6L6 18M6 6l12 12"/>'),
    edit: s('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'),
    trash: s('<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>'),
    up: s('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    down: s('<path d="M12 5v14M6 13l6 6 6-6"/>'),
    lock: s('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>'),
    check: s('<path d="M5 12l5 5L20 7"/>'),
    play: s('<path d="M7 4l13 8-13 8z"/>'),
    download: s('<path d="M12 4v12M6 11l6 6 6-6"/><path d="M4 20h16"/>'),
    back: s('<path d="M15 18l-6-6 6-6"/>'),
    key: s('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>'),
    alert: s('<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>'),
    user: s('<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>'),
    shield: s('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
    menu: s('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  };

  window.LR = { $, $$, esc, api, beacon, dur, minutes, date, dateTime, ago, due, toLocalInput, pct, ytId, driveId, videoKind,
                toast, busy, modal, confirmBox, spinner, bar, icon };
})();
