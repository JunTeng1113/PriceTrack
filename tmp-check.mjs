import { readFileSync } from 'fs';

const used = JSON.parse(readFileSync('./public/data/used.json', 'utf8'));
const series = JSON.parse(readFileSync('./public/data/series.json', 'utf8'));

const codes40 = [...new Set(
  series.quotes
    .map((q) => q.code)
    .filter((c) => /RTX ?40|4060|4070|4080|4090/i.test(c) && !/筆電|NB|Laptop/i.test(c)),
)];

const used40 = used.posts.filter((p) => /40|4060|4070|4080|4090/.test(p.code));
const usedCodes = new Set(used40.map((p) => p.code));
const missing = codes40.filter((c) => !usedCodes.has(c));

console.log('used total', used.posts.length);
console.log('used40 posts', used40.length);
console.log('coolpc40 codes', codes40.length);
console.log('missing count', missing.length);
console.log('missing sample:');
missing.slice(0, 60).forEach((c) => console.log(' -', c));
