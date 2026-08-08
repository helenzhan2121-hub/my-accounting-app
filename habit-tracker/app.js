/* ============================================================
   习惯打卡 App — 业务逻辑（打卡范式）
   架构：IndexedDB 本地存储 + 现代靛蓝设计系统
   核心概念：频率(freq) / 计划日(repeatDays) / 每日目标(dailyTarget)
            / 每周目标(weeklyTarget) / 连续(streak) / 完成率(rate)
   ============================================================ */
(function(){
  'use strict';

  /* ============================================================
     1. 数据库
     ============================================================ */
  const DB_NAME = 'habit_db', DB_VER = 2;
  let db = null;
  function openDB(){
    return new Promise((res, rej)=>{
      const r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = e=>{
        const d = e.target.result;
        if(!d.objectStoreNames.contains('habits')){
          d.createObjectStore('habits', { keyPath:'id' });
        }
        if(!d.objectStoreNames.contains('checks')){
          const s = d.createObjectStore('checks', { keyPath:'id' }); // id = habitId + '|' + date
          s.createIndex('habitId','habitId',{unique:false});
          s.createIndex('date','date',{unique:false});
        }
      };
      r.onsuccess = e=>{ db = e.target.result; res(db); };
      r.onerror = e=>rej(e.target.error);
    });
  }
  function tx(store, mode){ return db.transaction(store, mode).objectStore(store); }
  function getAll(store){ return new Promise((res,rej)=>{ const r=tx(store,'readonly').getAll(); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
  function put(store, val){ return new Promise((res,rej)=>{ const r=tx(store,'readwrite').put(val); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); }); }
  function del(store, key){ return new Promise((res,rej)=>{ const r=tx(store,'readwrite').delete(key); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); }); }
  function get(store, key){ return new Promise((res,rej)=>{ const r=tx(store,'readonly').get(key); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }

  /* ============================================================
     2. 状态
     ============================================================ */
  let habits = [];   // 打卡范式模型（见 sanitizeHabit）
  let checks = [];   // [{id, habitId, date, count}]
  let settings = { theme:'indigo', avatar:'', wallpaper:'', wallpaperMode:'face' };
  const WEEK = ['日','一','二','三','四','五','六'];

  /* ============================================================
     3. 工具
     ============================================================ */
  const $ = s=>document.querySelector(s);
  const ymd = d=> `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayStr = ()=> ymd(new Date());
  const uid = ()=> Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  const EMOJI_POOL = ['💪','📚','🏃','🧘','💧','🥗','😴','🚭','✍️','🎯','🌅','🧹','💊','🎸','🪥','📵','🌿','🙏','💡','🔥','🍎','☕','🚴','🎨','💰','🌱'];
  const THEMES = [
    { key:'indigo', name:'靛蓝', color:'#4F46E5', bg:'#EEF2FF', top:'linear-gradient(135deg,#6366F1 0%,#4F46E5 100%)', icon:'💎' },
    { key:'slate',  name:'石墨', color:'#475569', bg:'#F1F5F9', top:'linear-gradient(135deg,#64748B 0%,#475569 100%)', icon:'🪨' },
    { key:'teal',   name:'青绿', color:'#0D9488', bg:'#ECFDF5', top:'linear-gradient(135deg,#2DD4BF 0%,#0D9488 100%)', icon:'🌿' },
    { key:'amber',  name:'琥珀', color:'#D97706', bg:'#FFFBEB', top:'linear-gradient(135deg,#FBBF24 0%,#D97706 100%)', icon:'🟡' },
    { key:'rose',   name:'玫红', color:'#E11D48', bg:'#FFF1F2', top:'linear-gradient(135deg,#FB7185 0%,#E11D48 100%)', icon:'🌹' },
    { key:'violet', name:'紫罗兰', color:'#7C3AED', bg:'#F5F3FF', top:'linear-gradient(135deg,#A78BFA 0%,#7C3AED 100%)', icon:'💜' }
  ];
  const getTheme = ()=> THEMES.find(t=>t.key===settings.theme) || THEMES[0];
  const habitById = id=> habits.find(h=>h.id===id);
  const escapeHtml = s=> String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  /* 旧数据兼容：补全打卡范式字段 */
  function sanitizeHabit(h, earliestCheckDate){
    if(h.id==='__settings__') return h;
    const def = {
      freq: 'daily',
      repeatDays: [0,1,2,3,4,5,6],
      dailyTarget: 1,
      weeklyTarget: 0,
      reminder: '',
      created: earliestCheckDate || todayStr()
    };
    return Object.assign(def, h);
  }

  /* ============================================================
     4. 主题 / 壁纸
     ============================================================ */
  function applyTheme(){
    const t = getTheme();
    const root = document.documentElement;
    root.style.setProperty('--blue', t.color);
    root.style.setProperty('--blue-d', shade(t.color,-18));
    root.style.setProperty('--blue-l', shade(t.color,18));
    root.style.setProperty('--bg', t.bg);
    root.style.setProperty('--topbar-bg', t.top);
    $('#themeColor').setAttribute('content', t.color);
    document.querySelectorAll('.theme-item').forEach(el=> el.classList.toggle('on', el.dataset.key===settings.theme));
  }
  function shade(hex, pct){
    const n = parseInt(hex.slice(1),16);
    let r=(n>>16)&255, g=(n>>8)&255, b=n&255;
    const f = c=> Math.max(0,Math.min(255, Math.round(c + 255*(pct/100))));
    return '#'+((1<<24)+(f(r)<<16)+(f(g)<<8)+f(b)).toString(16).slice(1);
  }
  function applyWallpaper(){
    const b = document.body;
    b.classList.toggle('has-wallpaper', !!settings.wallpaper);
    b.classList.remove('wp-mode-face','wp-mode-full','wp-mode-cover');
    if(settings.wallpaper){
      b.style.backgroundImage = `url(${settings.wallpaper})`;
      b.classList.add('wp-mode-' + (settings.wallpaperMode||'face'));
    } else {
      b.style.backgroundImage = '';
    }
    const av = $('#avatar').querySelector('img');
    if(settings.avatar){ av.src = settings.avatar; av.style.display='block'; }
    else { av.src=''; av.style.display='none'; }
  }

  /* ============================================================
     5. 打卡核心逻辑（打卡范式）
     ============================================================ */
  // 该习惯在某日期的计划判定
  function isPlanDay(h, date){ return h.repeatDays.includes(date.getDay()); }
  function createdDate(h){ const [y,m,d]=h.created.split('-').map(Number); return new Date(y,m-1,d); }
  // 某日某习惯打卡次数
  function countOf(habitId, date){
    const c = checks.find(c=>c.habitId===habitId && c.date===date);
    return c ? (c.count||1) : 0;
  }
  // 某日是否达成（计划日 且 次数达标）
  function isDoneDay(h, date){
    if(!isPlanDay(h, date)) return false;
    return countOf(h.id, ymd(date)) >= h.dailyTarget;
  }
  function checkId(habitId, date){ return habitId + '|' + date; }

  // 设置某日次数（用于 +/- 计数与补打卡）
  async function setCount(habitId, date, count){
    count = Math.max(0, count);
    const id = checkId(habitId, date);
    const exist = checks.find(c=>c.id===id);
    if(count===0){
      if(exist){ await del('checks', id); checks = checks.filter(c=>c.id!==id); }
    } else {
      if(exist){ exist.count = count; await put('checks', exist); }
      else { const rec={id,habitId,date,count}; await put('checks', rec); checks.push(rec); }
    }
    refreshViews();
  }
  // 单次切换（目标=1 时等同于原打卡）
  async function toggleDay(habitId, date){
    const h = habitById(habitId);
    const cur = countOf(habitId, date);
    await setCount(habitId, date, cur>=h.dailyTarget ? 0 : h.dailyTarget);
  }

  // 连续天数：连续达成的计划日（含今天/最近计划日，断则归零）
  function streak(habitId){
    const h = habitById(habitId); const cd = createdDate(h);
    const today = new Date(); today.setHours(0,0,0,0);
    if(today < cd) return 0;
    const prevPlan = dt=>{ const x=new Date(dt); do{ x.setDate(x.getDate()-1); }while(x>=cd && !isPlanDay(h,x)); return x; };
    // 回退到今天或之前最近计划日
    let cur = new Date(today);
    while(cur>=cd && !isPlanDay(h,cur)) cur.setDate(cur.getDate()-1);
    if(cur<cd) return 0;
    if(!isDoneDay(h,cur)){            // 最近计划日未达成 → 从它的前一天计划日起算
      cur = prevPlan(cur);
      if(cur<cd) return 0;
      if(!isDoneDay(h,cur)) return 0;
    }
    let n=0;
    while(cur>=cd && isDoneDay(h,cur)){ n++; cur = prevPlan(cur); }
    return n;
  }
  // 最佳连续
  function bestStreak(habitId){
    const h = habitById(habitId); const cd = createdDate(h);
    const today = new Date(); today.setHours(0,0,0,0);
    let best=0, run=0; const dt=new Date(cd);
    for(; dt<=today; dt.setDate(dt.getDate()+1)){
      if(!isPlanDay(h,dt)) continue;
      if(countOf(h.id, ymd(dt)) >= h.dailyTarget){ run++; if(run>best) best=run; }
      else run=0;
    }
    return best;
  }
  // 当月完成率（%）：计划日内达成天数 / 计划日总数（自创建起）
  function monthRate(habitId, y, m){
    const h = habitById(habitId); const cd = createdDate(h);
    const daysInMonth = new Date(y, m+1, 0).getDate();
    let plan=0, done=0;
    for(let i=1;i<=daysInMonth;i++){
      const dt = new Date(y, m, i);
      if(dt < cd) continue;
      if(!isPlanDay(h,dt)) continue;
      plan++;
      if(countOf(h.id, ymd(dt)) >= h.dailyTarget) done++;
    }
    return plan ? Math.round(done/plan*100) : 0;
  }
  // 本周打卡次数（用于 weekly 模式周目标）
  function weekCount(habitId, refDate){
    const d = new Date(refDate); d.setHours(0,0,0,0);
    const dow = (d.getDay()+6)%7; // 周一为0
    const mon = new Date(d); mon.setDate(d.getDate()-dow);
    let n=0;
    for(let i=0;i<7;i++){ const dt=new Date(mon); dt.setDate(mon.getDate()+i); n += countOf(habitId, ymd(dt)); }
    return n;
  }

  // 火焰色阶
  function fireClass(n){
    if(n>=365) return 'fire-lv6';
    if(n>=100) return 'fire-lv5';
    if(n>=30) return 'fire-lv4';
    if(n>=7) return 'fire-lv3';
    if(n>=3) return 'fire-lv2';
    if(n>=1) return 'fire-lv1';
    return '';
  }
  function freqDesc(h){
    if(h.freq==='daily') return h.dailyTarget>1 ? `每天${h.dailyTarget}次` : '每天';
    if(h.freq==='weekly') return `每周${h.weeklyTarget}次`;
    // custom
    const ds = h.repeatDays.slice().sort().map(d=>WEEK[d]).join('');
    return '周'+ds;
  }

  /* ============================================================
     6. 渲染：首页
     ============================================================ */
  function renderHome(){
    const t = new Date(); t.setHours(0,0,0,0);
    const ts = ymd(t);
    const planHabits = habits.filter(h=>isPlanDay(h,t));
    const doneToday = planHabits.filter(h=>countOf(h.id,ts)>=h.dailyTarget).length;
    const total = planHabits.length;
    const pct = total ? Math.round(doneToday/total*100) : 0;

    // 月热力图（当月）
    const y=t.getFullYear(), m=t.getMonth();
    const first=new Date(y,m,1); const startPad=(first.getDay()+6)%7;
    const daysInMonth=new Date(y,m+1,0).getDate();
    let cal='<div class="heat-grid">';
    ['一','二','三','四','五','六','日'].forEach(w=> cal+=`<div class="heat-wd">${w}</div>`);
    for(let i=0;i<startPad;i++) cal+='<div class="heat-cell rest"></div>';
    const todayNum=t.getDate();
    for(let i=1;i<=daysInMonth;i++){
      const dt=new Date(y,m,i); const ds=ymd(dt);
      const cellClass = heatClass(dt, ds, todayNum===i);
      cal += `<div class="${cellClass}" title="${y}年${m+1}月${i}日 ${heatTip(habits,ds)}">${i}</div>`;
    }
    cal+='</div>';

    let html = `
      <div class="home-card">
        <div class="today-overview">
          <div class="t-title">今日打卡 ${doneToday}/${total}</div>
          <div class="t-sub">${pct===100&&total?'🎉 今日计划全部完成，太棒了！':'坚持一小步，进步一大步'}</div>
          <div class="t-prog"><i style="width:${pct}%"></i></div>
        </div>
      </div>
      <div class="sec-title">本月足迹 <span class="more">${y}年${m+1}月</span></div>
      <div class="home-card">${cal}
        <div class="heat-legend"><span>未打卡</span><i style="background:rgba(239,68,68,.14)"></i><i style="background:rgba(99,102,241,.28)"></i><i style="background:rgba(79,70,229,.8)"></i><i style="background:var(--blue)"></i><span>已达成</span></div>
      </div>
      <div class="sec-title">今日待打卡 <span class="more click" id="backfillBtn">📅 补打卡 ›</span></div>
      <div id="todayList"></div>
    `;
    $('#homeContent').innerHTML = html;
    $('#backfillBtn').onclick = openBackfill;
    renderDayList($('#todayList'), ts);
  }

  // 某日期的习惯打卡列表（今日 / 补打卡复用）
  function renderDayList(container, dateStr){
    const dt = new Date(dateStr+'T00:00:00');
    const list = habits.filter(h=>isPlanDay(h,dt)).slice().sort((a,b)=>a.order-b.order);
    if(!habits.length){ container.innerHTML='<div class="empty">还没有习惯，点下方 ＋ 添加第一个吧</div>'; return; }
    if(!list.length){ container.innerHTML=`<div class="empty">这天没有计划打卡的习惯（${dateStr}）</div>`; return; }
    container.innerHTML='';
    list.forEach(h=>{
      const cur = countOf(h.id, dateStr);
      const done = cur>=h.dailyTarget;
      const el = document.createElement('div');
      el.className='habit-item';
      const meta = `<span class="freq-tag">${freqDesc(h)}</span><span class="${fireClass(streak(h.id))}">🔥${streak(h.id)}</span>`;
      if(h.dailyTarget>1){
        el.innerHTML = `<div class="emoji">${h.emoji}</div>
          <div class="mid"><div class="h-name">${escapeHtml(h.name)}</div><div class="h-meta">${meta}</div></div>
          <div class="counter">
            <button class="minus" data-id="${h.id}" data-d="${dateStr}">−</button>
            <span class="cnt">${cur}/${h.dailyTarget}</span>
            <button class="plus ${done?'on':''}" data-id="${h.id}" data-d="${dateStr}">＋</button>
          </div>`;
      } else {
        el.innerHTML = `<div class="emoji">${h.emoji}</div>
          <div class="mid"><div class="h-name">${escapeHtml(h.name)}</div><div class="h-meta">${meta}</div></div>
          <button class="check ${done?'on':''}" data-id="${h.id}" data-d="${dateStr}">${done?'✓':''}</button>`;
      }
      container.appendChild(el);
    });
    container.querySelectorAll('.check').forEach(b=> b.onclick=()=> toggleDay(b.dataset.id, b.dataset.d));
    container.querySelectorAll('.plus').forEach(b=> b.onclick=()=>{ const h=habitById(b.dataset.id); setCount(b.dataset.id, b.dataset.d, Math.min(h.dailyTarget, countOf(b.dataset.id,b.dataset.d)+1)); });
    container.querySelectorAll('.minus').forEach(b=> b.onclick=()=>{ setCount(b.dataset.id, b.dataset.d, Math.max(0, countOf(b.dataset.id,b.dataset.d)-1)); });
  }

  // 热力图单格样式
  function heatClass(dt, ds, isToday){
    if(!habits.length) return 'heat-cell rest';
    // 任一计划习惯在该日达成 → 着色
    const doneHabits = habits.filter(h=> isDoneDay(h,dt));
    const planHabits = habits.filter(h=> isPlanDay(h,dt));
    let cls='heat-cell';
    if(!planHabits.length) return cls+' rest';
    if(!doneHabits.length) return cls+' miss';
    // 达成：按总次数/目标比例分级
    const ratio = doneHabits.reduce((s,h)=> s + countOf(h.id,ds)/h.dailyTarget, 0) / planHabits.length;
    if(ratio>=2) cls+=' over';
    else if(ratio>=1.5) cls+=' lv4';
    else if(ratio>=1.2) cls+=' lv3';
    else if(ratio>1) cls+=' lv2';
    else cls+=' lv1';
    if(isToday) cls+=' today';
    return cls;
  }
  function heatTip(hs, ds){
    const done = hs.filter(h=>{ const dt=new Date(ds+'T00:00:00'); return isDoneDay(h,dt); });
    return `达成 ${done.length}/${hs.filter(h=>{const dt=new Date(ds+'T00:00:00');return isPlanDay(h,dt);}).length}`;
  }

  /* ============================================================
     7. 渲染：习惯列表
     ============================================================ */
  function renderHabits(){
    let html = `<div class="sec-title">我的习惯 <span class="more click" id="manageHabits">管理 ›</span></div>`;
    if(!habits.length){
      html += '<div class="empty">还没有习惯，点下方 ＋ 添加</div>';
    } else {
      habits.slice().sort((a,b)=>a.order-b.order).forEach(h=>{
        const s = streak(h.id);
        const rate = monthRate(h.id, new Date().getFullYear(), new Date().getMonth());
        html += `<div class="habit-item" data-id="${h.id}">
          <div class="emoji">${h.emoji}</div>
          <div class="mid"><div class="h-name">${escapeHtml(h.name)}</div>
            <div class="h-meta"><span class="freq-tag">${freqDesc(h)}</span><span class="${fireClass(s)}">🔥${s}</span><span>本月 ${rate}%</span></div></div>
          <button class="check" data-open="${h.id}">›</button>
        </div>`;
      });
    }
    $('#habitsContent').innerHTML = html;
    if(habits.length){
      $('#habitsContent').querySelectorAll('.habit-item').forEach(it=> it.onclick=()=> openHabitEdit(habitById(it.dataset.id)));
      $('#habitsContent').querySelector('#manageHabits').onclick = openHabitMgr;
    }
  }

  /* ============================================================
     8. 渲染：统计（打卡范式核心）
     ============================================================ */
  function renderStat(){
    if(!habits.length){
      $('#statContent').innerHTML = '<div class="empty">还没有习惯，先去添加一个吧</div>';
      return;
    }
    const now = new Date(); const y=now.getFullYear(), m=now.getMonth();
    const totalChecks = checks.reduce((s,c)=>s+(c.count||1),0);
    const days = new Set(checks.map(c=>c.date)).size;
    // 全局本月完成率（按习惯平均）
    const avgRate = Math.round(habits.reduce((s,h)=> s+monthRate(h.id,y,m),0)/habits.length);
    const bestAll = habits.reduce((mx,h)=> Math.max(mx, bestStreak(h.id)), 0);
    const curAll = habits.reduce((mx,h)=> Math.max(mx, streak(h.id)), 0);

    let html = `
      <div class="stat-head">📊 打卡统计</div>
      <div class="home-card">
        <div class="ring-wrap">
          <div class="ring">
            <svg width="108" height="108" viewBox="0 0 108 108">
              <circle cx="54" cy="54" r="46" fill="none" stroke="rgba(79,70,229,.12)" stroke-width="12"/>
              <circle cx="54" cy="54" r="46" fill="none" stroke="url(#rg)" stroke-width="12" stroke-linecap="round"
                stroke-dasharray="${2*Math.PI*46}" stroke-dashoffset="${2*Math.PI*46*(1-avgRate/100)}"/>
              <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#818CF8"/><stop offset="1" stop-color="#4F46E5"/></linearGradient></defs>
            </svg>
            <div class="ring-txt"><div class="ring-pct">${avgRate}%</div><div class="ring-cap">本月完成率</div></div>
          </div>
          <div class="ring-side">
            <div class="rs-row"><span class="rs-k">当前连续</span><span class="rs-v">${curAll} 天</span></div>
            <div class="rs-row"><span class="rs-k">最佳连续</span><span class="rs-v">${bestAll} 天</span></div>
            <div class="rs-row"><span class="rs-k">累计打卡</span><span class="rs-v">${totalChecks}</span></div>
            <div class="rs-row"><span class="rs-k">活跃天</span><span class="rs-v">${days}</span></div>
          </div>
        </div>
      </div>
      <div class="chart-card">
        <h4>本周视图 <span class="sub">点击格子可补打卡</span></h4>
        <div class="weekview" id="weekView"></div>
      </div>
      <div class="chart-card">
        <h4>本月热力图 <span class="sub">${y}年${m+1}月</span></h4>
        <div id="monthHeat"></div>
      </div>
      <div class="chart-card">
        <h4>全年足迹 <span class="sub">近 53 周</span></h4>
        <div id="yearHeat"></div>
      </div>
      <div class="chart-card">
        <h4>各习惯完成率（本月）</h4>
        <div id="rateList"></div>
      </div>
      <div class="chart-card">
        <h4>🔥 连续天数榜</h4>
        <div id="fireRank"></div>
      </div>
    `;
    $('#statContent').innerHTML = html;
    renderWeekView($('#statContent').querySelector('#weekView'));
    renderMonthHeat($('#statContent').querySelector('#monthHeat'));
    renderYearHeat($('#statContent').querySelector('#yearHeat'));
    renderRateList($('#statContent').querySelector('#rateList'));
    renderFireRank($('#statContent').querySelector('#fireRank'));
  }

  function renderWeekView(box){
    const d=new Date(); d.setHours(0,0,0,0);
    const dow=(d.getDay()+6)%7; const mon=new Date(d); mon.setDate(d.getDate()-dow);
    let html=`<div class="wv-head"><div class="wv-name"></div><div class="wv-days">`;
    const cols=[1,2,3,4,5,6,0];
    cols.forEach(c=> html+=`<span>${WEEK[c]}</span>`);
    html+=`</div></div>`;
    habits.slice().sort((a,b)=>a.order-b.order).forEach(h=>{
      html+=`<div class="wv-row"><div class="wv-name"><span class="we">${h.emoji}</span></div><div class="wv-days">`;
      for(let i=0;i<7;i++){
        const dt=new Date(mon); dt.setDate(mon.getDate()+i); const ds=ymd(dt);
        const isToday = ds===todayStr();
        if(!isPlanDay(h,dt)){ html+=`<div class="wv-cell rest"></div>`; }
        else {
          const on = countOf(h.id,ds)>=h.dailyTarget;
          const future = dt > d;
          html+=`<div class="wv-cell ${on?'on':''} ${isToday?'today':''} ${future?'disabled':''}" data-id="${h.id}" data-d="${ds}">${countOf(h.id,ds)||''}</div>`;
        }
      }
      html+=`</div></div>`;
    });
    box.innerHTML=html;
    box.querySelectorAll('.wv-cell:not(.rest):not(.disabled)').forEach(cell=>{
      cell.onclick=()=> toggleDay(cell.dataset.id, cell.dataset.d);
    });
  }

  function renderMonthHeat(box){
    const now=new Date(); const y=now.getFullYear(), m=now.getMonth();
    const first=new Date(y,m,1); const startPad=(first.getDay()+6)%7;
    const daysInMonth=new Date(y,m+1,0).getDate();
    let cal=`<div class="heat-grid">`;
    ['一','二','三','四','五','六','日'].forEach(w=> cal+=`<div class="heat-wd">${w}</div>`);
    for(let i=0;i<startPad;i++) cal+='<div class="heat-cell rest"></div>';
    const todayNum=now.getDate();
    for(let i=1;i<=daysInMonth;i++){
      const dt=new Date(y,m,i); const ds=ymd(dt);
      cal+=`<div class="${heatClass(dt,ds,todayNum===i)}" title="${y}年${m+1}月${i}日 ${heatTip(habits,ds)}">${i}</div>`;
    }
    cal+='</div>';
    box.innerHTML=cal;
  }

  function renderYearHeat(box){
    const end=new Date(); end.setHours(0,0,0,0);
    let start=new Date(end);
    const dow=(start.getDay()+6)%7; start.setDate(start.getDate()-dow); // 本周一
    start.setDate(start.getDate()-52*7); // 回退52周
    let cal='<div class="heat-grid year">';
    const cur=new Date(start);
    while(cur<=end){
      const ds=ymd(cur);
      if(cur>end){ break; }
      const cls = heatClass(cur, ds, false).replace(' today','');
      cal+=`<div class="${cls}" title="${ds} ${heatTip(habits,ds)}"></div>`;
      cur.setDate(cur.getDate()+1);
    }
    cal+='</div>';
    box.innerHTML=cal;
  }

  function renderRateList(box){
    const y=new Date().getFullYear(), m=new Date().getMonth();
    const ranked=habits.slice().sort((a,b)=>monthRate(b.id,y,m)-monthRate(a.id,y,m));
    box.innerHTML=ranked.map(h=>{
      const r=monthRate(h.id,y,m);
      return `<div class="rank-item">
        <span class="ri-emoji">${h.emoji}</span>
        <div class="ri-mid"><div class="ri-name">${escapeHtml(h.name)}</div>
          <div class="ri-meta">${freqDesc(h)} · 连续🔥${streak(h.id)}</div></div>
        <div class="rs-v">${r}%</div>
      </div>`;
    }).join('');
  }

  function renderFireRank(box){
    const ranked=habits.slice().sort((a,b)=>streak(b.id)-streak(a.id));
    box.innerHTML=ranked.map((h,i)=>{
      const s=streak(h.id);
      return `<div class="rank-item">
        <div class="badge">${i+1}</div>
        <span class="ri-emoji">${h.emoji}</span>
        <div class="ri-mid"><div class="ri-name">${escapeHtml(h.name)}</div>
          <div class="ri-meta">最佳 ${bestStreak(h.id)} 天</div></div>
        <div class="${fireClass(s)}" style="font-weight:800;">🔥${s}</div>
      </div>`;
    }).join('');
  }

  /* ============================================================
     9. 渲染：我的
     ============================================================ */
  function renderMine(){
    let html = `
      <div class="mine-card">
        <h4>🎨 主题配色</h4>
        <div class="theme-row" id="themeRow"></div>
      </div>
      <div class="mine-card">
        <h4>🖼️ 壁纸 & 头像</h4>
        <div class="upload-row">
          <label>上传壁纸<input type="file" id="wpInput" accept="image/*"></label>
          <label>上传头像<input type="file" id="avInput" accept="image/*"></label>
        </div>
        <img class="preview-img" id="wpPrev"></img>
        <div class="wp-mode-row"><span class="hint">壁纸模式</span>
          <button data-mode="face" class="${settings.wallpaperMode==='face'?'on':''}">智能人脸</button>
          <button data-mode="full" class="${settings.wallpaperMode==='full'?'on':''}">完整显示</button>
          <button data-mode="cover" class="${settings.wallpaperMode==='cover'?'on':''}">铺满裁切</button>
        </div>
        <button class="btn-danger" id="clearWp" style="margin-top:12px;width:100%;padding:10px;border-radius:12px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.3);color:#EF4444;font-size:13px;">清除壁纸</button>
      </div>
      <div class="mine-card">
        <h4>📤 数据</h4>
        <button class="mine-btn" id="exportExcelBtn">导出打卡记录 Excel <span class="arrow">›</span></button>
        <button class="mine-btn" id="backupBtn">备份数据（JSON）<span class="arrow">›</span></button>
        <button class="mine-btn" id="restoreBtn">恢复数据（JSON）<span class="arrow">›</span></button>
        <input type="file" id="restoreInput" accept="application/json" style="display:none">
      </div>
    `;
    $('#mineContent').innerHTML = html;
    const tr=$('#mineContent').querySelector('#themeRow');
    THEMES.forEach(t=>{
      const el=document.createElement('div');
      el.className='theme-item'+(t.key===settings.theme?' on':'');
      el.dataset.key=t.key;
      el.innerHTML=`<div class="circle" style="background:${t.bg}">${t.icon}</div><div class="name">${t.name}</div>`;
      el.onclick=()=>{ settings.theme=t.key; saveSettings(); applyTheme(); };
      tr.appendChild(el);
    });
    $('#mineContent').querySelector('#wpInput').onchange=e=>handleImg(e,'wallpaper');
    $('#mineContent').querySelector('#avInput').onchange=e=>handleImg(e,'avatar');
    $('#mineContent').querySelectorAll('.wp-mode-row button').forEach(b=> b.onclick=()=>{ settings.wallpaperMode=b.dataset.mode; saveSettings(); applyWallpaper(); renderMine(); });
    $('#mineContent').querySelector('#clearWp').onclick=()=>{ settings.wallpaper=''; saveSettings(); applyWallpaper(); renderMine(); };
    $('#mineContent').querySelector('#exportExcelBtn').onclick=exportExcel;
    $('#mineContent').querySelector('#backupBtn').onclick=backupJSON;
    $('#mineContent').querySelector('#restoreBtn').onclick=()=> $('#mineContent').querySelector('#restoreInput').click();
    $('#mineContent').querySelector('#restoreInput').onchange=restoreJSON;
  }

  function handleImg(e, field){
    const f=e.target.files[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=()=>{ settings[field]=rd.result; saveSettings(); applyWallpaper(); renderMine(); };
    rd.readAsDataURL(f);
  }

  /* ============================================================
     10. 习惯管理 / 编辑（含频率、提醒）
     ============================================================ */
  function openHabitMgr(){
    let html=`<div class="top"><h3>管理习惯</h3><button class="close" id="mgrClose">×</button></div><div id="mgrList"></div>
      <button class="btn-primary" id="addHabit" style="margin-top:14px;">＋ 新增习惯</button>`;
    $('#mgr').innerHTML=html;
    renderMgrList();
    $('#mgrMask').classList.add('show');
    $('#mgr').querySelector('#mgrClose').onclick=()=> $('#mgrMask').classList.remove('show');
    $('#mgr').querySelector('#addHabit').onclick=()=> openHabitEdit(null);
  }
  function renderMgrList(){
    const box=$('#mgr').querySelector('#mgrList');
    if(!habits.length){ box.innerHTML='<div class="empty">暂无习惯</div>'; return; }
    box.innerHTML='';
    habits.slice().sort((a,b)=>a.order-b.order).forEach(h=>{
      const el=document.createElement('div');
      el.className='cat-mgr-item';
      el.innerHTML=`<div class="e">${h.emoji}</div><div class="n">${escapeHtml(h.name)}<span class="freq">${freqDesc(h)}</span></div>
        <div class="ops"><button data-act="edit">✏️</button><button data-act="del">🗑</button></div>`;
      el.querySelector('[data-act="edit"]').onclick=()=> openHabitEdit(h);
      el.querySelector('[data-act="del"]').onclick=async()=>{
        if(confirm(`删除习惯「${h.name}」？相关打卡记录也会清除`)){
          await del('habits',h.id);
          const related=checks.filter(c=>c.habitId===h.id).map(c=>c.id);
          for(const id of related) await del('checks',id);
          checks=checks.filter(c=>c.habitId!==h.id);
          habits=habits.filter(x=>x.id!==h.id);
          renderMgrList(); refreshViews();
        }
      };
      box.appendChild(el);
    });
  }

  function openHabitEdit(habit){
    const isNew=!habit;
    let emoji=habit?habit.emoji:'💪';
    let name=habit?habit.name:'';
    let freq=habit?habit.freq:'daily';
    let repeatDays=habit?habit.repeatDays.slice():[0,1,2,3,4,5,6];
    let dailyTarget=habit?habit.dailyTarget:1;
    let weeklyTarget=habit?habit.weeklyTarget:3;
    let reminder=habit?habit.reminder:'';
    const draw=()=>{
      const weekdayPick = freq==='custom'
        ? `<div class="weekday-pick">${[1,2,3,4,5,6,0].map(d=>{
            const on=repeatDays.includes(d);
            return `<button class="${on?'on':''}" data-d="${d}">${WEEK[d]}</button>`;
          }).join('')}</div>`
        : '';
      const dailyTargetLine = freq==='daily'
        ? `<div class="field-line"><label>每天目标次数</label><input id="dailyTarget" type="number" min="1" max="20" value="${dailyTarget}"><div class="field-hint">如「喝水」设 8，每天需打卡 8 次</div></div>`
        : '';
      const weeklyLine = freq==='weekly'
        ? `<div class="field-line"><label>每周目标次数</label><input id="weeklyTarget" type="number" min="1" max="50" value="${weeklyTarget}"><div class="field-hint">每周累计打满即算达成周目标</div></div>`
        : '';
      let html=`<div class="top"><h3>${isNew?'新增习惯':'编辑习惯'}</h3><button class="close" id="editClose">×</button></div>
        <div class="field-line"><label>图标</label><div id="emojiShow" style="font-size:34px;cursor:pointer;text-align:center;padding:10px;background:#f7f8fb;border-radius:12px;">${emoji}</div></div>
        <div class="field-line"><label>名称</label><input id="habitName" maxlength="12" placeholder="如：喝水 / 读书 / 运动" value="${escapeHtml(name)}"></div>
        <div class="field-line"><label>频率</label>
          <div class="seg">
            <button data-f="daily" class="${freq==='daily'?'on':''}">每天</button>
            <button data-f="weekly" class="${freq==='weekly'?'on':''}">每周 N 次</button>
            <button data-f="custom" class="${freq==='custom'?'on':''}">自定义周几</button>
          </div>
          ${weekdayPick}${dailyTargetLine}${weeklyLine}
        </div>
        <div class="field-line"><label>每日提醒时间（可选）</label><input id="reminder" type="time" value="${reminder}"><div class="field-hint">打开 App 时若到时间且今天未完成，会提醒你</div></div>
        <button class="btn-primary" id="saveHabit">保存</button>
        ${isNew?'':'<button class="btn-danger" id="delHabit" style="margin-top:10px;width:100%;padding:14px;border-radius:12px;">删除</button>'}`;
      $('#mgr').innerHTML=html;
      $('#mgr').querySelector('#editClose').onclick=()=> isNew?$('#mgrMask').classList.remove('show'):openHabitMgr();
      $('#mgr').querySelector('#emojiShow').onclick=()=> openEmojiPicker(e=>{ emoji=e; $('#mgr').querySelector('#emojiShow').textContent=e; });
      $('#mgr').querySelectorAll('.seg button').forEach(b=> b.onclick=()=>{ freq=b.dataset.f; draw(); });
      $('#mgr').querySelectorAll('.weekday-pick button').forEach(b=> b.onclick=()=>{
        const d=+b.dataset.d;
        if(repeatDays.includes(d)) repeatDays=repeatDays.filter(x=>x!==d);
        else repeatDays.push(d);
        draw();
      });
      $('#mgr').querySelector('#saveHabit').onclick=async()=>{
        const nm=$('#mgr').querySelector('#habitName').value.trim();
        if(!nm){ alert('请填写习惯名称'); return; }
        if(freq==='daily'){ repeatDays=[0,1,2,3,4,5,6]; dailyTarget=Math.max(1, parseInt($('#mgr').querySelector('#dailyTarget').value)||1); weeklyTarget=0; }
        else if(freq==='weekly'){ repeatDays=[0,1,2,3,4,5,6]; dailyTarget=1; weeklyTarget=Math.max(1, parseInt($('#mgr').querySelector('#weeklyTarget').value)||3); }
        else { if(!repeatDays.length){ alert('请至少选择一天'); return; } dailyTarget=1; weeklyTarget=0; }
        const rem=$('#mgr').querySelector('#reminder').value;
        if(isNew){
          const maxOrder=habits.reduce((m,h)=>Math.max(m,h.order),0);
          const h={ id:uid(), name:nm, emoji, order:maxOrder+1, freq, repeatDays, dailyTarget, weeklyTarget, reminder:rem, created:todayStr() };
          await put('habits',h); habits.push(h);
        } else {
          Object.assign(habit,{ name:nm, emoji, freq, repeatDays, dailyTarget, weeklyTarget, reminder:rem });
          await put('habits',habit);
        }
        $('#mgrMask').classList.remove('show');
        refreshViews();
      };
      if(!isNew) $('#mgr').querySelector('#delHabit').onclick=async()=>{
        if(confirm(`删除习惯「${habit.name}」？`)){
          await del('habits',habit.id);
          const related=checks.filter(c=>c.habitId===habit.id).map(c=>c.id);
          for(const id of related) await del('checks',id);
          checks=checks.filter(c=>c.habitId!==habit.id);
          habits=habits.filter(x=>x.id!==habit.id);
          $('#mgrMask').classList.remove('show');
          refreshViews();
        }
      };
    };
    draw();
  }

  /* ============================================================
     11. 补打卡弹窗
     ============================================================ */
  function openBackfill(){
    const max=todayStr();
    let html=`<div class="top"><h3>📅 补打卡</h3><button class="close" id="bfClose">×</button></div>
      <div class="field-line"><label>选择日期</label><input id="bfDate" type="date" max="${max}" value="${max}"></div>
      <div id="bfList"></div>`;
    $('#sheet').innerHTML=html;
    $('#sheetMask').classList.add('show');
    $('#sheet').querySelector('#bfClose').onclick=()=> $('#sheetMask').classList.remove('show');
    const reload=()=>{ const v=$('#sheet').querySelector('#bfDate').value; if(v) renderDayList($('#sheet').querySelector('#bfList'), v); };
    $('#sheet').querySelector('#bfDate').onchange=reload;
    reload();
  }

  /* ============================================================
     12. emoji 选择器
     ============================================================ */
  function openEmojiPicker(cb){
    const grid=$('#emojiPicker').querySelector('.grid') || (()=>{ const g=document.createElement('div'); g.className='grid'; $('#emojiPicker').appendChild(g); return g; })();
    grid.innerHTML='';
    EMOJI_POOL.forEach(e=>{
      const el=document.createElement('div'); el.className='emoji-pick'; el.textContent=e;
      el.onclick=()=>{ cb(e); $('#emojiMask').classList.remove('show'); };
      grid.appendChild(el);
    });
    $('#emojiMask').classList.add('show');
  }

  /* ============================================================
     13. 导出 / 备份
     ============================================================ */
  function exportExcel(){
    if(!checks.length){ alert('还没有打卡记录'); return; }
    const nameMap={}; habits.forEach(h=>nameMap[h.id]=h.name);
    const rows=[['习惯','频率','日期','次数','目标']];
    checks.slice().sort((a,b)=> a.date<b.date?-1:1).forEach(c=>{
      const h=habitById(c.habitId);
      rows.push([nameMap[c.habitId]||'(已删)', h?freqDesc(h):'', c.date, c.count||1, h?h.dailyTarget:1]);
    });
    if(!window.YJXLSX){ alert('导出模块未加载'); return; }
    const bytes=window.YJXLSX.buildXlsx(rows,'打卡记录');
    const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    window.YJXLSX.triggerDownload(blob,'打卡记录.xlsx');
  }
  function backupJSON(){
    const data={ type:'habit-tracker-backup', v:1, exportedAt:todayStr(), habits, checks, settings };
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='习惯打卡备份.json';
    document.body.appendChild(a); a.click(); setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(a.href);},100);
  }
  async function restoreJSON(e){
    const f=e.target.files[0]; if(!f) return;
    try{
      const txt=await f.text();
      const data=JSON.parse(txt);
      if(data.type!=='habit-tracker-backup' || !Array.isArray(data.habits)){ alert('文件格式不正确'); return; }
      if(!confirm('恢复将覆盖当前所有习惯与打卡记录，确定？')) return;
      // 清空
      const allH=await getAll('habits'); for(const h of allH) await del('habits',h.id);
      const allC=await getAll('checks'); for(const c of allC) await del('checks',c.id);
      habits=[]; checks=[];
      for(const h of data.habits){ if(h.id==='__settings__') continue; const sh=sanitizeHabit(h, h.created); await put('habits',sh); habits.push(sh); }
      for(const c of (data.checks||[])){ const rec={id:c.id,habitId:c.habitId,date:c.date,count:c.count||1}; await put('checks',rec); checks.push(rec); }
      settings=Object.assign({theme:'indigo',avatar:'',wallpaper:'',wallpaperMode:'face'}, data.settings||{});
      await saveSettings(); applyTheme(); applyWallpaper(); refreshViews();
      alert('恢复成功');
    }catch(err){ alert('恢复失败：'+err.message); }
  }

  /* ============================================================
     14. 设置持久化
     ============================================================ */
  async function saveSettings(){
    let raw=await get('habits','__settings__');
    raw=raw||{id:'__settings__'};
    raw.value=settings;
    await put('habits',raw);
  }
  async function loadSettings(){
    const raw=await get('habits','__settings__');
    if(raw&&raw.value) settings=Object.assign(settings,raw.value);
  }

  /* ============================================================
     15. 提醒（in-app 轻量检查）
     ============================================================ */
  function checkReminders(){
    const now=new Date(); const hhmm=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const t=new Date(); t.setHours(0,0,0,0); const ts=ymd(t);
    const due=habits.filter(h=> h.reminder && h.reminder<=hhmm && isPlanDay(h,t) && countOf(h.id,ts)<h.dailyTarget);
    if(due.length){
      setTimeout(()=> alert('⏰ 今日提醒：\n'+due.map(h=>`${h.emoji} ${h.name}`).join('\n')+'（打开 App 即可打卡）'), 600);
    }
  }

  /* ============================================================
     16. Tab 切换 & 刷新
     ============================================================ */
  function refreshViews(){
    renderHome();
    if($('#view-habits').classList.contains('active')) renderHabits();
    if($('#view-stat').classList.contains('active')) renderStat();
    if($('#view-mine').classList.contains('active')) renderMine();
  }
  function switchView(v){
    document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
    $('#view-'+v).classList.add('active');
    document.querySelectorAll('.tabbar .tab').forEach(el=>el.classList.toggle('on', el.dataset.view===v));
    if(v==='home') renderHome();
    if(v==='habits') renderHabits();
    if(v==='stat') renderStat();
    if(v==='mine') renderMine();
  }

  /* ============================================================
     17. 初始化
     ============================================================ */
  async function init(){
    await openDB();
    let allH=await getAll('habits');
    const settingsRec=allH.find(h=>h.id==='__settings__');
    allH=allH.filter(h=>h.id!=='__settings__');
    const earliest = checks.length ? checks.reduce((mn,c)=> c.date<mn?c.date:mn, checks[0].date) : null;
    const earliestMap={};
    habits = allH.map(h=>{
      const ec = (checks.filter(c=>c.habitId===h.id).sort((a,b)=>a.date<b.date?-1:1)[0]||{}).date;
      return sanitizeHabit(h, ec || earliest);
    });
    checks = (await getAll('checks')).map(c=> c.count!=null ? c : Object.assign(c,{count:1}));
    if(settingsRec && settingsRec.value) settings=Object.assign(settings, settingsRec.value);
    applyTheme(); applyWallpaper();
    renderHome();
    document.querySelectorAll('.tabbar .tab').forEach(t=> t.onclick=()=>switchView(t.dataset.view));
    $('#addBtn').onclick=()=> openHabitEdit(null);
    $('#sheetMask').onclick=e=>{ if(e.target.id==='sheetMask') $('#sheetMask').classList.remove('show'); };
    $('#mgrMask').onclick=e=>{ if(e.target.id==='mgrMask') $('#mgrMask').classList.remove('show'); };
    $('#emojiMask').onclick=e=>{ if(e.target.id==='emojiMask') $('#emojiMask').classList.remove('show'); };
    checkReminders();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
