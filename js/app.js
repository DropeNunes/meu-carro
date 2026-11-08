import { PLAN, SPECS, FUELS, EXPENSE_CATS, FUEL_REFERENCE } from './plan.js';
import * as L from './logic.js';
import * as db from './db.js';

const $ = (s, root = document) => root.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fuelName = (f) => (f === 'gasolina' ? 'Gasolina' : f === 'etanol' ? 'Etanol' : 'Mistura');
const icon = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICONS = {
  home: icon('<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>'),
  plan: icon('<path d="M8 6h12M8 12h12M8 18h12"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>'),
  history: icon('<path d="M14.5 6.5a4 4 0 0 0-5 5L4 17a2 2 0 0 0 3 3l5.500-5.500a4 4 0 0 0 5-5l-2.500 2.500-2.500-1-1-2.500z"/>'),
  fuel: icon('<path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M3 21h14M8 8h4"/><path d="M15 12h2a2 2 0 0 1 2 2v3a1.500 1.500 0 0 0 3 0V9l-3-3"/>'),
  money: icon('<circle cx="12" cy="12" r="9"/><path d="M15 9.500c-.5-1.200-1.600-1.800-3-1.800-1.700 0-3 .9-3 2.200 0 3 6 1.500 6 4.300 0 1.300-1.300 2.200-3 2.200-1.500 0-2.700-.7-3.100-1.900M12 6v12"/>'),
  gear: icon('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.200l2-1.500-2-3.400-2.300.9a7 7 0 0 0-2-1.200L14 3h-4l-.6 2.600a7 7 0 0 0-2 1.200l-2.300-.9-2 3.400 2 1.500a7 7 0 0 0 0 2.400l-2 1.500 2 3.400 2.300-.9a7 7 0 0 0 2 1.200L10 21h4l.6-2.600a7 7 0 0 0 2-1.200l2.300.9 2-3.400-2-1.500c.1-.4.1-.8.1-1.200z"/>'),
  close: icon('<path d="M6 6l12 12M18 6L6 18"/>'),
};
const TABS = [['home', 'Início'], ['plan', 'Plano'], ['history', 'Serviços'], ['fuel', 'Consumo'], ['money', 'Custos']];
const LEVEL = { overdue: 'Vencido', unknown: 'Verificar', soon: 'Próximo', ok: 'Em dia' };
const badge = (level) => `<span class="badge ${level}">${LEVEL[level]}</span>`;

let D = null;
let route = 'home';
let moneyYear = Number(L.todayISO().slice(0, 4));
let lastPopup = 0;

async function refresh() {
  D = await db.loadAll();
  render();
}

function render() {
  const view = $('#view');
  const tabs = $('#tabs');
  if (!D.settings) {
    tabs.hidden = true;
    view.innerHTML = setupView();
    return;
  }
  tabs.hidden = false;
  tabs.innerHTML = TABS.map(([id, label]) => `<button data-act="nav" data-to="${id}" ${route === id ? 'aria-current="page"' : ''}>${ICONS[id]}<span>${label}</span></button>`).join('');
  view.innerHTML = VIEWS[route]();
}

/* ---------- Telas ---------- */

function setupView() {
  return `
  <div class="head"><div><h1>Meu Carro</h1><p class="sub">Vamos cadastrar a situação atual do carro.</p></div></div>
  <form id="setup-form" class="card">
    <div id="form-err" class="err" hidden></div>
    <label class="f">Veículo<input name="name" value="Jeep Compass Limited T270 1.3 TB 4x2 2023" required></label>
    <label class="f">Quilometragem atual<input name="km" inputmode="numeric" placeholder="Ex.: 25.000" required></label>
    <label class="f">Número da última revisão<input name="n" inputmode="numeric" placeholder="Ex.: 2" required></label>
    <div class="two">
      <label class="f">Data da última revisão<input name="date" type="date" max="${L.todayISO()}" required></label>
      <label class="f">Km nessa revisão<input name="revKm" inputmode="numeric" required></label>
    </div>
    <label class="check"><input type="checkbox" name="severe" checked><span><strong>Utilização severa</strong><br><span class="note">Marque se o uso é principalmente em trajetos curtos, abaixo de 7-8 km. O manual reduz à metade o prazo do óleo (pág. H-2).</span></span></label>
    <button class="btn primary block" style="margin-top:14px">Começar</button>
  </form>`;
}

