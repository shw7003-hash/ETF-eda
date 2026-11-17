import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../dist/server/index.js';

test('Pages entry resolves all assets under the repository path',async()=>{
  const html=await readFile('docs/dashboard.html','utf8');
  const base='https://shw7003-hash.github.io/ETF-eda/dashboard.html';
  for(const asset of ['./styles.css','./app.js']){
    assert.ok(html.includes('"'+asset+'"'));
    assert.ok(new URL(asset,base).pathname.startsWith('/ETF-eda/'));
    await readFile('docs/'+asset.slice(2));
  }
  assert.ok(html.includes('name="etf-api" content="https://etf-atlas-shw7003.bestflora.chatgpt.site/api/etfs"'));
  assert.equal(html,await readFile('docs/index.html','utf8'));
});
test('public quote responses permit the requested Pages origin without credentials',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({resultCode:'success',result:{etfItemList:[{itemcode:'069500',itemname:'KODEX 200',nowVal:10000,marketSum:100}]}}),{headers:{'Content-Type':'application/json;charset=utf-8'}}));
  const r=await worker.fetch(new Request('https://example.com/api/etfs',{headers:{Origin:'https://shw7003-hash.github.io'}}));
  assert.equal(r.status,200);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://shw7003-hash.github.io');
  assert.equal(r.headers.get('Access-Control-Allow-Credentials'),null);
  assert.equal((await r.json()).items[0].itemcode,'069500');
});
test('other origins receive no CORS grant and disallowed methods remain rejected',async()=>{
  const r=await worker.fetch(new Request('https://example.com/api/etfs',{method:'OPTIONS',headers:{Origin:'https://unrelated.example'}}));
  assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);
  const post=await worker.fetch(new Request('https://example.com/api/etfs',{method:'POST'}));
  assert.equal(post.status,405);
});
