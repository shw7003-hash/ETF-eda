export const MARKETS = {1:'국내 시장지수',2:'국내 업종·테마',3:'국내 파생',4:'해외 주식',5:'원자재',6:'채권',7:'기타'};
export const MANAGERS = {KODEX:'삼성자산운용',TIGER:'미래에셋자산운용',RISE:'KB자산운용',ACE:'한국투자신탁운용',PLUS:'한화자산운용',SOL:'신한자산운용',KIWOOM:'키움투자자산운용',HANARO:'NH-Amundi자산운용','1Q':'하나자산운용',KoAct:'삼성액티브자산운용',TIME:'타임폴리오자산운용',WON:'우리자산운용',IBK:'IBK자산운용','마이티':'DB자산운용','에셋플러스':'에셋플러스자산운용',MIDAS:'마이다스에셋자산운용',BNK:'BNK자산운용',FOCUS:'브이아이자산운용',HK:'흥국자산운용',UNICORN:'현대자산운용',DAISHIN:'대신자산운용',DS:'DS자산운용',TRUSTON:'트러스톤자산운용',KCGI:'KCGI자산운용'};
export const PRODUCTS = ['커버드콜','인버스','레버리지','금리·현금성','채권형','원자재형','배당형','주식·테마형','기타·혼합형'];
export const COLORS = ['#007f72','#479d8b','#77b5a7','#9bcdb5','#b9ddc8','#8ba8b0','#becbd0','#d7e0de'];
export function number(value) { return value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value); }
export function product(row) {
  const n=row.itemname;
  if (/커버드콜|타겟커버드|프리미엄분배/.test(n)) return '커버드콜';
  if (/인버스/.test(n)) return '인버스';
  if (/레버리지|2X|3X/i.test(n)) return '레버리지';
  if (/CD금리|KOFR|SOFR|머니마켓|파킹|금리액티브|단기자금/i.test(n)) return '금리·현금성';
  if (row.etfTabCode===6) return '채권형';
  if (row.etfTabCode===5) return '원자재형';
  if (/배당/.test(n)) return '배당형';
  if ([1,2,3,4].includes(row.etfTabCode)) return '주식·테마형';
  return '기타·혼합형';
}
export function normalize(items) {
  return items.map(row=>{
    const r={...row};
    for(const key of ['nowVal','changeVal','changeRate','nav','threeMonthEarnRate','quant','amonut','marketSum','etfTabCode']) r[key]=number(row[key]);
    r.brand=r.itemname.split(' ')[0];r.manager=MANAGERS[r.brand]||r.brand+' (브랜드)';
    r.market=MARKETS[r.etfTabCode]||'미분류';r.product=product(r);
    r.premium=r.nav>0&&r.nowVal!==null?(r.nowVal/r.nav-1)*100:null;
    return r;
  });
}
export const sum = (rows,key)=>rows.reduce((v,r)=>v+(r[key]??0),0);
export function mean(rows,key){const a=rows.filter(r=>r[key]!==null&&Number.isFinite(r[key]));return a.length?sum(a,key)/a.length:null;}
export function groups(rows,key){const m=new Map();for(const r of rows){if(!m.has(r[key]))m.set(r[key],[]);m.get(r[key]).push(r);}return [...m].map(([name,items])=>({name,items,count:items.length,cap:sum(items,'marketSum'),amount:sum(items,'amonut')/100,rate:mean(items,'changeRate')})).sort((a,b)=>b.cap-a.cap);}
export function filterRows(rows,s){const q=s.query.trim().toLocaleLowerCase();return rows.filter(r=>(!q||(r.itemname+' '+r.itemcode+' '+r.manager).toLocaleLowerCase().includes(q))&&(!s.manager||r.brand===s.manager)&&(!s.market||String(r.etfTabCode)===s.market)&&(!s.product||r.product===s.product)&&(!s.favoritesOnly||s.favorites.has(r.itemcode)));}
export function sortRows(rows,key,dir){return [...rows].sort((a,b)=>{const x=a[key],y=b[key];if(x==null)return y==null?0:1;if(y==null)return -1;return (typeof x==='string'?x.localeCompare(y,'ko'):x-y)*(dir==='asc'?1:-1);});}
export const fmt=(x,d=0)=>x==null?'—':Number(x).toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d});
export const pct=(x,d=2)=>x==null?'—':(x>0?'+':'')+fmt(x,d)+'%';
export const cap=(x)=>x==null?'—':x>=10000?fmt(x/10000,2)+'조':fmt(x,x>=1000?0:x>=1?1:2)+'억';
export const tone=(x)=>x>0?'up':x<0?'down':'neutral';
export function csv(rows){const headers=['종목코드','종목명','운용사(브랜드매핑)','브랜드','시장','상품유형(규칙분류)','현재가(원)','등락률(%)','3개월수익률(%)','NAV(원)','괴리율(%)','거래량(주)','거래대금(백만원)','시가총액(억원)'];const keys=['itemcode','itemname','manager','brand','market','product','nowVal','changeRate','threeMonthEarnRate','nav','premium','quant','amonut','marketSum'];const cell=v=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};return '\ufeff'+[headers.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\r\n');}