function homeView() {
  const odo = L.currentKm(D);
  const rate = L.kmPerDay(D);
  const all = L.evaluateAll(D);
  const pending = all.filter((e) => e.level !== 'ok');
  const next = L.nextRevision(D);
  const year = Number(L.todayISO().slice(0, 4));
  const summary = L.yearSummary(D, year);
  return `
  <div class="head">
    <div><h1>Meu Carro</h1><p class="sub">${esc(D.settings.name)}</p></div>
    <button class="icon-btn" data-act="settings" aria-label="Ajustes">${ICONS.gear}</button>
  </div>
  <section class="card odo">
    <div><span class="small muted">Quilometragem</span><strong>${L.fmtKm(odo)}</strong>
    ${rate ? `<span class="small muted">Cerca de ${L.fmtNum(rate * 30, 0)} km por mês</span>` : ''}</div>
    <button class="btn primary" data-act="km">Atualizar</button>
  </section>
  <div class="btn-row">
    <button class="btn" data-act="fuelForm">Abastecer</button>
    <button class="btn" data-act="serviceForm">Registrar serviço</button>
  </div>
  <h2>Atenção</h2>
  ${pending.length ? `<div class="list">${pending.map(itemRow).join('')}</div>` : '<div class="card muted">Nada pendente. Está tudo em dia.</div>'}
  <h2>Próxima revisão</h2>
  <button class="card block-card" data-act="nextRev" style="width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer">
    <div class="row-between"><h3>${next.n}ª revisão</h3><span class="muted small">${next.items.length} itens</span></div>
    <p class="muted small" style="margin-top:4px">Até ${L.fmtDate(next.dueDate)} ou ${L.fmtKm(next.dueKm)}, o que vier primeiro</p>
  </button>
  <h2>${year}</h2>
  <div class="stats">
    <div class="stat"><span>Total gasto</span><strong>${L.fmtBRL(summary.total)}</strong></div>
    <div class="stat"><span>Custo por km</span><strong>${summary.costKm == null ? '—' : L.fmtBRL(summary.costKm)}</strong></div>
  </div>`;
}

function itemRow(e) {
  return `<button class="li" data-act="item" data-id="${esc(e.item.id)}">
    <div><div class="title">${esc(e.item.name)}</div><div class="meta">${esc(e.text)}</div></div>
    ${badge(e.level)}
  </button>`;
}

function planView() {
  const all = L.evaluateAll(D);
  const group = (title, f) => {
    const rows = all.filter(f);
    return rows.length ? `<h2>${title}</h2><div class="list">${rows.map(itemRow).join('')}</div>` : '';
  };
  return `
  <div class="head"><div><h1>Plano</h1><p class="sub">Revisão a cada 12.000 km ou 12 meses, o que vier primeiro.</p></div></div>
  <button class="btn block" data-act="customForm">Novo lembrete</button>
  ${group('Revisão e trocas', (e) => !e.item.owner && !e.item.isCustom)}
  ${group('Você mesmo verifica', (e) => e.item.owner)}
  ${group('Meus lembretes', (e) => e.item.isCustom)}
  <h2>Especificações do manual</h2>
  <div class="card">${SPECS.map(([k, v]) => `<div class="kv"><span>${k}</span><span>${v}</span></div>`).join('')}</div>`;
}

function historyView() {
  const list = [...D.services].sort((a, b) => b.date.localeCompare(a.date) || b.km - a.km);
  const base = D.settings.lastRev;
  const row = (s) => `<button class="li" data-act="serviceForm" data-id="${s.id}">
    <div><div class="title">${esc(serviceTitle(s))}</div><div class="meta">${L.fmtDate(s.date)} · ${L.fmtKm(s.km)}${s.shop ? ` · ${esc(s.shop)}` : ''}</div></div>
    <span class="value">${s.cost ? L.fmtBRL(s.cost) : ''}</span></button>`;
  return `
  <div class="head"><div><h1>Serviços</h1><p class="sub">Histórico de manutenção do carro.</p></div></div>
  <button class="btn primary block" data-act="serviceForm">Registrar serviço</button>
  <h2>Histórico</h2>
  <div class="list">
    ${list.map(row).join('')}
    <div class="li"><div><div class="title">${base.n}ª revisão</div><div class="meta">${L.fmtDate(base.date)} · ${L.fmtKm(base.km)} · informada no cadastro</div></div></div>
  </div>`;
}

