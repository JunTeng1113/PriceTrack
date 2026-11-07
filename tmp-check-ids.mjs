import { readFileSync } from 'fs';
const d = JSON.parse(readFileSync('./public/data/used.json', 'utf8'));
const s = JSON.parse(readFileSync('./public/data/series.json', 'utf8'));
const ids = [
  '1011058504876838',
  '1938795176815306',
  '1354789195981597',
  '2677083005995507',
  '1318377413582994',
];
for (const id of ids) {
  const hits = d.posts.filter((p) => p.link && p.link.includes(id));
  console.log(id, hits.length ? hits.map((h) => `${h.code}:${h.price}`).join(',') : 'NEW');
}

const codes = [];
function walk(o) {
  if (Array.isArray(o)) {
    o.forEach(walk);
    return;
  }
  if (o && typeof o === 'object') {
    Object.values(o).forEach(walk);
    return;
  }
  if (typeof o === 'string' && /RTX\s?4090/i.test(o) && !/\$\d*4090/.test(o)) {
    codes.push(o.split(',')[0].trim());
  }
}
walk(s);
console.log('4090 codes:');
console.log([...new Set(codes)].slice(0, 50).join('\n'));
