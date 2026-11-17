import { readFile, mkdir, writeFile } from 'node:fs/promises';
const assets = {};
for (const [file,type] of Object.entries({'index.html':'text/html; charset=utf-8','styles.css':'text/css; charset=utf-8','app.js':'text/javascript; charset=utf-8','domain.js':'text/javascript; charset=utf-8'})) {
  assets['/'+file] = { body: await readFile('public/'+file,'utf8'), type };
}
const provider = (await readFile('server/provider.mjs','utf8')).replace(/^export /gm,'');
const worker = (await readFile('server/worker.mjs','utf8')).replace(/^import .*;\n/gm,'');
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js', provider+'\nconst assets = '+JSON.stringify(assets)+';\n'+worker);
await writeFile('dist/.openai/hosting.json', await readFile('.openai/hosting.json'));
console.log('Built HTML dashboard and ETF proxy → dist/server/index.js');