const serviceTitle = (s) => s.title || (s.revision ? `${s.revision}ª revisão` : 'Serviço');

function fuelView() {
  const avg = L.fuelAverages(D.fuels);
  const seg = Object.fromEntries(L.fuelSegments(D.fuels).map((s) => [s.endId, s]));
  const list = [...D.fuels].sort((a, b) => b.km - a.km);
  const cards = FUELS.map(([id, label]) => {
    const a = avg[id];
    const ref = FUEL_REFERENCE[id];
    return `<div class="stat"><span>${label}</span><strong>${a ? `${L.fmtNum(a.kml)} km/l` : '—'}</strong>
      <span>${a ? `${L.fmtBRL(a.costKm)} por km · ${a.tanks} ${a.tanks > 1 ? 'tanques' : 'tanque'}` : 'sem medição'}</span>
      <span>Ref. ${L.fmtNum(ref.cidade)} cidade · ${L.fmtNum(ref.estrada)} estrada</span></div>`;
  }).join('');
  const row = (f) => {
    const s = seg[f.id];
    return `<button class="li" data-act="fuelForm" data-id="${f.id}">
      <div><div class="title">${fuelName(f.fuel)}${f.full ? '' : ' (parcial)'}</div>
      <div class="meta">${L.fmtDate(f.date)} · ${L.fmtKm(f.km)} · ${L.fmtNum(f.liters, 2)} L${s ? ` · ${L.fmtNum(s.kml)} km/l` : ''}</div></div>
      <span class="value">${L.fmtBRL(f.total)}</span></button>`;
  };
  return `
  <div class="head"><div><h1>Consumo</h1><p class="sub">A medição usa dois abastecimentos com tanque cheio.</p></div></div>
  <button class="btn primary block" data-act="fuelForm">Novo abastecimento</button>
  <h2>Média por combustível</h2>
  <div class="stats">${cards}</div>
  <p class="note">Referência da ficha técnica do Inmetro. Em trajetos muito curtos, é normal ficar abaixo dela.</p>
  <h2>Abastecimentos</h2>
  <div class="list">${list.length ? list.map(row).join('') : '<div class="empty">Nenhum abastecimento registrado.</div>'}</div>`;
}

