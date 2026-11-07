import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync('public/data/used.json', 'utf8'));
const urls = [
  'https://www.facebook.com/groups/graphicard/posts/1995448091401442/',
  'https://www.facebook.com/groups/graphicard/posts/2167326530880263/',
  'https://www.facebook.com/groups/382189418643825/posts/2990240994505308/',
  'https://www.facebook.com/groups/taipeibuyselltogo/posts/4353141641607849/',
  'https://www.facebook.com/groups/382189418643825/posts/2547849525411126/',
  'https://www.facebook.com/groups/382189418643825/posts/3203057403223665/',
  'https://www.facebook.com/groups/graphicard/posts/2125430928403157/',
  'https://www.facebook.com/groups/1923977991158636/posts/4627793184110423/',
  'https://www.facebook.com/groups/graphicard/posts/1776362583309995/',
  'https://www.facebook.com/groups/565034810263428/posts/27451804687826409/',
  'https://www.facebook.com/groups/graphicard/posts/1703037163975871/',
  'https://www.facebook.com/groups/desktopComputer/posts/27364358183237322/',
];

for (const u of urls) {
  const id = u.split('/').filter(Boolean).pop();
  const hit = data.posts.some((p) => p.link.includes(id));
  console.log(hit ? 'HAVE' : 'NEW ', id);
}
