import assert from 'node:assert/strict';
import { parseDataset, computeIndex, isEligible } from '../engine.js';

const countries = {};
const rows = [
  ['united_states','United States',4.70,4.74,-0.04],
  ['euro_area','Euro Area',3.28,3.27,0.01],
  ['united_kingdom','United Kingdom',5.05,5.07,-0.02],
  ['germany','Germany',3.25,3.26,-0.01],
  ['france','France',4.12,4.13,-0.01],
  ['norway','Norway',4.41,4.39,0.02]
];
for (const [key,label,value,previousValue,change] of rows) {
  countries[key] = {label,source:'test',frequency:'Daily',date:'2026-08-24',value,previousDate:'2026-08-21',previousValue,change,stalenessDays:2,tier:'delayed',isFallback:false};
}
countries.stale = {label:'Stale',source:'test',frequency:'Monthly',date:'2026-06-01',value:9,previousValue:8.8,change:.2,stalenessDays:86,tier:'monthly',isFallback:false};

const dataset = parseDataset({meta:{lastUpdated:'2026-08-26'},countries});
assert.equal(dataset.markets.length, 7);
assert.equal(dataset.markets.filter(m => isEligible(m)).length, 6);
const result = computeIndex(dataset);
assert.ok(result.score >= 0 && result.score <= 100);
assert.equal(result.eligible.length, 6);
assert.equal(result.excluded.length, 1);
assert.equal(result.components.length, 4);
assert.equal(result.stats.largestMove.label, 'United States');
console.log(`engine ok · score ${result.score.toFixed(2)} · state ${result.state}`);
