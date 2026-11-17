export const SOURCE_URL = 'https://finance.naver.com/api/sise/etfItemList.nhn';
const TTL = 20000;
const STALE_LIMIT = 15 * 60 * 1000;
let saved = null;
let inflight = null;

export function validatePayload(value) {
  const items = value?.result?.etfItemList;
  if (value?.resultCode !== 'success' || !Array.isArray(items) || !items.length) throw new Error('Unexpected upstream response');
  const seen = new Set();
  for (const row of items) {
    if (!/^[A-Z0-9]{6}$/.test(row.itemcode) || typeof row.itemname !== 'string' || seen.has(row.itemcode)) throw new Error('Invalid or duplicate ETF');
    if (!Number.isFinite(Number(row.nowVal)) || !Number.isFinite(Number(row.marketSum))) throw new Error('Invalid ETF quote');
    seen.add(row.itemcode);
  }
  return items;
}

export async function getEtfData(fetcher = fetch) {
  const now = Date.now();
  if (saved && now - saved.at < TTL) return { ...saved.payload, cache: 'fresh' };
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const response = await fetcher(SOURCE_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 ETF-Atlas', 'Accept': 'application/json,text/plain,*/*', 'Referer': 'https://finance.naver.com/' },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Upstream HTTP ' + response.status);
      const bytes = await response.arrayBuffer();
      const charset = /utf-8/i.test(response.headers.get('content-type') || '') ? 'utf-8' : 'euc-kr';
      const items = validatePayload(JSON.parse(new TextDecoder(charset).decode(bytes)));
      const fetchedAt = new Date().toISOString();
      const payload = { items, fetchedAt, source: SOURCE_URL, quoteTimestamp: null, stale: false, cache: 'miss' };
      saved = { at: Date.now(), payload };
      return payload;
    } catch (error) {
      if (saved && Date.now() - saved.at < STALE_LIMIT) return { ...saved.payload, stale: true, cache: 'stale', warning: '시세 갱신에 실패하여 마지막 수신 데이터를 표시합니다.' };
      throw error;
    } finally { inflight = null; }
  })();
  return inflight;
}