function moneyView() {
  const years = L.yearsWithData(D);
  if (!years.includes(moneyYear)) moneyYear = years[0];
  const y = L.yearSummary(D, moneyYear);
  const list = D.expenses.filter((e) => e.date.startsWith(String(moneyYear))).sort((a, b) => b.date.localeCompare(a.date));
  const row = (e) => `<button class="li" data-act="expenseForm" data-id="${e.id}">
    <div><div class="title">${esc(e.category)}</div><div class="meta">${L.fmtDate(e.date)}${e.note ? ` · ${esc(e.note)}` : ''}</div></div>
    <span class="value">${L.fmtBRL(e.value)}</span></button>`;
  return `
  <div class="head"><div><h1>Custos</h1><p class="sub">Tudo o que o carro custou no ano.</p></div></div>
  <div class="seg">${years.map((v) => `<button class="btn" data-act="year" data-year="${v}" aria-pressed="${v === moneyYear}">${v}</button>`).join('')}</div>
  <div class="stats">
    <div class="stat"><span>Total</span><strong>${L.fmtBRL(y.total)}</strong></div>
    <div class="stat"><span>Custo por km</span><strong>${y.costKm == null ? '—' : L.fmtBRL(y.costKm)}</strong></div>
  </div>
  <div class="card">
    <div class="kv"><span>Manutenção</span><span class="num">${L.fmtBRL(y.maintenance)}</span></div>
    <div class="kv"><span>Combustível</span><span class="num">${L.fmtBRL(y.fuel)}</span></div>
    ${Object.entries(y.byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><span class="num">${L.fmtBRL(v)}</span></div>`).join('')}
    <div class="kv"><span>Km rodados no ano</span><span class="num">${y.km ? L.fmtKm(y.km) : '—'}</span></div>
  </div>
  <button class="btn primary block" data-act="expenseForm">Nova despesa</button>
  <h2>Despesas de ${moneyYear}</h2>
  <div class="list">${list.length ? list.map(row).join('') : '<div class="empty">Nenhuma despesa neste ano.</div>'}</div>
  <p class="note">Manutenção e combustível entram no total a partir de Serviços e Consumo.</p>`;
}

const VIEWS = { home: homeView, plan: planView, history: historyView, fuel: fuelView, money: moneyView };

/* ---------- Formulários ---------- */

const closeBtn = `<button type="button" class="icon-btn" data-act="closeSheet" aria-label="Fechar">${ICONS.close}</button>`;

function openPanel(title, body) {
  const d = $('#sheet');
  d.innerHTML = `<div class="sheet-body"><header><h2 id="sheet-title">${esc(title)}</h2>${closeBtn}</header><div class="scroll">${body}</div></div>`;
  if (!d.open) d.showModal();
}

/**
 * Abre um formulário. onSubmit devolve texto para mostrar erro, ou nada para
 * salvar, fechar e atualizar a tela.
 */
function openForm(title, fields, { submit = 'Salvar', onSubmit, onDelete, onReady } = {}) {
  const d = $('#sheet');
  d.innerHTML = `<form novalidate><header><h2 id="sheet-title">${esc(title)}</h2>${closeBtn}</header>
    <div class="scroll"><div id="form-err" class="err" hidden></div>${fields}
    ${onDelete ? '<button type="button" class="btn danger block" id="form-del">Excluir</button>' : ''}</div>
    <footer><button class="btn primary block">${submit}</button></footer></form>`;
  const form = $('form', d);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const err = await onSubmit(new FormData(form), form);
    if (err) {
      const box = $('#form-err', d);
      box.textContent = err;
      box.hidden = false;
      $('.scroll', d).scrollTop = 0;
      return;
    }
    d.close();
    await refresh();
  });
  if (onDelete) {
    $('#form-del', d).addEventListener('click', async () => {
      if (!confirm('Excluir este registro? Essa ação não pode ser desfeita.')) return;
      await onDelete();
      d.close();
      await refresh();
    });
  }
  if (!d.open) d.showModal();
  onReady?.(form);
}

/** Avisa se a km informada é menor que uma leitura anterior. */
function kmLooksWrong(km, date) {
  const prior = L.kmPoints(D).filter((p) => p.date <= date).reduce((m, p) => Math.max(m, p.km), 0);
  return km < prior && !confirm(`Essa quilometragem é menor que uma leitura anterior (${L.fmtKm(prior)}). Salvar mesmo assim?`);
}

function kmForm() {
  openForm('Atualizar quilometragem', `
    <label class="f">Quilometragem no painel<input name="km" inputmode="numeric" value="${L.currentKm(D)}" autocomplete="off"></label>
    <label class="f">Data<input name="date" type="date" value="${L.todayISO()}" max="${L.todayISO()}"></label>`, {
    onSubmit: async (fd) => {
      const km = L.parseKm(fd.get('km'));
      const date = fd.get('date');
      if (!km || !date) return 'Informe a quilometragem e a data.';
      if (kmLooksWrong(km, date)) return 'Confira a quilometragem.';
      await db.put('odometer', { km, date });
    },
  });
}

function fuelForm({ id } = {}) {
  const f = D.fuels.find((x) => x.id === id);
  const today = L.todayISO();
  openForm(f ? 'Editar abastecimento' : 'Novo abastecimento', `
    <div class="two">
      <label class="f">Data<input name="date" type="date" max="${today}" value="${f?.date ?? today}"></label>
      <label class="f">Km no painel<input name="km" inputmode="numeric" value="${f?.km ?? L.currentKm(D)}"></label>
    </div>
    <label class="f">Combustível<select name="fuel">${FUELS.map(([v, n]) => `<option value="${v}" ${(f?.fuel ?? lastFuel()) === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <div class="two">
      <label class="f">Litros<input name="liters" inputmode="decimal" value="${f ? L.fmtNum(f.liters, 2) : ''}" placeholder="0,00"></label>
      <label class="f">Valor total (R$)<input name="total" inputmode="decimal" value="${f ? L.fmtNum(f.total, 2) : ''}" placeholder="0,00"></label>
    </div>
    <p id="price" class="note" style="margin:-6px 0 12px"></p>
    <label class="check"><input type="checkbox" name="full" ${f ? (f.full ? 'checked' : '') : 'checked'}><span>Tanque cheio<br><span class="note">Necessário para calcular o consumo.</span></span></label>`, {
    onReady: (form) => {
      const show = () => {
        const l = L.parseNum(form.liters.value);
        const t = L.parseNum(form.total.value);
        $('#price', form).textContent = l && t ? `Preço: ${L.fmtBRL(t / l)} por litro` : '';
      };
      form.addEventListener('input', show);
      show();
    },
    onSubmit: async (fd, form) => {
      const km = L.parseKm(fd.get('km'));
      const liters = L.parseNum(fd.get('liters'));
      const total = L.parseNum(fd.get('total'));
      const date = fd.get('date');
      if (!date || !km) return 'Informe a data e a quilometragem.';
      if (!liters || liters <= 0 || !total || total <= 0) return 'Informe os litros e o valor pago.';
      if (liters > 55 && !confirm(`${L.fmtNum(liters, 2)} L é mais que os 55 L do tanque. Salvar mesmo assim?`)) return 'Confira os litros.';
      if (!f && kmLooksWrong(km, date)) return 'Confira a quilometragem.';
      await db.put('fuels', { ...(f ?? {}), date, km, liters, total, fuel: fd.get('fuel'), full: form.full.checked });
    },
    onDelete: f ? () => db.remove('fuels', f.id) : null,
  });
}

