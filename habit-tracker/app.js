/* ============================================================
   习惯打卡 App — 业务逻辑
   架构：IndexedDB 本地存储 + 现代靛蓝设计系统 + 壁纸三模式
   ============================================================ */
(function(){
  'use strict';

  /* ---------- 1. 数据库 ---------- */
  const DB_NAME = 'habit_db', DB_VER = 1;
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

  /* ---------- 2. 状态 ---------- */
  let habits = [];      // [{id,name,emoji,order}]
  let checks = [];      // [{id,habitId,date}]
  let settings = { theme:'indigo', avatar:'', wallpaper:'', wallpaperMode:'face' };
  let settingsReady = false;

  /* ---------- 3. 工具 ---------- */
  const $ = s=>document.querySelector(s);
  const todayStr = ()=>{ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const ymd = d=> `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const uid = ()=> Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  const EMOJI_POOL = ['💪','📚','🏃','🧘','💧','🥗','😴','🚭','✍️','🎯','🌅','🧹','💊','🎸','🪥','📵','🌿','🙏','💡','🔥'];
  const THEMES = [
    { key:'indigo', name:'靛蓝', color:'#4F46E5', bg:'#EEF2FF', top:'linear-gradient(135deg,#6366F1 0%,#4F46E5 100%)', icon:'💎' },
    { key:'slate',  name:'石墨', color:'#475569', bg:'#F1F5F9', top:'linear-gradient(135deg,#64748B 0%,#475569 100%)', icon:'🪨' },
    { key:'teal',   name:'青绿', color:'#0D9488', bg:'#ECFDF5', top:'linear-gradient(135deg,#2DD4BF 0%,#0D9488 100%)', icon:'🌿' },
    { key:'amber',  name:'琥珀', color:'#D97706', bg:'#FFFBEB', top:'linear-gradient(135deg,#FBBF24 0%,#D97706 100%)', icon:'🟡' },
    { key:'rose',   name:'玫红', color:'#E11D48', bg:'#FFF1F2', top:'linear-gradient(135deg,#FB7185 0%,#E11D48 100%)', icon:'🌹' },
    { key:'violet', name:'紫罗兰', color:'#7C3AED', bg:'#F5F3FF', top:'linear-gradient(135deg,#A78BFA 0%,#7C3AED 100%)', icon:'💜' }
  ];
  const getTheme = ()=> THEMES.find(t=>t.key===settings.theme) || THEMES[0];

  /* ---------- 4. 主题 / 壁纸 ---------- */
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

  /* ---------- 5. 打卡逻辑 ---------- */
  function isChecked(habitId, date){ return checks.some(c=>c.habitId===habitId && c.date===date); }
  function checkId(habitId, date){ return habitId + '|' + date; }
  async function toggleCheck(habitId, date){
    const id = checkId(habitId, date);
    if(isChecked(habitId, date)){
      await del('checks', id);
      checks = checks.filter(c=>c.id!==id);
    } else {
      const rec = { id, habitId, date };
      await put('checks', rec);
      checks.push(rec);
    }
    renderHome(); renderHabits(); if($('#view-stat').classList.contains('active')) renderStat();
  }
  // 连续天数（含今天或昨天，断则归零）
  function streak(habitId){
    let n = 0;
    const d = new Date();
    // 若今天没打，从昨天起算
    if(!isChecked(habitId, ymd(d))){
      d.setDate(d.getDate()-1);
      if(!isChecked(habitId, ymd(d))) return 0;
    }
    while(isChecked(habitId, ymd(d))){
      n++; d.setDate(d.getDate()-1);
    }
    return n;
  }
  // 某月打卡天数
  function monthDone(habitId, y, m){
    return checks.filter(c=>c.habitId===habitId && c.date.startsWith(`${y}-${String(m+1).padStart(2,'0')}` )).length;
  }

  /* ---------- 6. 渲染：首页 ---------- */
  function renderHome(){
    const t = todayStr();
    const doneToday = habits.filter(h=>isChecked(h.id, t)).length;
    const total = habits.length;
    const pct = total ? Math.round(doneToday/total*100) : 0;
    // 月历（当前月）
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const first = new Date(y, m, 1);
    const startPad = (first.getDay()+6)%7; // 周一为一周起点
    const daysInMonth = new Date(y, m+1, 0).getDate();
    // 全习惯当月每日完成数（至少1个习惯即点亮）
    const dailyCount = {};
    for(let i=1;i<=daysInMonth;i++){
      const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      dailyCount[i] = checks.filter(c=>c.date===ds).length;
    }
    let calHTML = '<div class="cal-grid">';
    ['一','二','三','四','五','六','日'].forEach(w=> calHTML += `<div class="wd">${w}</div>`);
    for(let i=0;i<startPad;i++) calHTML += '<div></div>';
    const todayNum = now.getDate();
    for(let i=1;i<=daysInMonth;i++){
      const cnt = dailyCount[i];
      const cls = 'cal-day' + (cnt>0?' done':'') + (i===todayNum?' today':'');
      calHTML += `<div class="${cls}">${i}</div>`;
    }
    calHTML += '</div>';

    let html = `
      <div class="home-card">
        <div class="today-overview">
          <div class="t-title">今日打卡 ${doneToday}/${total}</div>
          <div class="t-sub">${pct===100 && total ? '🎉 全部完成，太棒了！' : '坚持一小步，进步一大步'}</div>
          <div class="t-prog"><i style="width:${pct}%"></i></div>
        </div>
      </div>
      <div class="sec-title">本月足迹 <span class="more">${y}年${m+1}月</span></div>
      <div class="home-card">${calHTML}</div>
      <div class="sec-title">今日待打卡</div>
      <div id="todayList"></div>
    `;
    $('#homeContent').innerHTML = html;
    // 今日列表
    const list = $('#todayList');
    if(!habits.length){
      list.innerHTML = '<div class="empty">还没有习惯，点下方 ＋ 添加第一个吧</div>';
    } else {
      habits.slice().sort((a,b)=>a.order-b.order).forEach(h=>{
        const on = isChecked(h.id, t);
        const el = document.createElement('div');
        el.className = 'habit-item';
        el.innerHTML = `<div class="emoji">${h.emoji}</div>
          <div class="mid"><div class="h-name">${escapeHtml(h.name)}</div><div class="h-meta">连续 ${streak(h.id)} 天</div></div>
          <button class="check ${on?'on':''}">${on?'✓':''}</button>`;
        el.querySelector('.check').onclick = ()=> toggleCheck(h.id, t);
        list.appendChild(el);
      });
    }
  }

  /* ---------- 7. 渲染：习惯列表 ---------- */
  function renderHabits(){
    const t = todayStr();
    let html = `<div class="sec-title">我的习惯 <span class="more" id="manageHabits">管理 ›</span></div>`;
    if(!habits.length){
      html += '<div class="empty">还没有习惯，点下方 ＋ 添加</div>';
    } else {
      habits.slice().sort((a,b)=>a.order-b.order).forEach(h=>{
        const on = isChecked(h.id, t);
        html += `<div class="habit-item">
          <div class="emoji">${h.emoji}</div>
          <div class="mid"><div class="h-name">${escapeHtml(h.name)}</div><div class="h-meta">连续 ${streak(h.id)} 天 · 本月 ${monthDone(h.id, new Date().getFullYear(), new Date().getMonth())} 天</div></div>
          <button class="check ${on?'on':''}" data-id="${h.id}">${on?'✓':''}</button>
        </div>`;
      });
    }
    $('#habitsContent').innerHTML = html;
    if(habits.length) $('#habitsContent').querySelectorAll('.check').forEach(b=> b.onclick=()=>toggleCheck(b.dataset.id, t));
    const mgr = $('#habitsContent').querySelector('#manageHabits');
    if(mgr) mgr.onclick = openHabitMgr;
  }

  /* ---------- 8. 渲染：统计 ---------- */
  function renderStat(){
    const t = todayStr();
    const totalChecks = checks.length;
    const days = new Set(checks.map(c=>c.date)).size;
    // 连续榜
    const ranked = habits.slice().sort((a,b)=>streak(b.id)-streak(a.id));
    let html = `
      <div class="stat-head">📊 打卡统计</div>
      <div class="stat-cards">
        <div class="sc"><div class="k">习惯数</div><div class="v">${habits.length}</div></div>
        <div class="sc in"><div class="k">累计打卡</div><div class="v">${totalChecks}</div></div>
        <div class="sc"><div class="k">活跃天</div><div class="v">${days}</div></div>
      </div>
      <div class="chart-card"><h4>连续天数排行</h4><div id="rankList"></div></div>
    `;
    $('#statContent').innerHTML = html;
    const rl = $('#statContent').querySelector('#rankList');
    if(!habits.length){ rl.innerHTML = '<div class="empty">暂无数据</div>'; }
    else {
      ranked.forEach((h,i)=>{
        const s = streak(h.id);
        const el = document.createElement('div');
        el.className = 'habit-item';
        el.innerHTML = `<div class="emoji">${i+1}</div><div class="mid"><div class="h-name">${escapeHtml(h.name)}</div><div class="h-meta">连续 ${s} 天</div></div>`;
        rl.appendChild(el);
      });
    }
  }

  /* ---------- 9. 渲染：我的 ---------- */
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
        <h4>📤 导出数据</h4>
        <button class="btn-primary" id="exportBtn" style="background:#fff;color:var(--blue);border:1px solid var(--line);">导出打卡记录 Excel</button>
      </div>
    `;
    $('#mineContent').innerHTML = html;
    // 主题
    const tr = $('#mineContent').querySelector('#themeRow');
    THEMES.forEach(t=>{
      const el = document.createElement('div');
      el.className = 'theme-item' + (t.key===settings.theme?' on':'');
      el.dataset.key = t.key;
      el.innerHTML = `<div class="circle" style="background:${t.bg}">${t.icon}</div><div class="name">${t.name}</div>`;
      el.onclick = ()=>{ settings.theme=t.key; saveSettings(); applyTheme(); };
      tr.appendChild(el);
    });
    // 壁纸/头像上传
    $('#mineContent').querySelector('#wpInput').onchange = e=> handleImg(e, 'wallpaper');
    $('#mineContent').querySelector('#avInput').onchange = e=> handleImg(e, 'avatar');
    $('#mineContent').querySelectorAll('.wp-mode-row button').forEach(b=> b.onclick=()=>{
      settings.wallpaperMode=b.dataset.mode; saveSettings(); applyWallpaper(); renderMine();
    });
    $('#mineContent').querySelector('#clearWp').onclick = ()=>{ settings.wallpaper=''; saveSettings(); applyWallpaper(); renderMine(); };
    $('#mineContent').querySelector('#exportBtn').onclick = exportExcel;
  }

  function handleImg(e, field){
    const f = e.target.files[0]; if(!f) return;
    const rd = new FileReader();
    rd.onload = ()=>{ settings[field] = rd.result; saveSettings(); applyWallpaper(); renderMine(); };
    rd.readAsDataURL(f);
  }

  /* ---------- 10. 习惯管理弹窗 ---------- */
  function openHabitMgr(){
    let html = `<div class="top"><h3>管理习惯</h3><button class="close" id="mgrClose">×</button></div><div id="mgrList"></div>
      <button class="btn-primary" id="addHabit" style="margin-top:14px;">＋ 新增习惯</button>`;
    $('#mgr').innerHTML = html;
    renderMgrList();
    $('#mgrMask').classList.add('show');
    $('#mgr').querySelector('#mgrClose').onclick = ()=> $('#mgrMask').classList.remove('show');
    $('#mgr').querySelector('#addHabit').onclick = ()=> openHabitEdit(null);
  }
  function renderMgrList(){
    const box = $('#mgr').querySelector('#mgrList');
    if(!habits.length){ box.innerHTML = '<div class="empty">暂无习惯</div>'; return; }
    box.innerHTML = '';
    habits.slice().sort((a,b)=>a.order-b.order).forEach(h=>{
      const el = document.createElement('div');
      el.className = 'cat-mgr-item';
      el.innerHTML = `<div class="e">${h.emoji}</div><div class="n">${escapeHtml(h.name)}</div>
        <div class="ops"><button data-act="edit">✏️</button><button data-act="del">🗑</button></div>`;
      el.querySelector('[data-act="edit"]').onclick = ()=> openHabitEdit(h);
      el.querySelector('[data-act="del"]').onclick = async ()=>{
        if(confirm(`删除习惯「${h.name}」？相关打卡记录也会清除`)){
          await del('habits', h.id);
          const related = checks.filter(c=>c.habitId===h.id).map(c=>c.id);
          for(const id of related) await del('checks', id);
          checks = checks.filter(c=>c.habitId!==h.id);
          habits = habits.filter(x=>x.id!==h.id);
          renderMgrList(); renderHome(); renderHabits();
        }
      };
      box.appendChild(el);
    });
  }
  function openHabitEdit(habit){
    const isNew = !habit;
    let emoji = habit?habit.emoji:'💪';
    let name = habit?habit.name:'';
    let html = `<div class="top"><h3>${isNew?'新增习惯':'编辑习惯'}</h3><button class="close" id="editClose">×</button></div>
      <div class="field-line"><label>图标</label><div id="emojiShow" style="font-size:34px;cursor:pointer;text-align:center;padding:10px;background:#f7f8fb;border-radius:12px;">${emoji}</div></div>
      <div class="field-line"><label>名称</label><input id="habitName" maxlength="12" placeholder="如：喝水 / 读书 / 运动" value="${escapeAttr(name)}"></div>
      <button class="btn-primary" id="saveHabit">保存</button>
      ${isNew?'':'<button class="btn-danger" id="delHabit" style="margin-top:10px;width:100%;padding:14px;border-radius:12px;">删除</button>'}`;
    $('#mgr').innerHTML = html;
    $('#mgr').querySelector('#editClose').onclick = openHabitMgr;
    $('#mgr').querySelector('#emojiShow').onclick = ()=> openEmojiPicker(e=>{ emoji=e; $('#mgr').querySelector('#emojiShow').textContent=e; });
    $('#mgr').querySelector('#saveHabit').onclick = async ()=>{
      const nm = $('#mgr').querySelector('#habitName').value.trim();
      if(!nm){ alert('请填写习惯名称'); return; }
      if(isNew){
        const maxOrder = habits.reduce((m,h)=>Math.max(m,h.order),0);
        const h = { id:uid(), name:nm, emoji, order:maxOrder+1 };
        await put('habits', h); habits.push(h);
      } else {
        habit.name = nm; habit.emoji = emoji; await put('habits', habit);
        habits = habits.map(x=>x.id===habit.id?habit:x);
      }
      openHabitMgr(); renderHome(); renderHabits();
    };
    if(!isNew) $('#mgr').querySelector('#delHabit').onclick = async ()=>{
      if(confirm(`删除习惯「${habit.name}」？`)){
        await del('habits', habit.id);
        const related = checks.filter(c=>c.habitId===habit.id).map(c=>c.id);
        for(const id of related) await del('checks', id);
        checks = checks.filter(c=>c.habitId!==habit.id);
        habits = habits.filter(x=>x.id!==habit.id);
        openHabitMgr(); renderHome(); renderHabits();
      }
    };
  }

  /* ---------- 11. emoji 选择器 ---------- */
  function openEmojiPicker(cb){
    const grid = $('#emojiPicker').querySelector('.grid') || (()=>{ const g=document.createElement('div'); g.className='grid'; $('#emojiPicker').appendChild(g); return g; })();
    grid.innerHTML = '';
    EMOJI_POOL.forEach(e=>{
      const el = document.createElement('div'); el.className='emoji-pick'; el.textContent=e;
      el.onclick = ()=>{ cb(e); $('#emojiMask').classList.remove('show'); };
      grid.appendChild(el);
    });
    $('#emojiMask').classList.add('show');
  }

  /* ---------- 12. 底部加号 = 新增习惯 ---------- */
  function openAdd(){
    if(!habits.length || true){ openHabitEdit(null); }
  }

  /* ---------- 13. Excel 导出 ---------- */
  function exportExcel(){
    if(!checks.length){ alert('还没有打卡记录'); return; }
    const rows = [['习惯','日期']];
    const nameMap = {}; habits.forEach(h=>nameMap[h.id]=h.name);
    checks.slice().sort((a,b)=> a.date<b.date?-1:1).forEach(c=>{
      rows.push([nameMap[c.habitId]||'(已删)', c.date]);
    });
    if(window.YJXLSX) YJXLSX.buildXlsx(rows, '打卡记录');
    else alert('导出模块未加载');
  }

  /* ---------- 14. 设置持久化 ---------- */
  async function saveSettings(){
    let raw = await get('habits', '__settings__');
    raw = raw || { id:'__settings__' };
    raw.value = settings;
    await put('habits', raw);
  }
  async function loadSettings(){
    const raw = await get('habits', '__settings__');
    if(raw && raw.value){
      settings = Object.assign(settings, raw.value);
    }
  }

  /* ---------- 15. Tab 切换 ---------- */
  function switchView(v){
    document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
    $('#view-'+v).classList.add('active');
    document.querySelectorAll('.tabbar .tab').forEach(el=>el.classList.toggle('on', el.dataset.view===v));
    if(v==='home') renderHome();
    if(v==='habits') renderHabits();
    if(v==='stat') renderStat();
    if(v==='mine') renderMine();
  }

  /* ---------- 16. 工具：转义 ---------- */
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function escapeAttr(s){ return escapeHtml(s); }

  /* ---------- 17. 初始化 ---------- */
  async function init(){
    await openDB();
    habits = await getAll('habits'); habits = habits.filter(h=>h.id!=='__settings__');
    checks = await getAll('checks');
    await loadSettings();
    applyTheme(); applyWallpaper();
    renderHome();
    // 事件
    document.querySelectorAll('.tabbar .tab').forEach(t=> t.onclick=()=>switchView(t.dataset.view));
    $('#addBtn').onclick = openAdd;
    $('#sheetMask').onclick = e=>{ if(e.target.id==='sheetMask') $('#sheetMask').classList.remove('show'); };
    $('#mgrMask').onclick = e=>{ if(e.target.id==='mgrMask') $('#mgrMask').classList.remove('show'); };
    $('#emojiMask').onclick = e=>{ if(e.target.id==='emojiMask') $('#emojiMask').classList.remove('show'); };
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
