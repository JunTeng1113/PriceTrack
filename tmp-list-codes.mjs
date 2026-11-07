import { readFileSync } from 'fs';
const s = JSON.parse(readFileSync('./public/data/series.json', 'utf8'));
const d = JSON.parse(readFileSync('./public/data/used.json', 'utf8'));

function collect(node, out) {
  if (Array.isArray(node)) {
    for (const x of node) collect(x, out);
    return;
  }
  if (node && typeof node === 'object') {
    for (const v of Object.values(node)) collect(v, out);
    return;
  }
  if (typeof node === 'string') out.push(node);
}

const codes = [];
collect(s, codes);
const uniq = [...new Set(codes)];
const targets = [
  /4060Ti.*16/i,
  /4060Ti.*8/i,
  /4070 SUPER/i,
  /4070Ti SUPER/i,
  /4070Ti(?! SUPER).*12/i,
  /4080.*16/i,
  /4090/i,
];
for (const re of targets) {
  console.log('\n##', re);
  console.log(uniq.filter((c) => re.test(c)).slice(0, 30).join('\n'));
}

const recent = d.posts.filter((p) => p.date === '2026-10-28');
console.log('\n## session 2026-10-28 count', recent.length);
for (const p of recent) console.log(p.code, p.price, p.link);
