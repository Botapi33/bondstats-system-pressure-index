import { DATA_URL, CONFIG, parseDataset, computeIndex, stateFor } from './engine.js';

const $ = id => document.getElementById(id);
let current = null;

function esc(v) {
  return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? v : new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(d);
}
function fmtBp(v) { return Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toFixed(1)} bp` : '—'; }
function stateClass(state) { return `state-${String(state).toLowerCase().replaceAll(' ','-')}`; }

function renderGauge(score) {
  const pct = Math.max(0, Math.min(100, score));
  $('gaugeFill').style.width = `${pct}%`;
  $('gaugeMarker').style.left = `${pct}%`;
}

function renderComponents(items) {
  $('components').innerHTML = items.map(c => `
    <article class="driver">
      <div class="driver-head"><span>${esc(c.name)}</span><strong>${Math.round(c.score)}</strong></div>
      <div class="driver-meta"><span>${esc(c.metric)}</span><span>${c.weight}% weight</span></div>
      <div class="driver-track"><i style="width:${Math.max(0,Math.min(100,c.score))}%"></i></div>
      <p>${esc(c.description)}</p>
    </article>`).join('');
}

function renderPulse(result) {
  const s = result.stats;
  const rows = [
    ['Highest yield', `${s.highestYield.label} · ${s.highestYield.value.toFixed(2)}%`],
    ['Largest daily move', `${s.largestMove.label} · ${fmtBp(s.largestMove.changeBps)}`],
    ['Direction', `${s.rising} rising · ${s.falling} falling${s.flat ? ` · ${s.flat} flat` : ''}`],
    ['Fresh-market median', `${s.medianYield.toFixed(2)}% · |move| ${s.medianAbsMove.toFixed(1)} bp`]
  ];
  $('pulse').innerHTML = rows.map(([a,b]) => `<div class="pulse-row"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join('');
}

function renderRanking(result, filter='') {
  const q = filter.trim().toLowerCase();
  const rows = result.ranking.filter(m => !q || m.label.toLowerCase().includes(q));
  $('marketRows').innerHTML = rows.map(m => `
    <tr>
      <td><div class="market-name">${esc(m.label)}</div><div class="market-source">${esc(m.source)} · ${esc(m.tier)}</div></td>
      <td>${m.value.toFixed(3)}%</td>
      <td class="${m.changeBps > 0 ? 'up' : m.changeBps < 0 ? 'down' : ''}">${fmtBp(m.changeBps)}</td>
      <td><span class="rank-score">${Math.round(m.pressure)}</span></td>
      <td>${fmtDate(m.date)}</td>
    </tr>`).join('') || `<tr><td colspan="5" class="empty">No matching fresh daily markets.</td></tr>`;
}

function renderCoverage(result) {
  const q = result.dataQuality;
  $('quality').innerHTML = `
    <div><span>Eligible daily markets</span><strong>${q.eligible}</strong></div>
    <div><span>Total markets in source</span><strong>${q.total}</strong></div>
    <div><span>Excluded from live score</span><strong>${q.excluded}</strong></div>
    <div><span>Monthly / stale observations</span><strong>${Math.max(q.monthly,q.stale)}</strong></div>`;

  $('eligibleList').innerHTML = result.eligible.map(m => `<span>${esc(m.label)}</span>`).join('');
  $('exclusionText').textContent = `Only non-fallback Daily observations with staleness ≤ ${CONFIG.maxFreshDays} days enter the current score. Monthly and stale markets remain in the source dataset but are intentionally excluded from the live pressure calculation.`;
}

function render(result) {
  current = result;
  const score = Math.round(result.score);
  $('score').textContent = score;
  $('state').textContent = result.state;
  $('state').className = `state-label ${stateClass(result.state)}`;
  $('narrative').textContent = result.narrative;
  $('sourceUpdated').textContent = fmtDate(result.meta.lastUpdated);
  $('observationDate').textContent = fmtDate(result.eligible.map(m=>m.date).sort().at(-1));
  $('eligibleCount').textContent = `${result.eligible.length} markets`;
  $('methodVersion').textContent = 'v1.0 · transparent snapshot';
  $('statusText').textContent = 'Latest available';
  $('statusDot').className = 'status-dot ok';
  renderGauge(score);
  renderComponents(result.components);
  renderPulse(result);
  renderRanking(result, $('search').value);
  renderCoverage(result);
}

async function load() {
  $('errorBox').hidden = true;
  $('statusText').textContent = 'Updating';
  $('statusDot').className = 'status-dot loading';
  $('refreshBtn').disabled = true;
  try {
    const response = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`BondStats data returned HTTP ${response.status}.`);
    const raw = await response.json();
    const dataset = parseDataset(raw);
    const result = computeIndex(dataset);
    render(result);
  } catch (err) {
    console.error(err);
    $('statusText').textContent = 'Data unavailable';
    $('statusDot').className = 'status-dot bad';
    $('errorBox').hidden = false;
    $('errorBox').innerHTML = `<strong>Unable to calculate the current index.</strong><span>${esc(err.message)}</span><code>${esc(DATA_URL)}</code>`;
  } finally {
    $('refreshBtn').disabled = false;
  }
}

$('refreshBtn').addEventListener('click', load);
$('search').addEventListener('input', e => current && renderRanking(current, e.target.value));
load();
