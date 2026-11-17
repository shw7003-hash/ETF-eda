import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { getEtfData } from '../server/provider.mjs';
const types = {'/index.html':'text/html; charset=utf-8','/styles.css':'text/css; charset=utf-8','/app.js':'text/javascript; charset=utf-8','/domain.js':'text/javascript; charset=utf-8'};
const arg = name => { const at=process.argv.indexOf(name); return at>=0?process.argv[at+1]:undefined; };
const port = Number(arg('--port') || process.env.PORT || 3000);
const host = arg('--host') || '0.0.0.0';
createServer(async (req,res) => {
  const path = new URL(req.url,'http://localhost').pathname;
  try {
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
    if (path === '/api/etfs') {
      const data = await getEtfData();res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));return;
    }
    const file = path === '/' ? '/index.html' : path;
    if (!types[file]) {res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[file],'Cache-Control':'no-store'});res.end(await readFile(new URL('../public'+file,import.meta.url)));
  } catch (e) {console.error(e.message);res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'시세 수신에 실패했습니다. 잠시 후 다시 시도해 주세요.'}));}
}).listen(port,host,()=>console.log('ETF Atlas listening on http://'+host+':'+port));
