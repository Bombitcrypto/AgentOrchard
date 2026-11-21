/** Public leaderboard + approximate visit analytics. No wallet authentication or private information. */
(function () {
  'use strict';
  const cfg=window.ORCHARD_CONFIG||{};
  const api=String(cfg.STATS_API||'').replace(/\/$/,'');
  const get=id=>document.getElementById(id);
  const addr=/^0x[0-9a-fA-F]{40}$/;
  const number=n=>Number(n||0).toLocaleString('en-US');
  let status=null;
  function text(id,value){const el=get(id);if(el)el.textContent=String(value);}
  function shorten(w){return w ? w.slice(0,7)+'…'+w.slice(-5) : '—';}
  async function query(path){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    try {
      const r=await fetch(api+path,{headers:{Accept:'application/json'},signal:controller.signal,cache:'no-store'});
      if(!r.ok)throw Error('Analytics API returned HTTP '+r.status);
      return await r.json();
    } finally {clearTimeout(timeout);}
  }
  function indexerMessage(indexer){
    if(!indexer?.cursor) return 'Indexer not synchronized yet. Rankings may be incomplete until the initial scan completes.';
    const complete=indexer.complete===true;
    const since=indexer.time ? new Date(indexer.time).toLocaleString() : 'unknown';
    return `Indexed contract events from block ${number(indexer.startBlock)} through ${number(indexer.cursor)} of ${number(indexer.head)} · Last sync: ${since} · ${complete ? 'Caught up' : 'Backfill in progress: partial rankings'}`;
  }
  function renderBars(days){
    const chart=get('visitChart');
    chart.replaceChildren();
    const maximum=Math.max(1,...days.map(d=>Math.max(0,Number(d.pageviews||0))));
    for (const day of days) {
      const column=document.createElement('div');column.className='visit-column';
      const barArea=document.createElement('div');barArea.className='visit-bar-area';
      const bar=document.createElement('div');bar.className='visit-bar';
      bar.style.height=`${Math.max(2,Math.round(Number(day.pageviews||0)/maximum*100))}%`;
      bar.title=`${day.date}: ${number(day.pageviews)} page views`;
      const count=document.createElement('small');count.className='visit-bar-count';count.textContent=number(day.pageviews);
      const label=document.createElement('span');label.className='visit-day-label';label.textContent=day.date.slice(5);
      barArea.append(count,bar);column.append(barArea,label);chart.append(column);
    }
  }
  function renderRank(rows, sort){
    const root=get('leaderboardRows');root.replaceChildren();
    if(!rows?.length){
      const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.className='rank-empty';td.textContent='No indexed Agent ID transactions yet. Check the indexer sync status below.';tr.append(td);root.append(tr);return;
    }
    rows.forEach((row,i)=>{
      const tr=document.createElement('tr');
      if(i===0)tr.className='rank-first';
      const cell=(value)=>{const td=document.createElement('td');td.textContent=String(value);tr.append(td);return td;};
      cell(i===0?'🥇 #1':i===1?'🥈 #2':i===2?'🥉 #3':`#${i+1}`);
      const td=document.createElement('td');
      const link=document.createElement('a');link.href=`https://bscscan.com/address/${row.wallet}`;link.target='_blank';link.rel='noopener noreferrer';
      link.className='agent-name-link';
      const display=(typeof row.agentIdName==='string' && /^[a-z0-9][a-z0-9-]{1,30}\.ai$/i.test(row.agentIdName)) ? row.agentIdName : null;
      link.textContent=(display||shorten(row.wallet))+' ↗';
      link.title=`Wallet: ${row.wallet}`;
      td.append(link);
      if(display){const sub=document.createElement('small');sub.className='agent-wallet-sub';sub.textContent=shorten(row.wallet);td.append(sub);}
      tr.append(td);
      cell(number(row.xp));cell(number(row.checkins));cell(number(row.tends));cell(number(row.badges));root.append(tr);
    });
  }
  async function loadLeaderboard(){
    if(!api)return;
    const sort=get('rankSort').value;
    try {
      const data=await query(`/api/leaderboard?sort=${encodeURIComponent(sort)}&limit=20`);
      renderRank(data.rows,sort);
      if(data.indexer){status=data.indexer;text('indexerStatus',indexerMessage(status));}
    } catch(error){text('indexerStatus',`Could not load leaderboard: ${error.message}`);}
  }
  async function loadStats(){
    if(!api){
      text('analyticsState','○ Worker not configured');
      text('indexerStatus','Set STATS_API in site/config.js after deploying analytics-worker with D1. No leaderboard or visitor numbers are fabricated. The on-chain game remains functional.');
      return;
    }
    text('analyticsState','◌ Synchronizing metrics…');
    try {
      const data=await query('/api/stats');status=data.indexer;
      const indexed=Boolean(data.indexer?.cursor);
      text('metricWallets',indexed?number(data.onchain.wallets):'—');
      text('metricActions',indexed?number(data.onchain.transactions):'—');
      text('metricBadges',indexed?number(data.onchain.badges):'—');
      text('metricVisits',number(data.website.todayPageviews));
      text('metricSessions',number(data.website.todaySessions));
      text('visitToday',number(data.website.todayPageviews));
      text('visitSessions',number(data.website.todaySessions));
      renderBars(data.website.last7Days||[]);
      text('analyticsState',!indexed?'◌ ON-CHAIN INDEX PENDING':data.indexer.complete?'● LIVE INDEXED':'◌ INDEXING');
      text('indexerStatus',indexerMessage(data.indexer));
      await loadLeaderboard();
    } catch(error){
      text('analyticsState','○ Analytics unavailable');
      text('indexerStatus',`Analytics backend unavailable: ${error.message}. On-chain farming still works without the Worker.`);
    }
  }
  async function lookup(){
    const raw=get('rankWallet').value.trim();
    if(!addr.test(raw) && !/^[a-z0-9][a-z0-9-]{1,30}\.ai$/i.test(raw)){text('walletRankResult','Enter a public BSC wallet address or a .ai Agent ID.');return;}
    if(!api){text('walletRankResult','Wallet rank requires Analytics Worker + D1. Use the main wallet panel to view live on-chain garden state.');return;}
    text('walletRankResult','Reading indexed blockchain actions…');
    try {
      const data=await query('/api/wallet?address='+encodeURIComponent(raw));
      if(!data.wallet){text('walletRankResult','No events found for this address in the indexed range. A public address lookup does not authenticate a wallet.');return;}
      const v=data.wallet;
      text('walletRankResult',`${v.agentIdName||shorten(v.wallet)} · ${number(v.xp)} XP · ${number(v.checkins)} check-ins · ${number(v.plants)} planted · ${number(v.tends)} cared · ${number(v.harvests)} harvested · ${number(v.badges)} NFT · ${number(v.bestStreak)} best streak (recorded).`);
    } catch(err){text('walletRankResult','Wallet lookup failed: '+err.message);}
  }
  function sessionId(){
    try {
      let id=sessionStorage.getItem('agent-orchard-anon-session');
      if(!id){id=crypto.randomUUID();sessionStorage.setItem('agent-orchard-anon-session',id);}
      return id;
    }catch(_){return null;}
  }
  async function trackVisit(){
    // Do Not Track, private session identifier and daily hashing on server. No IP, no wallet link.
    if(!api || navigator.doNotTrack==='1' || navigator.globalPrivacyControl===true)return;
    const session=sessionId();if(!session)return;
    try {await fetch(api+'/api/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session}),keepalive:true,cache:'no-store'});}catch(_){/* not essential */}
  }
  function init(){
    get('rankSort')?.addEventListener('change',loadLeaderboard);
    get('rankWalletBtn')?.addEventListener('click',lookup);
    get('rankWallet')?.addEventListener('keydown',ev=>{if(ev.key==='Enter')lookup();});
    trackVisit().finally(loadStats);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadStats();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
