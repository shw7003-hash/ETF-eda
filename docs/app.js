import { MARKETS, MANAGERS, PRODUCTS, COLORS, normalize, sum, mean, groups, filterRows, sortRows, fmt, pct, cap, tone, csv } from './domain.js';
const $=id=>document.getElementById(id);
const API_URL=document.querySelector('meta[name="etf-api"]')?.content||'/api/etfs';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function loadFavorites(){try{const v=JSON.parse(localStorage.getItem('etf-atlas-favorites')||'[]');return new Set(Array.isArray(v)?v.filter(x=>typeof x==='string'):[]);}catch{return new Set();}}
const state={rows:[],query:'',manager:'',market:'',product:'',favoritesOnly:false,favorites:loadFavorites(),compare:new Set(),view:'overview',sort:'marketSum',dir:'desc',page:1,size:20,interval:60,remaining:60,fetchedAt:null,busy:false,stale:false};
const viewInfo={overview:['시장 개요','시장을 넓게, 투자를 깊게.','국내 상장 ETF의 흐름을 운용사·시장·상품별로 살펴보세요.'],manager:['운용사 분석','어떤 운용사가 시장을 이끌까요?','브랜드별 상품 구성과 규모, 평균 등락률을 비교해 보세요.'],market:['시장별 분석','자금이 모이는 시장을 발견하세요.','네이버의 7개 시장 분류를 기준으로 ETF 시장을 살펴보세요.'],product:['상품별 분석','전략이 다른 ETF, 한눈에 비교.','주식·채권부터 배당과 커버드콜까지, 상품 유형을 탐색하세요.']};
const time=iso=>new Date(iso).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
const date=iso=>new Date(iso).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
const rows=()=>sortRows(filterRows(state.rows,state),state.sort,state.dir);
let toastTimer,searchTimer;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2800);}
function notify(message){$('notice').textContent=message;$('notice').hidden=!message;}
function setOptions(){
  const available=[...new Set(state.rows.map(r=>r.brand))].sort((a,b)=>a.localeCompare(b));
  $('manager').innerHTML='<option value="">전체 운용사</option>'+available.map(b=>`<option value="${escape(b)}">${escape(b)} · ${escape(MANAGERS[b]||'브랜드')}</option>`).join('');
  $('market').innerHTML='<option value="">전체 시장</option>'+Object.entries(MARKETS).map(([id,n])=>`<option value="${id}">${n}</option>`).join('');
  $('product').innerHTML='<option value="">전체 상품</option>'+PRODUCTS.map(n=>`<option>${n}</option>`).join('');
}
function updateStatus(){
  $('data-status').textContent=state.stale?'갱신 지연 · 이전 데이터':state.rows.length?'시세 수신 완료':'연결 대기';
  $('status-dot').className='dot'+(state.stale?' stale':'');
  if(state.fetchedAt)$('fetched-time').textContent=`수신 ${date(state.fetchedAt)} ${time(state.fetchedAt)} KST · 거래시각 미제공`;
}
async function refresh(manual=false){
  if(state.busy)return;state.busy=true;$('refresh').disabled=true;$('refresh-icon').classList.add('spinning');
  try{
    const res=await fetch(API_URL,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(22000)});
    if(!res.ok)throw new Error('HTTP '+res.status);
    const data=await res.json();
    if(!Array.isArray(data.items)||!data.items.length||!data.fetchedAt)throw new Error('Invalid data');
    state.rows=normalize(data.items);state.fetchedAt=data.fetchedAt;state.stale=!!data.stale;
    setOptions();render();
    notify(data.stale?'시세 갱신이 지연되고 있습니다. 마지막 수신 데이터와 수신시각을 확인해 주세요.':'');
    if(manual&&!data.stale)toast('시세를 새로 불러왔습니다.');
  }catch(error){
    state.stale=true;
    notify(state.rows.length?'시세 갱신에 실패했습니다. 화면에는 마지막 수신 데이터가 유지됩니다.':'네이버 시세를 불러오지 못했습니다. 잠시 후 ‘시세 새로고침’을 눌러 주세요.');
    if(!state.rows.length){$('etf-body').innerHTML='<tr><td colspan="9" class="empty-cell">시세를 불러오지 못했습니다.<br><button class="button outline" data-retry>다시 시도</button></td></tr>';$('bar-chart').innerHTML='<div class="empty-cell">연결 후 분석이 표시됩니다.</div>';$('allocation').innerHTML='<div class="empty-cell">데이터 수신 대기 중</div>';}
  }finally{state.busy=false;state.remaining=state.interval;updateStatus();$('refresh').disabled=false;$('refresh-icon').classList.remove('spinning');}
}
function syncFilters(){
  for(const id of ['manager','market','product','query'])$(id).value=state[id];
  $('favorites-toggle').setAttribute('aria-pressed',String(state.favoritesOnly));
  $('favorites-toggle').textContent=state.favoritesOnly?'★ 관심 ETF':'☆ 관심 ETF';
  $('favorite-count').textContent=state.favorites.size;
  $('watch-nav').classList.toggle('active',state.favoritesOnly);
  const summary=[state.manager&&`${state.manager} · ${MANAGERS[state.manager]||'브랜드'}`,state.market&&MARKETS[state.market],state.product,state.query&&'검색: '+state.query,state.favoritesOnly&&'관심 ETF'].filter(Boolean);
  $('filter-summary').hidden=!summary.length;$('filter-summary').innerHTML=summary.map(x=>`<span>${escape(x)}</span>`).join('');
  document.querySelectorAll('[data-quick]').forEach(b=>{const q=b.dataset.quick;b.classList.toggle('active',q==='all'?!state.market&&!state.product:q===state.market||q===state.product);});
}
function render(){
  syncFilters();const data=rows();const totalCap=sum(data,'marketSum');const rate=mean(data,'changeRate');
  $('kpi-count').textContent=fmt(data.length);$('kpi-cap').textContent=cap(totalCap);$('kpi-volume').textContent=cap(sum(data,'amonut')/100);
  $('kpi-managers').textContent=`${fmt(new Set(data.map(r=>r.brand)).size)}개 브랜드 · 조회 조건 기준`;
  $('kpi-rate').textContent=pct(rate);$('kpi-rate').className=tone(rate);$('kpi-breadth').textContent=`상승 ${fmt(data.filter(r=>r.changeRate>0).length)}개 · 하락 ${fmt(data.filter(r=>r.changeRate<0).length)}개 / 단순 평균`;
  renderCharts(data);renderBreadth(data);renderGroups(data);renderTable(data);renderCompareBar();
}
function groupKey(){return state.view==='market'?'market':state.view==='product'?'product':'brand';}
function renderCharts(data){
  const key=groupKey(),g=groups(data,key),chart=g.slice(0,6),all=sum(data,'marketSum');
  const titles={brand:['시장을 움직이는 운용사','시가총액 상위 6개 · 브랜드별 비교','운용사'],market:['시장이 만드는 기회','시가총액 상위 6개 · 시장별 비교','시장'],product:['전략별 시장의 크기','시가총액 상위 6개 · 상품 유형별 비교','상품']};
  $('chart-title').textContent=titles[key][0];$('chart-description').textContent=titles[key][1];
  $('chart-footnote').textContent=`막대를 누르면 해당 ${titles[key][2]}로 필터링합니다.`;
  $('chart-switch').textContent=state.view==='overview'?'운용사 분석 보기 ↗':'필터 초기화 ↺';
  $('bar-chart').innerHTML=chart.length?chart.map((r,i)=>`<button class="bar-row" data-group-key="${key}" data-group="${escape(r.name)}" title="${escape(r.name)} · ${fmt(r.cap)}억원 · 클릭하여 필터링"><span class="bar-label">${escape(r.name)}</span><span class="bar-track"><span class="bar-fill" style="width:${chart[0].cap?Math.max(1,r.cap/chart[0].cap*100):0}%;background:${COLORS[i]}"></span></span><span class="bar-value">${cap(r.cap)}원</span></button>`).join(''):'<div class="empty-cell">조건에 맞는 ETF가 없습니다.</div>';
  const allocKey=state.view==='market'?'product':'market';
  $('allocation-title').textContent=state.view==='market'?'어떤 전략을 선택했을까?':'어디에 투자하고 있을까?';
  $('allocation-description').textContent=(allocKey==='product'?'상품 유형별':'시장별')+' 시가총액 비중';
  const list=groups(data,allocKey),shown=list.length<=7?[...list]:list.slice(0,6);if(list.length>7)shown.push({name:'그 외',cap:list.slice(6).reduce((s,g)=>s+g.cap,0),remainder:true});
  if(!data.length||!all){$('allocation').innerHTML='<div class="empty-cell">표시할 데이터가 없습니다.</div>';return;}
  let acc=0;const stops=shown.map((g,i)=>{const start=acc;acc+=g.cap/all*100;return `${COLORS[i]} ${start}% ${acc}%`;});
  $('allocation').innerHTML=`<div class="donut" role="img" aria-label="${escape(shown.map(g=>g.name+' '+fmt(g.cap/all*100,1)+'%').join(', '))}" style="background:conic-gradient(${stops.join(',')})"><div class="donut-center"><span>전체 시가총액</span><b>${cap(all)}원</b><small>${fmt(data.length)}개 ETF</small></div></div><div class="legend">${shown.map((g,i)=>`<button class="legend-row" ${g.remainder?'disabled':`data-group-key="${allocKey}" data-group="${escape(g.name)}"`}><span class="legend-color" style="background:${COLORS[i]}"></span><span class="legend-name">${escape(g.name)}</span><span class="legend-pct">${fmt(g.cap/all*100,1)}%</span></button>`).join('')}</div>`;
}
function renderBreadth(data){
  const rise=data.filter(r=>r.changeRate>0).length,fall=data.filter(r=>r.changeRate<0).length,flat=data.filter(r=>r.changeRate===0).length,unknown=data.length-rise-fall-flat,total=rise+fall+flat;
  $('breadth').innerHTML=`<div class="breadth-labels"><span>상승 ${fmt(rise)}</span><span>보합 ${fmt(flat)}</span><span>하락 ${fmt(fall)}</span></div><div class="breadth-track" aria-label="상승 ${rise}, 보합 ${flat}, 하락 ${fall}, 미제공 ${unknown}"><span style="width:${total?rise/total*100:0}%;background:#d7837b"></span><span style="width:${total?flat/total*100:0}%;background:#c2cdbf"></span><span style="width:${total?fall/total*100:0}%;background:#79a2d1"></span></div>`;
  const biggest=groups(data,'market')[0];
  $('insight-copy').innerHTML=biggest?`조회 ETF 중 <b>${escape(biggest.name)}</b> 시장의<br>시가총액 비중이 <b>${fmt(biggest.cap/sum(data,'marketSum')*100,1)}%</b>로 가장 높습니다.`:'조회 조건을 변경해 ETF를 탐색해 보세요.';
  $('insight-subtitle').textContent=unknown?`미제공 ${unknown}개 제외`:'제공 시세 기준';
}
function renderGroups(data){
  const key=groupKey(),names={brand:'운용사 · 브랜드',market:'시장',product:'상품 유형'};
  $('group-panel').hidden=state.view==='overview';if(state.view==='overview')return;
  const gs=groups(data,key),total=sum(data,'marketSum');$('group-title').textContent=names[key]+'별 상세 비교';$('group-name-label').textContent=names[key];$('group-count').textContent=gs.length+'개 그룹';
  $('group-body').innerHTML=gs.length?gs.map((g,i)=>`<tr><td><button class="group-button" data-group-key="${key}" data-group="${escape(g.name)}">${String(i+1).padStart(2,'0')}&nbsp; ${escape(g.name)}${key==='brand'?`<span class="group-sub">${escape(MANAGERS[g.name]||'운용사 미확인 · 브랜드 기준')}</span>`:''}</button></td><td>${fmt(g.count)}개</td><td>${cap(g.cap)}원</td><td>${total?fmt(g.cap/total*100,1):'0.0'}%</td><td>${cap(g.amount)}원</td><td class="${tone(g.rate)}">${pct(g.rate)}</td></tr>`).join(''):'<tr><td colspan="6" class="empty-cell">조회 조건에 맞는 그룹이 없습니다.</td></tr>';
}
function renderTable(data=rows()){
  const pages=Math.max(1,Math.ceil(data.length/state.size));state.page=Math.min(state.page,pages);const start=(state.page-1)*state.size,display=data.slice(start,start+state.size);
  $('result-count').textContent=fmt(data.length);$('page-info').textContent=`전체 ${fmt(data.length)}개 중 ${data.length?fmt(start+1):0}–${fmt(Math.min(start+state.size,data.length))}개 표시`;
  $('page-number').textContent=state.page+' / '+pages;$('prev-page').disabled=state.page<=1;$('next-page').disabled=state.page>=pages;$('export').disabled=!data.length;
  document.querySelectorAll('[data-sort]').forEach(b=>{const is=b.dataset.sort===state.sort;b.parentElement.setAttribute('aria-sort',is?(state.dir==='asc'?'ascending':'descending'):'none');b.querySelector('span').textContent=is?(state.dir==='asc'?'↑':'↓'):'↕';});
  const sortValue=state.sort+':'+state.dir;
  $('sort-select').querySelector('[data-dynamic]')?.remove();
  if(![...$('sort-select').options].some(o=>o.value===sortValue)){
    const label={itemname:'상품명',nowVal:'현재가',changeRate:'등락률',threeMonthEarnRate:'3개월 수익률',marketSum:'시가총액',amonut:'거래대금'}[state.sort];
    const option=new Option(label+' '+(state.dir==='desc'?'내림차순':'오름차순'),sortValue);option.dataset.dynamic='true';$('sort-select').add(option);
  }
  $('sort-select').value=sortValue;
  $('etf-body').innerHTML=display.length?display.map(r=>`<tr><td class="star-cell"><button class="star-button ${state.favorites.has(r.itemcode)?'selected':''}" data-favorite="${r.itemcode}" aria-label="${escape(r.itemname)} 관심 ${state.favorites.has(r.itemcode)?'해제':'등록'}" aria-pressed="${state.favorites.has(r.itemcode)}">${state.favorites.has(r.itemcode)?'★':'☆'}</button></td><td class="check-cell"><input type="checkbox" data-compare="${r.itemcode}" aria-label="${escape(r.itemname)} 비교 선택" ${state.compare.has(r.itemcode)?'checked':''}></td><td class="name-cell"><button class="name-button" data-detail="${r.itemcode}">${escape(r.itemname)}</button><div class="name-meta"><span>${r.itemcode}</span><span class="brand-tag">${escape(r.brand)}</span></div></td><td class="price">${fmt(r.nowVal)}</td><td class="rate ${tone(r.changeRate)}">${pct(r.changeRate)}</td><td class="${tone(r.threeMonthEarnRate)}">${pct(r.threeMonthEarnRate)}</td><td>${cap(r.marketSum)}원</td><td>${cap((r.amonut??0)/100)}원</td><td><span class="market-tag">${escape(r.market)}</span></td></tr>`).join(''):`<tr><td colspan="9" class="empty-cell">${state.favoritesOnly?'아직 표시할 관심 ETF가 없습니다.<br>상품 옆 ☆을 눌러 관심 ETF를 추가해 보세요.':'조건에 맞는 ETF가 없습니다.<br>검색어 또는 필터를 변경해 보세요.'}<br><button class="button outline" data-reset>검색 조건 초기화</button></td></tr>`;
}
function filterGroup(key,value){
  if(key==='brand')state.manager=state.manager===value?'':value;
  if(key==='market'){const id=Object.keys(MARKETS).find(x=>MARKETS[x]===value);state.market=state.market===id?'':id||'';}
  if(key==='product')state.product=state.product===value?'':value;
  state.page=1;render();
}
function reset(){state.query='';state.manager='';state.market='';state.product='';state.favoritesOnly=false;state.page=1;render();}
function setView(view){state.view=view;const [name,title,description]=viewInfo[view];$('crumb').textContent=name;$('page-title').textContent=title;$('page-description').textContent=description;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));render();}
function favorite(id){state.favorites.has(id)?state.favorites.delete(id):state.favorites.add(id);try{localStorage.setItem('etf-atlas-favorites',JSON.stringify([...state.favorites]));}catch{toast('현재 브라우저에서 관심 목록을 저장할 수 없습니다.');}render();}
function compare(id,checked){if(checked&&state.compare.size>=4){toast('최대 4개 ETF까지 비교할 수 있습니다.');renderTable();return;}checked?state.compare.add(id):state.compare.delete(id);renderCompareBar();}
function renderCompareBar(){
  $('compare-bar').hidden=!state.compare.size;$('compare-count').textContent=state.compare.size+' / 4';$('open-compare').disabled=state.compare.size<2;
  $('compare-names').textContent=[...state.compare].map(id=>state.rows.find(r=>r.itemcode===id)?.itemname||id).join(' · ');
}
function openModal(content,eyebrow='ETF ATLAS'){$('modal-content').innerHTML=content;$('modal-eyebrow').textContent=eyebrow;if(!$('modal').open)$('modal').showModal();}
function detail(id){
  const r=state.rows.find(r=>r.itemcode===id);if(!r)return;
  const metrics=[['시가총액',cap(r.marketSum)+'원'],['거래대금',cap((r.amonut??0)/100)+'원'],['거래량',fmt(r.quant)+'주'],['NAV',fmt(r.nav,2)+'원'],['NAV 괴리율',pct(r.premium)],['3개월 수익률',pct(r.threeMonthEarnRate)]];
  openModal(`<h2 class="modal-title">${escape(r.itemname)}</h2><p class="modal-sub">${r.itemcode} &nbsp;·&nbsp; ${escape(r.manager)} &nbsp;·&nbsp; ${escape(r.market)}</p><div class="detail-price">${fmt(r.nowVal)}<small>원</small><span class="${tone(r.changeRate)}">${pct(r.changeRate)} (${r.changeVal>0?'+':''}${fmt(r.changeVal)}원)</span></div><div class="detail-grid">${metrics.map(([label,value])=>`<div><label>${label}</label><b>${value}</b></div>`).join('')}</div><p class="detail-foot">상품 분류: <b>${r.product}</b> · 상품명 및 시장 분류를 이용한 규칙 분류<br>NAV 괴리율 = (현재가 ÷ NAV − 1) × 100. 원천 시점 차이가 있을 수 있습니다.<br>데이터 수신: ${date(state.fetchedAt)} ${time(state.fetchedAt)} KST ${state.stale?' · 갱신 지연':''}</p><a class="button primary" href="https://finance.naver.com/item/main.naver?code=${r.itemcode}" target="_blank" rel="noopener">네이버에서 상세 정보 보기 ↗</a>`,'ETF DETAIL');
}
function showCompare(){
  const selected=[...state.compare].map(id=>state.rows.find(r=>r.itemcode===id)).filter(Boolean);if(selected.length<2)return;
  const metrics=[['운용사',r=>escape(r.manager)],['시장',r=>escape(r.market)],['상품 유형',r=>r.product],['현재가',r=>fmt(r.nowVal)+'원'],['등락률',r=>`<span class="${tone(r.changeRate)}">${pct(r.changeRate)}</span>`],['3개월 수익률',r=>`<span class="${tone(r.threeMonthEarnRate)}">${pct(r.threeMonthEarnRate)}</span>`],['시가총액',r=>cap(r.marketSum)+'원'],['거래대금',r=>cap((r.amonut??0)/100)+'원'],['거래량',r=>fmt(r.quant)+'주'],['NAV',r=>fmt(r.nav,2)+'원'],['NAV 괴리율',r=>pct(r.premium)]];
  openModal(`<h2 class="modal-title">ETF 나란히 비교</h2><p class="modal-sub">선택한 ${selected.length}개 상품의 규모와 성과를 비교합니다.</p><div class="table-scroll"><table class="compare-table"><thead><tr><th>비교 항목</th>${selected.map(r=>`<th>${escape(r.itemname)}<div class="group-sub">${r.itemcode}</div></th>`).join('')}</tr></thead><tbody>${metrics.map(([label,fn])=>`<tr><td>${label}</td>${selected.map(r=>`<td>${fn(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="detail-foot">수신 ${date(state.fetchedAt)} ${time(state.fetchedAt)} KST · 실제 거래시각 미제공. 시세 지연 가능.<br>분배금·총보수·위험등급은 이 API에서 제공하지 않습니다.</p>`,'ETF COMPARISON');
}
function about(){openModal(`<h2 class="modal-title">데이터를 이해하는 기준</h2><div class="about-text"><h3>출처와 갱신</h3><p><a href="https://finance.naver.com/api/sise/etfItemList.nhn" target="_blank" rel="noopener">네이버 금융 ETF 목록 API</a>의 제공 시세를 조회합니다. 기본 60초마다 새로 요청하며 30초·120초 또는 중지를 선택할 수 있습니다. 서버는 요청을 최대 20초 캐시합니다. 장 마감·휴장일에는 같은 값이 반환될 수 있습니다. 화면의 ‘수신시각’은 서버가 데이터를 받은 시각이며 실제 체결시각이 아닙니다.</p><h3>시장과 운용사</h3><p>시장 분류는 API의 <code>etfTabCode</code> 1~7(국내 시장지수, 국내 업종·테마, 국내 파생, 해외 주식, 원자재, 채권, 기타)을 사용합니다. 모두 국내 상장 ETF이며, ‘해외 주식’은 투자 대상 분류입니다. 운용사는 상품명 첫 단어인 브랜드에 매핑합니다. 미등록 브랜드는 운용사명을 추정하지 않고 브랜드로 표시합니다. 운용사·브랜드 변경 시 매핑 갱신이 필요합니다.</p><h3>상품 유형의 우선순위</h3><p>API에는 상품 유형이 없어 아래 순서로 한 가지 유형을 배정합니다. 공식 투자설명서의 분류와 다를 수 있습니다.</p><ol><li>커버드콜: 커버드콜·타겟커버드·프리미엄분배</li><li>인버스 → 레버리지: 이름에 해당 단어(2X·3X 포함)가 있는 상품</li><li>금리·현금성: CD금리·KOFR·SOFR·머니마켓·파킹·금리액티브·단기자금</li><li>채권형 → 원자재형: 네이버 시장 분류 6·5</li><li>배당형: 상품명에 ‘배당’ 포함</li><li>주식·테마형: 시장 분류 1·2·3·4의 나머지</li><li>기타·혼합형: 그 외</li></ol><h3>계산과 단위</h3><ul><li>시가총액 <code>marketSum</code>: 억원. 순자산총액 또는 자금 순유입으로 해석하지 않습니다.</li><li>거래대금 <code>amonut</code>: 백만원. 화면에서는 억원·조원으로 환산합니다.</li><li>등락률·3개월 수익률: API 값을 그대로 표시하며, 결측치는 ‘—’입니다. 배당 재투자 총수익률 여부는 확인되지 않습니다.</li><li>평균 등락률: 조회 종목의 유효한 등락률을 단순 평균합니다.</li><li>비중: 현재 필터로 조회한 ETF의 시가총액 합계 기준입니다.</li><li>NAV 괴리율: (현재가 ÷ NAV − 1) × 100. NAV가 없거나 0이면 계산하지 않습니다.</li></ul><h3>조회 기능</h3><p>관심 ETF는 이 브라우저에만 저장됩니다. 비교는 최대 4개까지 가능하며 필터를 바꿔도 선택이 유지됩니다. CSV는 현재 조회 조건과 정렬을 적용한 전체 결과를 내려받습니다. 데이터 수신 실패 시 이전 데이터임을 표시하며, 서버가 보관한 데이터는 15분 이내만 재사용합니다.</p><p>이 대시보드는 네이버의 공식 서비스가 아닙니다. 데이터 제공 방식이 변경되면 연결 점검이 필요합니다.</p></div>`,'METHODOLOGY');}

$('today').textContent=new Date().toLocaleDateString('en-GB',{timeZone:'Asia/Seoul',day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
$('refresh').addEventListener('click',()=>refresh(true));
for(const id of ['manager','market','product'])$(id).addEventListener('change',e=>{state[id]=e.target.value;state.page=1;render();});
$('query').addEventListener('input',e=>{state.query=e.target.value;state.page=1;clearTimeout(searchTimer);searchTimer=setTimeout(render,160);});
$('reset').addEventListener('click',reset);
$('interval').addEventListener('change',e=>{state.interval=Number(e.target.value);state.remaining=state.interval;$('countdown').textContent=state.interval?state.interval+'s':'중지';});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$('watch-nav').addEventListener('click',()=>{state.favoritesOnly=!state.favoritesOnly;state.page=1;render();$('explorer').scrollIntoView({behavior:'smooth',block:'start'});});
$('favorites-toggle').addEventListener('click',()=>{state.favoritesOnly=!state.favoritesOnly;state.page=1;render();});
document.querySelectorAll('[data-quick]').forEach(b=>b.addEventListener('click',()=>{const q=b.dataset.quick;state.market=['4','6'].includes(q)?q:'';state.product=q==='all'||state.market?'':q;state.page=1;render();}));
document.querySelectorAll('[data-sort]').forEach(b=>b.addEventListener('click',()=>{state.dir=state.sort===b.dataset.sort&&state.dir==='desc'?'asc':'desc';state.sort=b.dataset.sort;state.page=1;renderTable();}));
$('sort-select').addEventListener('change',e=>{[state.sort,state.dir]=e.target.value.split(':');state.page=1;renderTable();});
$('page-size').addEventListener('change',e=>{state.size=Number(e.target.value);state.page=1;renderTable();});
$('prev-page').addEventListener('click',()=>{if(state.page>1)state.page--;renderTable();});
$('next-page').addEventListener('click',()=>{state.page++;renderTable();});
$('chart-switch').addEventListener('click',()=>{if(state.view==='overview')setView('manager');else reset();});
$('export').addEventListener('click',()=>{const data=rows();if(!data.length)return;const url=URL.createObjectURL(new Blob([csv(data)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(state.fetchedAt));a.download=`ETF_Atlas_${day}_${data.length}개.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`${fmt(data.length)}개 ETF를 CSV로 내보냈습니다.`);});
$('clear-compare').addEventListener('click',()=>{state.compare.clear();renderTable();renderCompareBar();});
$('open-compare').addEventListener('click',showCompare);$('about-button').addEventListener('click',about);
$('close-modal').addEventListener('click',()=>$('modal').close());
$('modal').addEventListener('click',e=>{if(e.target===$('modal')){const b=$('modal').getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)$('modal').close();}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-group],[data-favorite],[data-detail],[data-retry],[data-reset]');if(!b)return;if(b.hasAttribute('data-group'))filterGroup(b.dataset.groupKey,b.dataset.group);if(b.dataset.favorite)favorite(b.dataset.favorite);if(b.dataset.detail)detail(b.dataset.detail);if(b.hasAttribute('data-retry'))refresh(true);if(b.hasAttribute('data-reset'))reset();});
document.addEventListener('change',e=>{if(e.target.matches('[data-compare]'))compare(e.target.dataset.compare,e.target.checked);});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('modal').open){e.preventDefault();$('query').focus();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.interval&&state.fetchedAt&&Date.now()-Date.parse(state.fetchedAt)>state.interval*1000)refresh();});
setInterval(()=>{if(!state.interval||state.busy||document.hidden)return;state.remaining=Math.max(0,state.remaining-1);$('countdown').textContent=state.remaining+'s';if(!state.remaining)refresh();},1000);
refresh();
