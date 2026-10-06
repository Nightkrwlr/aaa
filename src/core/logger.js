/** Levelled logger. In production only warn/error are printed; debug is stripped by level. */
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };
let current = LEVELS.warn;
const ring = [];
const RING_MAX = 300;
let sink = null;

export function setLogLevel(name) { current = LEVELS[name] ?? LEVELS.warn; }
export function getLogLevel() { return Object.keys(LEVELS).find((k) => LEVELS[k] === current); }
/** optional extra sink: (level, scope, msg, args) */
export function setLogSink(fn) { sink = fn; }
export function recentLogs() { return ring.slice(); }

function emit(level, scope, msg, args) {
  const rec = { t: Date.now(), level, scope, msg: String(msg) };
  ring.push(rec);
  if (ring.length > RING_MAX) ring.shift();
  if (sink) { try { sink(level, scope, msg, args); } catch { /* sink must never throw */ } }
  if (LEVELS[level] < current) return;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[${level.toUpperCase()}][${scope}]`, msg, ...args);
}

export function logger(scope) {
  return {
    debug: (m, ...a) => emit('debug', scope, m, a),
    info: (m, ...a) => emit('info', scope, m, a),
    warn: (m, ...a) => emit('warn', scope, m, a),
    error: (m, ...a) => emit('error', scope, m, a),
  };
}
