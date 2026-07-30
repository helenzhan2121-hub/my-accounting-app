/* 对账本 · 个人对账 —— 纯前端，IndexedDB 持久化，无第三方品牌残留 */
(function () {
  'use strict';
  const APP_NAME = '对账本';
  const DB_NAME = 'duizhangben_db';
  const STORE = 'records';
  const $ = (s) => document.querySelector(s);

  // ---------- 分类（预置清单，用户可自定义增删改） ----------
  const DEFAULT_CATS = {
    out: [
      { name: '餐饮', icon: '🍜' }, { name: '奶茶', icon: '🧋' }, { name: '零食', icon: '🍪' },
      { name: '水果', icon: '🍉' }, { name: '交通', icon: '🚌' }, { name: '购物', icon: '🛍️' },
      { name: '美妆', icon: '💄' }, { name: '服饰', icon: '👗' }, { name: '鞋包', icon: '👟' },
      { name: '房租', icon: '🏠' }, { name: '水电费', icon: '💡' }, { name: '物业', icon: '🏢' },
      { name: '宠物', icon: '🐱' }, { name: '宝宝', icon: '🍼' }, { name: '医疗', icon: '💊' },
      { name: '健身', icon: '🏃‍♀️' }, { name: '娱乐', icon: '🎮' }, { name: '电影', icon: '🎬' },
      { name: '旅行', icon: '✈️' }, { name: '数码', icon: '📱' }, { name: '书籍', icon: '📖' },
      { name: '学习', icon: '✏️' }, { name: '保险', icon: '🛡️' }, { name: '人情', icon: '🎁' },
      { name: '通讯', icon: '☎️' }, { name: '其他', icon: '📦' }
    ],
    in: [
      { name: '工资', icon: '💰' }, { name: '兼职', icon: '💼' }, { name: '奖金', icon: '🏆' },
      { name: '理财', icon: '📈' }, { name: '投资', icon: '💹' }, { name: '利息', icon: '🪙' },
      { name: '红包', icon: '🧧' }, { name: '退款', icon: '↩️' }, { name: '报销', icon: '📄' },
      { name: '其他', icon: '✨' }
    ]
  };
  // 运行期分类（从设置读取，缺失则用预置）
  let CATS = { out: [], in: [] };

  // ---------- 主题（马卡龙 / 奶油色系，可爱风） ----------
  const THEMES = [
    { key: 'indigo', name: '靛蓝',   color: '#4F46E5', bg: '#F5F6FA', top: 'linear-gradient(135deg,#6366F1 0%,#4F46E5 100%)', icon: '🟣' },
    { key: 'slate',  name: '石墨',   color: '#475569', bg: '#F1F5F9', top: 'linear-gradient(135deg,#64748B 0%,#334155 100%)', icon: '⚫' },
    { key: 'teal',   name: '青绿',   color: '#0D9488', bg: '#ECFDF9', top: 'linear-gradient(135deg,#14B8A6 0%,#0D9488 100%)', icon: '🟢' },
    { key: 'amber',  name: '琥珀',   color: '#D97706', bg: '#FFFBEB', top: 'linear-gradient(135deg,#F59E0B 0%,#D97706 100%)', icon: '🟠' },
    { key: 'rose',   name: '玫红',   color: '#E11D48', bg: '#FFF1F3', top: 'linear-gradient(135deg,#F43F5E 0%,#E11D48 100%)', icon: '🌹' },
    { key: 'violet', name: '紫罗兰', color: '#7C3AED', bg: '#F5F3FF', top: 'linear-gradient(135deg,#8B5CF6 0%,#7C3AED 100%)', icon: '🔮' }
  ];

  // ---------- IndexedDB ----------
  let db;
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) {
          const s = d.createObjectStore(STORE, { keyPath: 'id' });
          s.createIndex('date', 'date');
        }
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }
  function tx(mode) { return db.transaction(STORE, mode).objectStore(STORE); }
  function getAll() {
    return new Promise((res, rej) => {
      const r = tx('readonly').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  }
  function put(rec) {
    return new Promise((res, rej) => {
      const r = tx('readwrite').put(rec);
      r.onsuccess = () => res(); r.onerror = () => rej(r.error);
    });
  }
  function del(id) {
    return new Promise((res, rej) => {
      const r = tx('readwrite').delete(id);
      r.onsuccess = () => res(); r.onerror = () => rej(r.error);
    });
  }

  // ---------- utils ----------
  const fmt = (n) => '¥' + (Number(n) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (n) => '¥' + Math.round(Number(n) || 0).toLocaleString('zh-CN');
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const todayStamp = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`; };
  function monthOf(d) { return (d || '').slice(0, 7); }
  function daysInMonth(m) { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
  function getIcon(name, type) {
    const list = CATS[type] || [];
    const found = list.find(c => c.name === name);
    return found ? found.icon : (type === 'in' ? '↓' : '↑');
  }

  // ---------- state ----------
  let records = [];
  let curType = 'out';
  let curCat = null;
  let currentMonth = monthOf(todayStr());
  let settings = { theme: 'indigo', avatar: '', wallpaper: '', wallpaperMode: 'face', cats: null };

  function loadSettings() {
    try { settings = JSON.parse(localStorage.getItem('dz_settings') || '{}'); } catch (e) {}
    if (!settings.theme) settings.theme = 'indigo';
    if (!settings.wallpaperMode) settings.wallpaperMode = 'face';
    if (!settings.cats || !settings.cats.out || !settings.cats.in) {
      settings.cats = JSON.parse(JSON.stringify(DEFAULT_CATS));
    }
    CATS = settings.cats;
    curCat = CATS[curType][0];
  }
  function saveSettings() { localStorage.setItem('dz_settings', JSON.stringify(settings)); }

  // ---------- 视图切换 ----------
  function switchView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view' + (name[0].toUpperCase() + name.slice(1))).classList.add('active');
    document.querySelectorAll('.tabbar .tab').forEach(t => t.classList.toggle('on', t.dataset.view === name));
    if (name === 'stats') renderStats();
    if (name === 'home') renderHome();
    if (name === 'detail') renderDetail();
  }

  // ---------- 汇总计算 ----------
  function calcMonth(m) {
    const list = records.filter(r => monthOf(r.date) === m);
    let ins = 0, out = 0;
    list.forEach(r => { if (r.type === 'in') ins += +r.amt; else out += +r.amt; });
    return { ins, out, bal: ins - out, count: list.length };
  }

  // ---------- 首页 ----------
  function renderHome() {
    const c = calcMonth(currentMonth);
    $('#homeBal').textContent = fmt(c.bal);
    $('#homeCount').textContent = c.count + ' 笔';
    $('#homeIn').textContent = fmt(c.ins);
    $('#homeOut').textContent = fmt(c.out);
    $('#topSub').textContent = `今天 ${todayStr()} · 共记账 ${records.length} 笔`;

    const list = records.slice().sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id)).slice(0, 5);
    const box = $('#homeList');
    if (!list.length) { box.innerHTML = '<div class="empty">还没有记录，点下方 + 记一笔</div>'; return; }
    box.innerHTML = list.map(r => recHtml(r)).join('');
    bindRecClicks(box);
  }

  // ---------- 明细 ----------
  function renderDetail() {
    const box = $('#detailList');
    const list = records.slice().sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
    if (!list.length) { box.innerHTML = '<div class="empty">暂无明细</div>'; return; }
    const groups = {};
    list.forEach(r => { (groups[r.date] = groups[r.date] || []).push(r); });
    const dates = Object.keys(groups).sort().reverse();
    let html = '';
    dates.forEach(d => {
      const dayRecs = groups[d];
      let din = 0, dout = 0;
      dayRecs.forEach(r => { if (r.type === 'in') din += +r.amt; else dout += +r.amt; });
      html += `<div class="day-group">
        <div class="day-head"><span>${d}<span class="tag">${dayRecs.length}笔</span></span><span>收 ${fmtInt(din)} · 支 ${fmtInt(dout)}</span></div>
        ${dayRecs.map(r => recHtml(r)).join('')}
      </div>`;
    });
    box.innerHTML = html;
    bindRecClicks(box);
  }

  function recHtml(r) {
    return `
      <div class="rec-item" data-id="${r.id}">
        <div class="icon">${getIcon(r.cat, r.type)}</div>
        <div class="mid">
          <div class="t">${esc(r.cat)}${r.note ? ' · ' + esc(r.note) : ''}</div>
          <div class="s">${r.date}</div>
        </div>
        <div class="amt ${r.type === 'in' ? 'in' : 'out'}">${r.type === 'in' ? '+' : '-'}${fmt(r.amt).slice(1)}</div>
      </div>`;
  }
  function bindRecClicks(box) {
    box.querySelectorAll('.rec-item').forEach(el => {
      el.addEventListener('click', () => { if (confirm('删除这条记录？')) del(el.dataset.id).then(load); });
    });
  }

  // ---------- 统计 ----------
  function renderStats() {
    $('#statMonth').textContent = currentMonth.replace('-', '年') + '月';
    const c = calcMonth(currentMonth);
    $('#statIn').textContent = fmtInt(c.ins);
    $('#statOut').textContent = fmtInt(c.out);
    $('#statBal').textContent = fmtInt(c.bal);
    drawBarChart(currentMonth);
    drawPieChart(currentMonth);
  }

  function drawBarChart(m) {
    const canvas = $('#barChart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = (rect.width || 300) * dpr;
    canvas.height = 200 * dpr;
    ctx.scale(dpr, dpr);
    const w = canvas.width / dpr, h = 200;
    ctx.clearRect(0, 0, w, h);

    const days = daysInMonth(m);
    const map = {};
    for (let i = 1; i <= days; i++) map[i] = { in: 0, out: 0 };
    records.filter(r => monthOf(r.date) === m).forEach(r => {
      const d = parseInt(r.date.slice(8), 10);
      if (map[d]) map[d][r.type] += +r.amt;
    });

    const maxVal = Math.max(1, ...Object.values(map).map(v => Math.max(v.in, v.out)));
    const pad = 26, bottom = 28, top = 16, chartH = h - bottom - top;
    const barW = (w - pad * 2) / days * 0.55;
    const step = (w - pad * 2) / days;

    // grid
    ctx.strokeStyle = 'rgba(0,0,0,.06)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = top + chartH * (i / 4);
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
    }
    // bars
    Object.keys(map).forEach((d, i) => {
      const x = pad + i * step + (step - barW) / 2;
      const vIn = map[d].in, vOut = map[d].out;
      const hIn = (vIn / maxVal) * chartH, hOut = (vOut / maxVal) * chartH;
      const base = top + chartH;
      if (vOut > 0) { ctx.fillStyle = '#ef4444'; ctx.fillRect(x, base - hOut, barW / 2, hOut); }
      if (vIn > 0) { ctx.fillStyle = '#16a34a'; ctx.fillRect(x + barW / 2, base - hIn, barW / 2, hIn); }
      // X 轴刻度：每 7 天标一次（1/8/15/22/29），数据仍是每日粒度
      if ((i === 0) || (i + 1) % 7 === 0 || i === days - 1) {
        ctx.fillStyle = '#6b7280'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(d, x + barW / 2, h - 8);
      }
    });
    // legend
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#16a34a'; ctx.fillRect(w - 78, 6, 10, 10); ctx.fillStyle = '#374151'; ctx.fillText('收入', w - 62, 15);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(w - 38, 6, 10, 10); ctx.fillStyle = '#374151'; ctx.fillText('支出', w - 22, 15);
  }

  function drawPieChart(m) {
    const canvas = $('#pieChart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = (rect.width || 300) * dpr;
    canvas.height = 200 * dpr;
    ctx.scale(dpr, dpr);
    const w = canvas.width / dpr, h = 200;
    ctx.clearRect(0, 0, w, h);

    const outRecs = records.filter(r => r.type === 'out' && monthOf(r.date) === m);
    if (!outRecs.length) { ctx.fillStyle = '#9ca3af'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('本月无支出', w / 2, h / 2); return; }

    const map = {};
    outRecs.forEach(r => { map[r.cat] = (map[r.cat] || 0) + +r.amt; });
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    const colors = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
    const cx = w / 2 - 40, cy = h / 2, r = Math.min(cx, cy) - 12;
    let start = -Math.PI / 2;
    const legend = [];
    Object.entries(map).forEach(([cat, val], i) => {
      const ang = (val / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, start + ang); ctx.closePath();
      ctx.fillStyle = colors[i % colors.length]; ctx.fill();
      start += ang;
      legend.push({ cat, val, color: colors[i % colors.length] });
    });
    // donut hole
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
    ctx.fillStyle = '#1f2937'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('¥' + Math.round(total).toLocaleString(), cx, cy + 4);

    // legend right
    ctx.textAlign = 'left';
    legend.forEach((l, i) => {
      const y = 30 + i * 22;
      ctx.fillStyle = l.color; ctx.fillRect(cx + r + 24, y - 8, 10, 10);
      ctx.fillStyle = '#374151'; ctx.font = '12px sans-serif'; ctx.fillText(l.cat, cx + r + 40, y);
    });
  }

  // ---------- 记一笔 ----------
  function openSheet() {
    $('#sheetMask').classList.add('show');
    $('#fDate').value = todayStr();
    $('#fAmt').value = '';
    $('#fNote').value = '';
    setType('out');
    renderCatGrid();
  }
  function closeSheet() { $('#sheetMask').classList.remove('show'); }
  function setType(t) {
    curType = t;
    document.querySelectorAll('#typeTabs button').forEach(b => {
      b.classList.toggle('on', b.dataset.v === t);
    });
    curCat = CATS[t][0];
    renderCatGrid();
  }
  function renderCatGrid() {
    $('#catGrid').innerHTML = CATS[curType].map(c => `
      <div class="cat ${c.name === curCat.name ? 'on' : ''}" data-name="${esc(c.name)}">
        <div class="emoji">${c.icon}</div><span>${c.name}</span>
      </div>`).join('');
    $('#catGrid').querySelectorAll('.cat').forEach(el => {
      el.addEventListener('click', () => { curCat = CATS[curType].find(c => c.name === el.dataset.name); renderCatGrid(); });
    });
  }
  async function save() {
    const amt = parseFloat($('#fAmt').value);
    if (!(amt > 0)) { alert('请输入金额'); return; }
    const rec = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: curType,
      amt: amt.toFixed(2),
      cat: curCat.name,
      date: $('#fDate').value || todayStr(),
      note: $('#fNote').value.trim()
    };
    await put(rec);
    closeSheet(); await load();
  }

  // ---------- 换肤 ----------
  function applyTheme(key) {
    const t = THEMES.find(x => x.key === key) || THEMES[0];
    const root = document.documentElement;
    root.style.setProperty('--blue', t.color);
    root.style.setProperty('--blue-d', t.color);
    root.style.setProperty('--bg', t.bg);
    root.style.setProperty('--topbar-bg', t.top);
    root.style.setProperty('--text', '#1f2937');
    root.style.setProperty('--sub', '#6b7280');
    $('#themeColor').setAttribute('content', t.color);
    const topbar = $('.topbar');
    if (topbar) topbar.style.background = t.top;
    settings.theme = key; saveSettings(); renderThemes();
  }
  function renderThemes() {
    $('#themeRow').innerHTML = THEMES.map(t => `
      <div class="theme-item ${t.key === settings.theme ? 'on' : ''}" data-k="${t.key}">
        <div class="circle" style="background:${t.color}">${t.icon}</div>
        <div class="name">${t.name}</div>
      </div>`).join('');
    $('#themeRow').querySelectorAll('.theme-item').forEach(el => {
      el.addEventListener('click', () => applyTheme(el.dataset.k));
    });
  }
  function applyWallpaper() {
    document.body.classList.toggle('has-wallpaper', !!settings.wallpaper);
    document.body.classList.remove('wp-mode-face', 'wp-mode-full', 'wp-mode-cover');
    document.body.classList.add('wp-mode-' + (settings.wallpaperMode || 'face'));
    if (settings.wallpaper) document.body.style.backgroundImage = `url(${settings.wallpaper})`;
    else document.body.style.backgroundImage = '';
    $('#wallPreview').style.display = settings.wallpaper ? 'block' : 'none';
    $('#wallPreview').src = settings.wallpaper || '';
    $('#wpModeRow').style.display = settings.wallpaper ? 'flex' : 'none';
    renderWallpaperMode();
  }
  function renderWallpaperMode() {
    document.querySelectorAll('#wpModeRow button').forEach(b => {
      b.classList.toggle('on', b.dataset.m === settings.wallpaperMode);
    });
  }
  function applyAvatar() {
    const img = $('#avatar img');
    if (settings.avatar) { img.src = settings.avatar; img.style.display = 'block'; }
    else img.style.display = 'none';
  }
  function readFile(file, cb) {
    const r = new FileReader();
    r.onload = () => cb(r.result);
    r.readAsDataURL(file);
  }

  // ---------- 分类管理（自定义增删改） ----------
  const EMOJI_POOL = [
    '🍜','🧋','🍪','🍰','🍩','🍦','🍫','🍬','🍭','🍉','🍓','🍎','🍌','🍇','🍊','🥑',
    '🚌','🚕','🚗','🚲','🛵','✈️','🚄','🚢','🛍️','🛒','🎁','🎀','🧸','💄','👗','👟',
    '👜','💍','🕶️','🧢','🏠','💡','🔌','💧','🏢','🧹','🐱','🐶','🐰','🐹','🦊','🐼',
    '🍼','👶','🧒','🤱','🎒','🍼','💊','🏥','🩺','🏃‍♀️','🧘‍♀️','🎾','🎮','🎬','🎤','🎨',
    '📱','💻','⌚','📷','🎧','📖','📚','✏️','📝','🎓','🧮','📈','💹','💰','💼','🧧',
    '🏆','🥇','🪙','💳','🧾','📄','↩️','✨','⭐','🌸','🌷','🌻','🍃','🌈','☀️','🌙',
    '🍕','🍔','🍟','🌭','🍿','🥗','🍱','🍣','🥟','🍛','🍝','🥘','🍲','🥗','🍤','🍙'
  ];
  let editType = 'out';
  function openCatMgr() {
    editType = curType;
    $('#catMgrMask').classList.add('show');
    renderCatMgr();
  }
  function closeCatMgr() { $('#catMgrMask').classList.remove('show'); }
  function renderCatMgr() {
    document.querySelectorAll('#catMgrTabs button').forEach(b => b.classList.toggle('on', b.dataset.v === editType));
    const list = CATS[editType];
    $('#catMgrList').innerHTML = list.map((c, i) => `
      <div class="cat-mgr-item">
        <span class="e">${c.icon}</span>
        <span class="n">${esc(c.name)}</span>
        <span class="ops">
          <button data-act="edit" data-i="${i}" title="编辑">✏️</button>
          <button data-act="del" data-i="${i}" title="删除">🗑</button>
        </span>
      </div>`).join('');
    $('#catMgrList').querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        const i = +b.dataset.i;
        if (b.dataset.act === 'del') {
          openCatEdit(i);   // 删除也走弹窗，删除键在左侧
        } else {
          openCatEdit(i);
        }
      });
    });
  }
  // 编辑 / 删除弹窗（删除在左，保存/确认在右）
  function openCatEdit(i) {
    const c = CATS[editType][i];
    const isDefault = c.name === '其他';
    $('#catEditName').value = c.name;
    $('#catEditEmoji').textContent = c.icon;
    $('#catEditEmoji').dataset.cur = c.icon;
    const delBtn = $('#catEditDel');
    if (isDefault) {
      delBtn.style.display = 'none';
    } else {
      delBtn.style.display = '';
      delBtn.onclick = () => {
        if (confirm(`删除分类「${c.name}」？已有该分类的记账会保留并显示原名。`)) {
          CATS[editType].splice(i, 1); saveSettings(); renderCatMgr(); closeCatEdit();
        }
      };
    }
    $('#catEditSave').onclick = () => {
      const name = $('#catEditName').value.trim();
      if (!name) { alert('名称不能为空'); return; }
      CATS[editType][i] = { name, icon: $('#catEditEmoji').dataset.cur || c.icon };
      saveSettings(); renderCatMgr(); closeCatEdit();
    };
    $('#catEditEmoji').onclick = () => {
      pickEmoji((emoji) => { $('#catEditEmoji').textContent = emoji; $('#catEditEmoji').dataset.cur = emoji; }, $('#catEditEmoji').dataset.cur);
    };
    $('#catEditMask').classList.add('show');
  }
  function closeCatEdit() { $('#catEditMask').classList.remove('show'); }
  function addCat() {
    const name = prompt('新分类名称：', '');
    if (name === null) return;
    if (!name.trim()) { alert('名称不能为空'); return; }
    if (CATS[editType].some(c => c.name === name.trim())) { alert('已存在同名分类'); return; }
    pickEmoji((emoji) => {
      CATS[editType].push({ name: name.trim(), icon: emoji || '⭐' });
      saveSettings(); renderCatMgr();
    });
  }
  function pickEmoji(cb, cur) {
    const grid = EMOJI_POOL.map(e => `<span class="emoji-pick" data-e="${e}">${e}</span>`).join('');
    $('#emojiPicker').innerHTML = grid;
    $('#emojiPickerMask').classList.add('show');
    $('#emojiPicker').querySelectorAll('.emoji-pick').forEach(el => {
      el.addEventListener('click', () => {
        $('#emojiPickerMask').classList.remove('show');
        cb(el.dataset.e);
      });
    });
  }
  function exportExcel() {
    if (!records.length) { alert('还没有数据可导出'); return; }
    const exp = records.slice().sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id));
    const objs = exp.map(r => ({
      '日期': r.date, '类型': r.type === 'in' ? '收入' : '支出',
      '分类': r.cat, '金额(元)': Number(r.amt), '备注': r.note || ''
    }));
    let tin = 0, tout = 0;
    exp.forEach(r => { if (r.type === 'in') tin += +r.amt; else tout += +r.amt; });
    objs.push({ '日期': '合计', '类型': '', '分类': '', '金额(元)': Number((tin - tout).toFixed(2)), '备注': `收入${fmt(tin)} / 支出${fmt(tout)}` });
    const fname = `${APP_NAME}_${todayStamp()}.xlsx`;
    YJXLSX.exportObjects(objs, '对账记录', fname);
  }
  function backup() {
    if (!records.length) { alert('暂无数据可备份'); return; }
    const blob = new Blob([JSON.stringify({ app: APP_NAME, version: 1, exportAt: new Date().toISOString(), records }, null, 2)], { type: 'application/json' });
    YJXLSX.triggerDownload(blob, `${APP_NAME}_备份_${todayStamp()}.json`);
  }
  function restore(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        const recs = Array.isArray(data) ? data : data.records;
        if (!Array.isArray(recs)) throw new Error('格式不正确');
        for (const r of recs) { if (!r.id) r.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); await put(r); }
        await load(); alert(`已导入 ${recs.length} 条记录`);
      } catch (e) { alert('导入失败：' + e.message); }
    };
    reader.readAsText(file);
  }
  function loadSample() {
    const today = todayStr();
    const yest = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
    const samples = [
      { type: 'out', amt: '15.00', cat: '交通', date: today, note: '打车' },
      { type: 'out', amt: '26.00', cat: '餐饮', date: today, note: '早餐' },
      { type: 'out', amt: '299.00', cat: '教育', date: yest, note: '网课' },
      { type: 'in', amt: '800.00', cat: '兼职', date: yest, note: '外包' }
    ];
    samples.forEach(s => s.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    Promise.all(samples.map(put)).then(load);
  }
  function clearAll() {
    if (!confirm('确定清空全部记账数据？此操作不可恢复！')) return;
    Promise.all(records.map(r => del(r.id))).then(load);
  }

  // ---------- init ----------
  async function load() {
    records = await getAll();
    renderHome();
    renderDetail();
    if ($('#viewStats').classList.contains('active')) renderStats();
  }

  function bind() {
    document.querySelectorAll('.tabbar .tab').forEach(t => t.addEventListener('click', () => switchView(t.dataset.view)));
    $('#addBtn').addEventListener('click', openSheet);
    $('#closeSheet').addEventListener('click', closeSheet);
    $('#sheetMask').addEventListener('click', (e) => { if (e.target.id === 'sheetMask') closeSheet(); });
    $('#saveBtn').addEventListener('click', save);
    document.querySelectorAll('#typeTabs button').forEach(b => b.addEventListener('click', () => setType(b.dataset.v)));
    $('#toDetail').addEventListener('click', () => switchView('detail'));
    $('#prevMonth').addEventListener('click', () => { currentMonth = prevMonth(currentMonth); renderStats(); });
    $('#nextMonth').addEventListener('click', () => { currentMonth = nextMonth(currentMonth); renderStats(); });
    $('#exportExcel').addEventListener('click', exportExcel);
    $('#backupBtn').addEventListener('click', backup);
    $('#restoreBtn').addEventListener('click', () => $('#restoreFile').click());
    $('#restoreFile').addEventListener('change', (e) => { if (e.target.files[0]) restore(e.target.files[0]); });
    $('#sampleBtn').addEventListener('click', loadSample);
    $('#clearBtn').addEventListener('click', clearAll);
    $('#uploadAvatar').addEventListener('change', (e) => {
      if (!e.target.files[0]) return;
      readFile(e.target.files[0], (url) => { settings.avatar = url; saveSettings(); applyAvatar(); });
    });
    $('#uploadWall').addEventListener('change', (e) => {
      if (!e.target.files[0]) return;
      readFile(e.target.files[0], (url) => { settings.wallpaper = url; settings.wallpaperMode = settings.wallpaperMode || 'face'; saveSettings(); applyWallpaper(); });
    });
    document.querySelectorAll('#wpModeRow button').forEach(b => {
      b.addEventListener('click', () => { settings.wallpaperMode = b.dataset.m; saveSettings(); applyWallpaper(); });
    });
    // 分类管理
    $('#catMgrBtn').addEventListener('click', openCatMgr);
    $('#closeCatMgr').addEventListener('click', closeCatMgr);
    $('#catMgrMask').addEventListener('click', (e) => { if (e.target.id === 'catMgrMask') closeCatMgr(); });
    $('#addCatBtn').addEventListener('click', addCat);
    document.querySelectorAll('#catMgrTabs button').forEach(b => b.addEventListener('click', () => { editType = b.dataset.v; renderCatMgr(); }));
    $('#emojiPickerMask').addEventListener('click', (e) => { if (e.target.id === 'emojiPickerMask') $('#emojiPickerMask').classList.remove('show'); });
    $('#catEditMask').addEventListener('click', (e) => { if (e.target.id === 'catEditMask') closeCatEdit(); });
    window.addEventListener('resize', () => { if ($('#viewStats').classList.contains('active')) renderStats(); });
  }

  function prevMonth(m) {
    const [y, mo] = m.split('-').map(Number);
    const d = new Date(y, mo - 2, 1);
    return d.toISOString().slice(0, 7);
  }
  function nextMonth(m) {
    const [y, mo] = m.split('-').map(Number);
    const d = new Date(y, mo, 1);
    return d.toISOString().slice(0, 7);
  }

  (async function init() {
    try {
      loadSettings();
      applyTheme(settings.theme);
      applyWallpaper();
      applyAvatar();
      renderThemes();
      await openDB();
      bind();
      await load();
    } catch (e) {
      alert('初始化失败：' + e.message);
    }
  })();
})();