function lastFuel() {
  const last = [...D.fuels].sort((a, b) => b.km - a.km)[0];
  return last?.fuel ?? 'gasolina';
}

function expenseForm({ id } = {}) {
  const e = D.expenses.find((x) => x.id === id);
  const today = L.todayISO();
  openForm(e ? 'Editar despesa' : 'Nova despesa', `
    <label class="f">Categoria<select name="category">${EXPENSE_CATS.map((c) => `<option ${e?.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <div class="two">
      <label class="f">Data<input name="date" type="date" value="${e?.date ?? today}"></label>
      <label class="f">Valor (R$)<input name="value" inputmode="decimal" value="${e ? L.fmtNum(e.value, 2) : ''}" placeholder="0,00"></label>
    </div>
    <label class="f">Observação<input name="note" value="${esc(e?.note)}"></label>`, {
    onSubmit: async (fd) => {
      const value = L.parseNum(fd.get('value'));
      if (!fd.get('date') || !value || value <= 0) return 'Informe a data e o valor.';
      await db.put('expenses', { ...(e ?? {}), date: fd.get('date'), value, category: fd.get('category'), note: fd.get('note').trim() });
    },
    onDelete: e ? () => db.remove('expenses', e.id) : null,
  });
}

function serviceForm({ id, item } = {}) {
  const s = D.services.find((x) => x.id === id);
  const today = L.todayISO();
  const next = L.nextRevision(D).n;
  const ticked = new Set(s?.items ?? (item ? [item] : []));
  let photos = [...(s?.photos ?? [])];
  const items = L.allItems(D);

  const drawPhotos = (form) => {
    $('#photos', form).innerHTML = photos.map((p, i) => `<div class="photo"><img src="${p}" alt="Comprovante ${i + 1}"><button type="button" data-remove="${i}" aria-label="Remover foto ${i + 1}">×</button></div>`).join('');
  };

  openForm(s ? 'Editar serviço' : 'Registrar serviço', `
    <div class="two">
      <label class="f">Data<input name="date" type="date" max="${today}" value="${s?.date ?? today}"></label>
      <label class="f">Km no painel<input name="km" inputmode="numeric" value="${s?.km ?? L.currentKm(D)}"></label>
    </div>
    <label class="f">Tipo<select name="revision">
      <option value="">Serviço avulso</option>
      ${Array.from(new Set([next, ...(s?.revision ? [s.revision] : [])])).map((n) => `<option value="${n}" ${s?.revision === n ? 'selected' : ''}>${n}ª revisão</option>`).join('')}
    </select></label>
    <label class="f">Descrição<input name="title" value="${esc(s?.title)}" placeholder="Ex.: Troca de óleo"></label>
    <div class="two">
      <label class="f">Oficina<input name="shop" value="${esc(s?.shop)}"></label>
      <label class="f">Custo (R$)<input name="cost" inputmode="decimal" value="${s?.cost ? L.fmtNum(s.cost, 2) : ''}" placeholder="0,00"></label>
    </div>
    <label class="f">Observações<textarea name="notes">${esc(s?.notes)}</textarea></label>
    <label class="f">Fotos e notas fiscais<input id="photo-input" type="file" accept="image/*" multiple></label>
    <div id="photos" class="photos" style="margin-bottom:14px"></div>
    <h2 style="margin-top:6px">Itens feitos neste serviço</h2>
    <div class="card" id="item-list">${items.map((i) => `<label class="check"><input type="checkbox" name="item" value="${esc(i.id)}" ${ticked.has(i.id) ? 'checked' : ''}><span>${esc(i.name)}<br><span class="note">${esc(i.kind)}</span></span></label>`).join('')}</div>`, {
    onReady: (form) => {
      drawPhotos(form);
      form.revision.addEventListener('change', () => {
        const n = Number(form.revision.value);
        if (!n) return;
        const expected = new Set(PLAN.filter((i) => i.every && n % i.every === 0).map((i) => i.id));
        form.querySelectorAll('input[name=item]').forEach((c) => { if (expected.has(c.value)) c.checked = true; });
      });
      $('#photo-input', form).addEventListener('change', async (ev) => {
        for (const file of ev.target.files) {
          try { photos.push(await shrinkImage(file)); } catch { alert('Não foi possível ler uma das fotos.'); }
        }
        ev.target.value = '';
        drawPhotos(form);
      });
      $('#photos', form).addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-remove]');
        if (!b) return;
        photos.splice(Number(b.dataset.remove), 1);
        drawPhotos(form);
      });
    },
    onSubmit: async (fd) => {
      const km = L.parseKm(fd.get('km'));
      const date = fd.get('date');
      if (!date || !km) return 'Informe a data e a quilometragem.';
      const chosen = fd.getAll('item');
      const revision = Number(fd.get('revision')) || null;
      const title = fd.get('title').trim();
      if (!revision && !title && !chosen.length) return 'Marque um item feito ou escreva uma descrição.';
      const rawCost = fd.get('cost');
      const cost = rawCost.trim() ? L.parseNum(rawCost) : 0;
      if (cost == null || cost < 0) return 'Confira o custo.';
      if (!s && kmLooksWrong(km, date)) return 'Confira a quilometragem.';
      await db.put('services', { ...(s ?? {}), date, km, revision, title, shop: fd.get('shop').trim(), cost, notes: fd.get('notes').trim(), items: chosen, photos });
    },
    onDelete: s ? () => db.remove('services', s.id) : null,
  });
}

function shrinkImage(file, max = 1280) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagem')); };
    img.src = url;
  });
}

function customForm({ id } = {}) {
  const c = D.custom.find((x) => x.id === id);
  const today = L.todayISO();
  openForm(c ? 'Editar lembrete' : 'Novo lembrete', `
    <label class="f">Nome<input name="name" value="${esc(c?.name)}" placeholder="Ex.: IPVA, seguro, rodízio de pneus"></label>
    <div class="two">
      <label class="f">A cada (meses)<input name="months" inputmode="numeric" value="${c?.months ?? ''}"></label>
      <label class="f">A cada (km)<input name="km" inputmode="numeric" value="${c?.km ?? ''}"></label>
    </div>
    <div class="two">
      <label class="f">Última vez em<input name="baseDate" type="date" value="${c?.baseDate ?? today}"></label>
      <label class="f">Km na última vez<input name="baseKm" inputmode="numeric" value="${c?.baseKm ?? L.currentKm(D)}"></label>
    </div>
    <p class="note">Preencha meses, km ou os dois. Vale o que vencer primeiro.</p>`, {
    submit: 'Salvar lembrete',
    onSubmit: async (fd) => {
      const name = fd.get('name').trim();
      const months = L.parseKm(fd.get('months'));
      const km = L.parseKm(fd.get('km'));
      if (!name) return 'Dê um nome ao lembrete.';
      if (!months && !km) return 'Informe o intervalo em meses ou em km.';
      if (!fd.get('baseDate')) return 'Informe a data da última vez.';
      await db.put('custom', { ...(c ?? {}), name, months, km, baseDate: fd.get('baseDate'), baseKm: L.parseKm(fd.get('baseKm')) ?? 0 });
    },
    onDelete: c ? () => db.remove('custom', c.id) : null,
  });
}

function itemPanel({ id }) {
  const item = L.allItems(D).find((i) => i.id === id);
  if (!item) return;
  const e = L.evaluate(item, D);
  const when = [];
  if (e.interval.months) when.push(`${e.interval.months} meses`);
  if (e.interval.km) when.push(L.fmtKm(e.interval.km));
  const predicted = !e.unknown && e.dueKm != null ? L.predictDateForKm(e.dueKm, D) : null;
  const done = e.done;
  const severeNote = item.severe && D.settings.severeOil ? '<p class="note" style="margin-top:10px">Prazo reduzido à metade por utilização severa (manual, pág. H-2). Altere em Ajustes.</p>' : '';
  openPanel(item.name, `
    <div class="card">
      <div class="row-between" style="margin-bottom:8px">${badge(e.level)}<span class="muted small">${esc(item.kind)}</span></div>
      <p>${esc(e.text)}</p>${severeNote}
    </div>
    <div class="card">
      <div class="kv"><span>Frequência</span><span>${when.length ? `A cada ${when.join(' ou ')}` : '—'}</span></div>
      <div class="kv"><span>Última vez</span><span>${done ? `${L.fmtDate(done.date)} · ${L.fmtKm(done.km)}` : 'Sem registro no app'}</span></div>
      ${e.dueDate ? `<div class="kv"><span>Vence em</span><span>${L.fmtDate(e.dueDate)}</span></div>` : ''}
      ${e.dueKm != null ? `<div class="kv"><span>Ou aos</span><span>${L.fmtKm(e.dueKm)}</span></div>` : ''}
      ${predicted ? `<div class="kv"><span>Essa km, no seu ritmo</span><span>${L.fmtDate(predicted)}</span></div>` : ''}
      ${item.ref ? `<div class="kv"><span>Manual</span><span>Pág. ${esc(item.ref)}</span></div>` : ''}
    </div>
    ${item.note ? `<p class="note" style="margin-bottom:14px">${esc(item.note)}</p>` : ''}
    <button class="btn primary block" data-act="serviceForm" data-item="${esc(item.id)}">Registrar execução</button>
    ${item.isCustom ? `<button class="btn block" style="margin-top:10px" data-act="customForm" data-id="${esc(item.id)}">Editar lembrete</button>` : ''}`);
}

function nextRevPanel() {
  const next = L.nextRevision(D);
  openPanel(`${next.n}ª revisão`, `
    <div class="card">
      <div class="kv"><span>Prazo</span><span>${L.fmtDate(next.dueDate)}</span></div>
      <div class="kv"><span>Ou aos</span><span>${L.fmtKm(next.dueKm)}</span></div>
      <div class="kv"><span>Tolerância</span><span>30 dias ou 1.000 km</span></div>
    </div>
    <h2>O que inclui</h2>
    <div class="list">${next.items.map((i) => `<div class="li"><div><div class="title">${esc(i.name)}</div><div class="meta">${esc(i.kind)}</div></div></div>`).join('')}</div>
    <p class="note">O fluido de freio segue prazo próprio: 24 meses ou 36.000 km. Com utilização severa ligada, o óleo vence antes da revisão; o prazo dele aparece na tela de Plano.</p>`);
}

function settingsPanel() {
  const s = D.settings;
  openForm('Ajustes', `
    <label class="f">Veículo<input name="name" value="${esc(s.name)}"></label>
    <label class="f">Placa (opcional)<input name="plate" value="${esc(s.plate)}" autocapitalize="characters"></label>
    <label class="f">Início de uso do carro<input name="startDate" type="date" value="${s.startDate}"><small>Estimado pelas revisões. Se souber a data real, corrija: ela define os prazos por tempo de correias e arrefecimento.</small></label>
    <label class="check"><input type="checkbox" name="severe" ${s.severeOil ? 'checked' : ''}><span><strong>Utilização severa</strong><br><span class="note">Prazo do óleo pela metade: 6.000 km ou 6 meses. Trajetos curtos e repetidos, abaixo de 7-8 km (manual, pág. H-2).</span></span></label>
    <h2>Seus dados</h2>
    <p class="note" style="margin-bottom:10px">Tudo fica só neste iPhone. Salve o backup no iCloud Drive para não perder os dados se o app for removido ou o iOS limpar o armazenamento.${s.lastBackup ? ` Último backup: ${L.fmtDate(s.lastBackup)}.` : ' Nenhum backup feito ainda.'}</p>
    <button type="button" class="btn block" data-act="backup">Fazer backup</button>
    <label class="btn block" style="margin-top:10px">Restaurar backup<input type="file" id="restore" accept="application/json,.json" hidden></label>
    <p class="note" style="margin-top:18px">Plano baseado no manual do proprietário Jeep Compass 2023. Em caso de dúvida, vale o manual e a orientação da concessionária.</p>`, {
    onReady: (form) => { $('#restore', form).addEventListener('change', restore); },
    onSubmit: async (fd, form) => {
      if (!fd.get('startDate')) return 'Informe o início de uso do carro.';
      await db.saveSettings({ ...s, name: fd.get('name').trim() || s.name, plate: fd.get('plate').trim(), startDate: fd.get('startDate'), severeOil: form.severe.checked });
    },
  });
}

async function backup() {
  const name = `meu-carro-backup-${L.todayISO()}.json`;
  const json = JSON.stringify(db.makeBackup(D));
  const file = new File([json], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Backup do Meu Carro' });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    alert('Não foi possível gerar o backup.');
    return;
  }
  await db.saveSettings({ ...D.settings, lastBackup: L.todayISO() });
  $('#sheet').close();
  await refresh();
}

async function restore(ev) {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    db.validateBackup(parsed);
    if (!confirm(`Substituir todos os dados atuais pelo backup de ${new Date(parsed.exportedAt).toLocaleDateString('pt-BR')}?`)) return;
    await db.restoreBackup(parsed);
    $('#sheet').close();
    await refresh();
    alert('Backup restaurado.');
  } catch (err) {
    alert(err instanceof SyntaxError ? 'Este arquivo não é um backup válido.' : err.message);
  }
}

/* ---------- Popup de abertura ---------- */

const POPUP_GAP = 4 * 3600 * 1000;

function maybePopup() {
  if (!D?.settings || $('#sheet').open || $('#alerts').open) return;
  if (Date.now() - lastPopup < POPUP_GAP) return;
  const { items, notes } = L.openingAlerts(D);
  if (!items.length && !notes.length) return;
  lastPopup = Date.now();
  const d = $('#alerts');
  d.innerHTML = `<h2 id="alerts-title">Atenção ao seu carro</h2>
    <p class="muted small" style="margin-bottom:8px">${L.fmtDate(L.todayISO())} · ${L.fmtKm(L.currentKm(D))}</p>
    ${items.map((e) => `<div class="alert">${badge(e.level)}<div class="title">${esc(e.item.name)}</div><div class="muted small">${esc(e.text)}</div></div>`).join('')}
    ${notes.map((n) => `<div class="alert"><div class="small">${esc(n.text)}</div></div>`).join('')}
    <button class="btn primary block" data-act="closeAlerts">Entendi</button>`;
  d.showModal();
}

/* ---------- Eventos ---------- */

const ACTIONS = {
  nav: ({ to }) => { route = to; render(); scrollTo(0, 0); },
  km: kmForm,
  fuelForm,
  expenseForm,
  serviceForm,
  customForm,
  item: itemPanel,
  nextRev: nextRevPanel,
  settings: settingsPanel,
  backup,
  year: ({ year }) => { moneyYear = Number(year); render(); },
  closeSheet: () => $('#sheet').close(),
  closeAlerts: () => $('#alerts').close(),
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (el) ACTIONS[el.dataset.act]?.({ ...el.dataset });
});

document.addEventListener('submit', async (ev) => {
  if (ev.target.id !== 'setup-form') return;
  ev.preventDefault();
  const form = ev.target;
  const fd = new FormData(form);
  const km = L.parseKm(fd.get('km'));
  const n = L.parseKm(fd.get('n'));
  const revKm = L.parseKm(fd.get('revKm'));
  const date = fd.get('date');
  const showErr = (m) => { const b = $('#form-err', form); b.textContent = m; b.hidden = false; scrollTo(0, 0); };
  if (!km || !n || !revKm || !date) return showErr('Preencha todos os campos.');
  if (revKm > km) return showErr('A km da revisão não pode ser maior que a km atual.');
  await db.saveSettings({
    name: fd.get('name').trim(), plate: '',
    lastRev: { n, date, km: revKm },
    setupKm: km, setupDate: L.todayISO(),
    startDate: L.addMonths(date, -12 * n),
    severeOil: form.severe.checked,
    lastBackup: null,
  });
  await refresh();
  maybePopup();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) maybePopup();
});

(async function start() {
  await refresh();
  maybePopup();
  navigator.storage?.persist?.().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
