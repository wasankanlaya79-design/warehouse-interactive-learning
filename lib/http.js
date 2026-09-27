export function httpErr(status, message) {
  const e = new Error(message);
  e.status = status;
  e.expose = true;
  return e;
}
export const need = (cond, status, msg) => { if (!cond) throw httpErr(status, msg); };
export const str = (v, max = 500) => String(v ?? "").trim().slice(0, max);
export const int = v => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
export const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
