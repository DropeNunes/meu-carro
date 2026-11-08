// Regras de cálculo, sem acesso a tela ou banco de dados.
import { PLAN, REV_KM, REV_MONTHS, TOLERANCE_KM, TOLERANCE_DAYS } from './plan.js';

const pad = (n) => String(n).padStart(2, '0');
const toUTC = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fromUTC = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

export const todayISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const diffDays = (from, to) => Math.round((toUTC(to) - toUTC(from)) / 864e5);
export const addDays = (s, n) => fromUTC(toUTC(s) + n * 864e5);

export function addMonths(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(Math.min(d, lastDay))}`;
}

export const fmtDate = (s) => (s ? s.split('-').reverse().join('/') : '—');
export const fmtKm = (n) => (n == null ? '—' : `${Math.round(n).toLocaleString('pt-BR')} km`);
export const fmtBRL = (n) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
export const fmtNum = (n, d = 1) => (n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));

/** Aceita "1.234,56", "1234,56" e "1234.56". */
export function parseNum(v) {
  let s = String(v ?? '').trim().replace(/\s|R\$/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Quilometragem é sempre inteira: "13.000" significa treze mil. */
export function parseKm(v) {
  const s = String(v ?? '').replace(/\D/g, '');
  return s ? Number(s) : null;
}

export function kmPoints(D) {
  const pts = [];
  const s = D.settings;
  if (s) pts.push({ date: s.lastRev.date, km: s.lastRev.km }, { date: s.setupDate, km: s.setupKm });
  for (const list of [D.odometer, D.services, D.fuels]) {
    for (const r of list) if (r.km != null && r.date) pts.push({ date: r.date, km: r.km });
  }
  return pts.sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);
}

export const currentKm = (D) => kmPoints(D).reduce((m, p) => Math.max(m, p.km), 0);

export function lastKmReading(D) {
  const pts = kmPoints(D);
  return pts.length ? pts[pts.length - 1] : null;
}

/** Média diária entre a primeira e a última leitura; exige ao menos 14 dias. */
export function kmPerDay(D) {
  const pts = kmPoints(D);
  if (pts.length < 2) return null;
  const span = diffDays(pts[0].date, pts[pts.length - 1].date);
  if (span < 14) return null;
  const dist = pts[pts.length - 1].km - pts[0].km;
  return dist > 0 ? dist / span : null;
}

export function lastRevision(D) {
  let best = D.settings.lastRev;
  for (const r of D.services) if (r.revision && r.revision > best.n) best = { n: r.revision, date: r.date, km: r.km };
  return best;
}

export function nextRevision(D) {
  const r = lastRevision(D);
  const n = r.n + 1;
  return {
    n, dueKm: r.km + REV_KM, dueDate: addMonths(r.date, REV_MONTHS),
    items: PLAN.filter((i) => i.every && n % i.every === 0),
  };
}

export const allItems = (D) => [...PLAN, ...D.custom.map((c) => ({ ...c, kind: 'Lembrete', base: 'custom', isCustom: true }))];

export function intervalOf(item, settings) {
  let km = item.every ? item.every * REV_KM : item.km ?? null;
  let months = item.every ? item.every * REV_MONTHS : item.months ?? null;
  if (item.severe && settings.severeOil) {
    km = km == null ? null : km / 2;
    months = months == null ? null : months / 2;
  }
  return { km, months };
}

export function lastDone(item, D) {
  let found = null;
  for (const s of D.services) {
    if (!s.items?.includes(item.id)) continue;
    if (!found || s.date > found.date || (s.date === found.date && s.km > found.km)) found = s;
  }
  return found;
}

/** Calcula o próximo vencimento do item. */
export function dueOf(item, D) {
  const { km, months } = intervalOf(item, D.settings);
  const done = lastDone(item, D);
  const after = (baseKm, baseDate, steps = 1) => ({
    dueKm: km == null ? null : baseKm + km * steps,
    dueDate: months == null ? null : addMonths(baseDate, months * steps),
  });

  if (done) return { ...after(done.km, done.date), done };
  if (item.every) {
    // Sem registro próprio: continua o ciclo a partir da última revisão informada no cadastro.
    const rev = D.settings.lastRev;
    const remainder = rev.n % item.every;
    const fractionLeft = remainder === 0 ? 1 : (item.every - remainder) / item.every;
    return after(rev.km, rev.date, fractionLeft);
  }
  if (item.base === 'unknown') return { unknown: true, dueKm: null, dueDate: null };
  if (item.base === 'start') return after(0, D.settings.startDate);
  if (item.base === 'custom') return after(item.baseKm ?? 0, item.baseDate);
  return after(D.settings.setupKm, D.settings.setupDate); // base 'setup'
}

const soonKm = (km) => Math.max(100, Math.min(1000, km * 0.1));

/** Situação de um item: overdue, unknown, soon ou ok. */
export function evaluate(item, D, today = todayISO()) {
  const due = dueOf(item, D);
  const { km, months } = intervalOf(item, D.settings);
  const base = { item, ...due, interval: { km, months } };
  if (due.unknown) return { ...base, level: 'unknown', text: 'Sem registro da última troca' };

  const odo = currentKm(D);
  const remKm = due.dueKm == null ? null : due.dueKm - odo;
  const remDays = due.dueDate == null ? null : diffDays(today, due.dueDate);
  const overdue = (remKm != null && remKm < 0) || (remDays != null && remDays < 0);
  const soon = (remKm != null && remKm <= soonKm(km)) || (remDays != null && remDays <= TOLERANCE_DAYS);
  const level = overdue ? 'overdue' : soon ? 'soon' : 'ok';

  const withinTolerance = overdue && !!item.every
    && (remDays == null || remDays >= -TOLERANCE_DAYS)
    && (remKm == null || remKm >= -TOLERANCE_KM);

  let text;
  if (overdue) {
    const parts = [];
    if (remDays != null && remDays < 0) parts.push(`venceu em ${fmtDate(due.dueDate)}`);
    if (remKm != null && remKm < 0) parts.push(`passou ${fmtKm(-remKm)}`);
    text = parts.join(' · ');
    text = text[0].toUpperCase() + text.slice(1);
    if (withinTolerance) text += ' (dentro da tolerância do manual)';
  } else {
    const parts = [];
    if (due.dueDate) parts.push(fmtDate(due.dueDate));
    if (due.dueKm != null) parts.push(fmtKm(due.dueKm));
    text = `Até ${parts.join(' ou ')}`;
  }
  return { ...base, level, remKm, remDays, withinTolerance, text };
}

const RANK = { overdue: 0, unknown: 1, soon: 2, ok: 3 };

export function evaluateAll(D, today = todayISO()) {
  const weight = (e) => (e.remDays != null ? e.remDays : 1e6) + (e.remKm != null ? e.remKm / 1000 : 0);
  return allItems(D).map((i) => evaluate(i, D, today))
    .sort((a, b) => RANK[a.level] - RANK[b.level] || weight(a) - weight(b));
}

/** Data estimada em que o carro atinge a quilometragem pedida, no ritmo atual. */
export function predictDateForKm(targetKm, D, today = todayISO()) {
  const rate = kmPerDay(D);
  const odo = currentKm(D);
  if (!rate || targetKm == null || targetKm <= odo) return null;
  return addDays(today, Math.round((targetKm - odo) / rate));
}

/** Avisos do popup de abertura. */
export function openingAlerts(D, today = todayISO()) {
  const items = evaluateAll(D, today).filter((e) => e.level !== 'ok');
  const notes = [];
  const reading = lastKmReading(D);
  if (reading) {
    const age = diffDays(reading.date, today);
    if (age > 30) notes.push({ key: 'km', text: `Sua quilometragem não é atualizada há ${age} dias.` });
  }
  const hasRecords = D.services.length + D.fuels.length + D.expenses.length > 0;
  const lastBackup = D.settings.lastBackup;
  if (hasRecords && (!lastBackup || diffDays(lastBackup, today) > 30)) {
    notes.push({ key: 'backup', text: lastBackup ? 'Seu último backup tem mais de 30 dias.' : 'Você ainda não fez nenhum backup dos dados.' });
  }
  return { items, notes };
}

/**
 * Consumo entre tanques cheios. O trecho depois de um tanque cheio queima o
 * combustível colocado nele; os litros do abastecimento seguinte medem o gasto.
 */
export function fuelSegments(fuels) {
  const sorted = [...fuels].sort((a, b) => a.km - b.km || a.date.localeCompare(b.date));
  const out = [];
  let startIdx = -1;
  sorted.forEach((f, i) => {
    if (!f.full) return;
    if (startIdx >= 0) {
      const start = sorted[startIdx];
      const range = sorted.slice(startIdx + 1, i + 1);
      const liters = range.reduce((s, r) => s + r.liters, 0);
      const dist = f.km - start.km;
      if (dist > 0 && liters > 0) {
        const burned = [start, ...range.slice(0, -1)];
        const types = new Set(burned.map((r) => r.fuel));
        const fuel = types.size === 1 ? start.fuel : 'mistura';
        const price = start.total / start.liters;
        out.push({ endId: f.id, fuel, dist, liters, kml: dist / liters, costKm: (liters * price) / dist });
      }
    }
    startIdx = i;
  });
  return out;
}

export function fuelAverages(fuels) {
  const result = {};
  for (const s of fuelSegments(fuels)) {
    if (s.fuel === 'mistura') continue;
    const a = (result[s.fuel] ||= { dist: 0, liters: 0, cost: 0, tanks: 0 });
    a.dist += s.dist; a.liters += s.liters; a.cost += s.costKm * s.dist; a.tanks += 1;
  }
  for (const a of Object.values(result)) { a.kml = a.dist / a.liters; a.costKm = a.cost / a.dist; }
  return result;
}

export function yearSummary(D, year) {
  const inYear = (r) => r.date.startsWith(String(year));
  const sum = (list) => list.reduce((s, r) => s + (r.total ?? r.cost ?? r.value ?? 0), 0);
  const maintenance = sum(D.services.filter(inYear));
  const fuel = sum(D.fuels.filter(inYear));
  const expenses = D.expenses.filter(inYear);
  const other = sum(expenses);
  const byCat = {};
  for (const e of expenses) byCat[e.category] = (byCat[e.category] || 0) + e.value;
  const pts = kmPoints(D).filter(inYear);
  const km = pts.length > 1 ? Math.max(...pts.map((p) => p.km)) - Math.min(...pts.map((p) => p.km)) : 0;
  const total = maintenance + fuel + other;
  return { maintenance, fuel, other, total, byCat, km, costKm: km > 0 ? total / km : null };
}

export function yearsWithData(D, today = todayISO()) {
  const set = new Set([Number(today.slice(0, 4))]);
  for (const list of [D.services, D.fuels, D.expenses]) for (const r of list) set.add(Number(r.date.slice(0, 4)));
  return [...set].sort((a, b) => b - a);
}
