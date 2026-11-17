import { getEtfData } from './provider.mjs';
import { assets } from './assets.generated.mjs';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const headers = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };
    if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed', {status:405,headers:{...headers,Allow:'GET, HEAD'}});
    if (url.pathname === '/api/etfs') {
      try {
        return Response.json(await getEtfData(), {headers:{...headers,'Cache-Control':'no-store'}});
      } catch {
        return Response.json({error:'네이버 시세를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}, {status:502,headers:{...headers,'Cache-Control':'no-store'}});
      }
    }
    const asset = assets[url.pathname === '/' ? '/index.html' : url.pathname];
    if (!asset) return new Response('Not found', {status:404,headers});
    return new Response(request.method === 'HEAD' ? null : asset.body, { headers: {...headers,'Content-Type':asset.type,'Cache-Control':'no-cache'} });
  }
};
