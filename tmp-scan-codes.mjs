import { readFileSync, writeFileSync } from 'node:fs';

const used = JSON.parse(readFileSync('public/data/used.json', 'utf8'));
const ids = new Set();
for (const p of used.posts) {
  const m = (p.link || '').match(/item\/(\d+)/);
  if (m) ids.add(m[1]);
  const g = (p.link || '').match(/groups\/\d+\/posts\/(\d+)/);
  if (g) ids.add(g[1]);
}
writeFileSync('tmp-existing-ids.json', JSON.stringify([...ids]));
console.log('ids', ids.size);

const raw = readFileSync('public/data/series.json', 'utf8');
const re4060 = /"([^"]*4060[^"]*8G[^"]*)"/g;
const re4070 = /"([^"]*4070[^"]*12G[^"]*)"/g;
const pick = (re) => {
  const out = new Set();
  let m;
  while ((m = re.exec(raw)) !== null) {
    if (!/ti|super/i.test(m[1])) out.add(m[1]);
  }
  return [...out];
};
console.log('4060 CoolPC', pick(re4060).join('\n'));
console.log('---');
console.log('4070 CoolPC', pick(re4070).join('\n'));
