import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';

// GitHub Pages serves static files; the existing public Worker supplies quotes.
const apiUrl='https://etf-atlas-shw7003.bestflora.chatgpt.site/api/etfs';
const html=(await readFile('public/index.html','utf8')).replace(
  '<meta name="etf-api" content="/api/etfs">',
  `<meta name="etf-api" content="${apiUrl}">`
);
if (!html.includes(`<meta name="etf-api" content="${apiUrl}">`)) throw new Error('ETF API configuration marker is missing');
await mkdir('docs',{recursive:true});
await writeFile('docs/index.html',html);
await writeFile('docs/dashboard.html',html);
await writeFile('docs/.nojekyll','');
for(const file of ['styles.css','app.js','domain.js']) await copyFile('public/'+file,'docs/'+file);
console.log('GitHub Pages files ready in docs/ (main branch → /docs).');
