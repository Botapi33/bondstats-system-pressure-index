export const DATA_URL = 'https://botapi33.github.io/bondstats-global-yields/global_yields.json';

export const CONFIG = Object.freeze({
  maxFreshDays: 7,
  minEligibleMarkets: 5,
  weights: Object.freeze({ level: 40, move: 25, breadth: 20, direction: 15 }),
  breadthThresholdBps: 3,
  directionThresholdBps: 1
});

const STATE_BANDS = [
  [24, 'Contained'],
  [39, 'Normal'],
  [54, 'Pressure Building'],
  [69, 'Elevated'],
  [84, 'High'],
  [100, 'Extreme']
];

const clamp = (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

export function linearScore(value, stops) {
  if (!Number.isFinite(value)) return null;
  if (value <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i += 1) {
    const [x1, y1] = stops[i];
    const [x0, y0] = stops[i - 1];
    if (value <= x1) return y0 + ((value - x0) * (y1 - y0)) / (x1 - x0);
  }
  return stops[stops.length - 1][1];
}

export function median(values) {
  const a = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function parseNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace('%', '').replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
}

export function parseDataset(raw) {
  if (!raw || typeof raw !== 'object' || !raw.countries || typeof raw.countries !== 'object') {
    throw new Error('Unexpected BondStats JSON schema: missing countries object.');
  }

  const markets = Object.entries(raw.countries).map(([key, row]) => {
    const value = parseNumber(row.value);
    const previousValue = parseNumber(row.previousValue);
    const rawChange = parseNumber(row.change);
    const changePctPoints = rawChange ?? (Number.isFinite(value) && Number.isFinite(previousValue) ? value - previousValue : null);
    const changeBps = Number.isFinite(changePctPoints) ? changePctPoints * 100 : null;
    const stalenessDays = parseNumber(row.stalenessDays);
    return {
      key,
      label: row.label || key.replaceAll('_', ' '),
      source: row.source || 'unknown',
      frequency: row.frequency || 'Unknown',
      date: row.date || '',
      previousDate: row.previousDate || '',
      value,
      previousValue,
      changePctPoints,
      changeBps,
      stalenessDays,
      tier: row.tier || 'unknown',
      isFallback: Boolean(row.isFallback)
    };
  }).filter(m => Number.isFinite(m.value));

  if (!markets.length) throw new Error('BondStats JSON contains no numeric market values.');
  return {
    meta: {
      title: raw.meta?.title || 'BondStats Global Yields',
      lastUpdated: raw.meta?.lastUpdated || ''
    },
    markets
  };
}

export function isEligible(m, config = CONFIG) {
  return String(m.frequency).toLowerCase() === 'daily'
    && Number.isFinite(m.value)
    && Number.isFinite(m.changeBps)
    && Number.isFinite(m.stalenessDays)
    && m.stalenessDays <= config.maxFreshDays
    && !m.isFallback;
}

export function yieldLevelScore(yieldPct) {
  return clamp(linearScore(yieldPct, [
    [0, 0], [1, 8], [2, 20], [3, 35], [4, 55], [5, 72], [6, 84], [8, 96], [10, 100]
  ]));
}

export function moveIntensityScore(absMoveBps) {
  return clamp(linearScore(absMoveBps, [
    [0, 0], [1, 8], [2, 18], [3, 30], [5, 48], [8, 66], [12, 80], [20, 93], [30, 100]
  ]));
}

export function marketPressure(m) {
  const level = yieldLevelScore(m.value);
  const move = moveIntensityScore(Math.abs(m.changeBps || 0));
  const rising = Number.isFinite(m.changeBps) && m.changeBps > CONFIG.directionThresholdBps
    ? linearScore(m.changeBps, [[1, 10], [3, 35], [5, 60], [10, 85], [20, 100]])
    : 0;
  return clamp(level * 0.6 + move * 0.25 + rising * 0.15);
}

export function stateFor(score) {
  if (!Number.isFinite(score)) return 'Unavailable';
  return STATE_BANDS.find(([max]) => score <= max)?.[1] || 'Extreme';
}

export function stateNarrative(score) {
  const state = stateFor(score);
  const map = {
    Contained: 'Sovereign-rate pressure is contained across the fresh daily market set. Current moves are limited and broad stress is not evident.',
    Normal: 'The sovereign complex is operating within a normal pressure range. Financing levels remain meaningful, but daily moves are broadly orderly.',
    'Pressure Building': 'Pressure is building across the monitored sovereign complex. Yield levels, daily moves or breadth are becoming more demanding.',
    Elevated: 'Elevated pressure is visible across several dimensions of the fresh daily sovereign-rate set and warrants closer monitoring.',
    High: 'High sovereign-rate pressure is present across the monitored market set, with substantial movement or broad participation in the stress signal.',
    Extreme: 'The index is registering extreme sovereign-rate pressure under the published methodology. Underlying markets should be reviewed individually.'
  };
  return map[state] || 'The current reading is unavailable.';
}

export function computeIndex(dataset, config = CONFIG) {
  const eligible = dataset.markets.filter(m => isEligible(m, config));
  const excluded = dataset.markets.filter(m => !isEligible(m, config));
  if (eligible.length < config.minEligibleMarkets) {
    throw new Error(`Only ${eligible.length} fresh daily markets are eligible; at least ${config.minEligibleMarkets} are required.`);
  }

  const medianYield = median(eligible.map(m => m.value));
  const medianAbsMove = median(eligible.map(m => Math.abs(m.changeBps)));
  const breadthShare = eligible.filter(m => Math.abs(m.changeBps) >= config.breadthThresholdBps).length / eligible.length;
  const risingShare = eligible.filter(m => m.changeBps >= config.directionThresholdBps).length / eligible.length;

  const components = [
    {
      id: 'level',
      name: 'Yield Level',
      weight: config.weights.level,
      score: yieldLevelScore(medianYield),
      metric: `${medianYield.toFixed(2)}%`,
      description: 'Median 10Y yield across fresh daily markets.'
    },
    {
      id: 'move',
      name: 'Move Intensity',
      weight: config.weights.move,
      score: moveIntensityScore(medianAbsMove),
      metric: `${medianAbsMove.toFixed(1)} bp`,
      description: 'Median absolute daily yield move across fresh markets.'
    },
    {
      id: 'breadth',
      name: 'Stress Breadth',
      weight: config.weights.breadth,
      score: clamp(breadthShare * 100),
      metric: `${Math.round(breadthShare * 100)}%`,
      description: `Share of fresh markets moving at least ${config.breadthThresholdBps} bp in either direction.`
    },
    {
      id: 'direction',
      name: 'Upward Pressure',
      weight: config.weights.direction,
      score: clamp(risingShare * 100),
      metric: `${Math.round(risingShare * 100)}%`,
      description: `Share of fresh markets with yields rising at least ${config.directionThresholdBps} bp.`
    }
  ];

  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const score = components.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight;
  const ranking = [...eligible].map(m => ({ ...m, pressure: marketPressure(m) })).sort((a, b) => b.pressure - a.pressure);
  const rising = eligible.filter(m => m.changeBps > 0).length;
  const falling = eligible.filter(m => m.changeBps < 0).length;
  const flat = eligible.length - rising - falling;
  const largestMove = [...eligible].sort((a, b) => Math.abs(b.changeBps) - Math.abs(a.changeBps))[0];
  const highestYield = [...eligible].sort((a, b) => b.value - a.value)[0];

  const dataQuality = {
    total: dataset.markets.length,
    eligible: eligible.length,
    excluded: excluded.length,
    stale: excluded.filter(m => Number.isFinite(m.stalenessDays) && m.stalenessDays > config.maxFreshDays).length,
    monthly: excluded.filter(m => String(m.frequency).toLowerCase() !== 'daily').length,
    fallback: excluded.filter(m => m.isFallback).length
  };

  return {
    score,
    state: stateFor(score),
    narrative: stateNarrative(score),
    components,
    eligible,
    excluded,
    ranking,
    stats: { medianYield, medianAbsMove, breadthShare, risingShare, rising, falling, flat, largestMove, highestYield },
    dataQuality,
    meta: dataset.meta
  };
}
