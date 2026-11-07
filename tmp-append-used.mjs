import { readFileSync, writeFileSync } from 'node:fs';

const path = 'public/data/used.json';
const data = JSON.parse(readFileSync(path, 'utf8'));
const incoming = JSON.parse(readFileSync(process.argv[2] || 'tmp-batch.json', 'utf8'));

function strip(url) {
  const noHash = url.split('#')[0];
  const [base, query = ''] = noHash.split('?');
  if (base.includes('profile.php') && query.includes('id=')) {
    const id = new URLSearchParams(query).get('id');
    return id ? `${base}?id=${id}` : base;
  }
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

let added = 0;
for (const post of incoming) {
  const link = strip(post.link);
  const seller = strip(post.seller);
  const duplicate = data.posts.some(
    (existing) =>
      strip(existing.link) === link &&
      existing.code === post.code &&
      existing.price === post.price,
  );
  if (duplicate) {
    console.log('DUP', post.code, post.price, link);
    continue;
  }
  data.posts.push({
    code: post.code,
    date: post.date,
    price: post.price,
    link: link.endsWith('/') ? link : `${link}/`,
    seller,
  });
  added += 1;
  console.log('ADD', post.code, post.price, post.date);
}

writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
console.log('added', added, 'total', data.posts.length);
