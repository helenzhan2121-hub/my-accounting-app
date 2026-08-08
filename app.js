/* 对账本 · 个人对账 —— 纯前端，IndexedDB 持久化，无第三方品牌残留 */
(function () {
  'use strict';
  const APP_NAME = '对账本';
  const DB_NAME = 'duizhangben_db';
  const STORE = 'records';
  const PERIOD_STORE = 'period_logs';
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
    { key: 'violet', name: '紫罗兰', color: '#7C3AED', bg: '#F5F3FF', top: 'linear-gradient(135deg,#8B5CF6 0%,#7C3AED 100%)', icon: '🔮' },
    { key: 'pink',   name: '粉色',   color: '#EC4899', bg: '#FDF2F8', top: 'linear-gradient(135deg,#F472B6 0%,#EC4899 100%)', light: '#F472B6', icon: '🌸' }
  ];

  // ---------- IndexedDB ----------
  let db;
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) {
          const s = d.createObjectStore(STORE, { keyPath: 'id' });
          s.createIndex('date', 'date');
        }
        if (!d.objectStoreNames.contains(PERIOD_STORE)) {
          d.createObjectStore(PERIOD_STORE, { keyPath: 'date' });
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
  // 本地时区 YYYY-MM-DD（避免 toISOString 的 UTC 偏差，GMT+8 凌晨会算错日）
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayStr = () => ymd(new Date());
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
  let editingId = null;
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
    ensurePeriodSettings();
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
    if (name === 'period') renderPeriod();
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
      <div class="rec-item" data-id="${r.id}" data-type="${r.type}" data-cat="${esc(r.cat)}">
        <div class="rec-main">
          <div class="icon">${getIcon(r.cat, r.type)}</div>
          <div class="mid">
            <input class="f-amt" type="number" step="0.01" value="${r.amt}" style="display:none">
            <input class="f-date" type="date" value="${r.date}" style="display:none">
            <input class="f-note" type="text" value="${esc(r.note || '')}" style="display:none">
            <div class="disp">
              <div class="t">${esc(r.cat)}${r.note ? ' · ' + esc(r.note) : ''}</div>
              <div class="s">${r.date}</div>
            </div>
            <div class="amt ${r.type === 'in' ? 'in' : 'out'}">${r.type === 'in' ? '+' : '-'}${fmt(r.amt).slice(1)}</div>
          </div>
        </div>
        <div class="rec-actions">
          <button class="edit-btn" data-act="edit" title="编辑">✎</button>
          <button class="del-btn" data-act="del" title="删除">🗑</button>
        </div>
      </div>`;
  }
  function bindRecClicks(box) {
    box.querySelectorAll('.rec-item').forEach(el => {
      const editBtn = el.querySelector('.edit-btn');
      const delBtn = el.querySelector('.del-btn');
      const disp = el.querySelector('.disp');
      const fAmt = el.querySelector('.f-amt');
      const fDate = el.querySelector('.f-date');
      const fNote = el.querySelector('.f-note');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        disp.style.display = 'none';
        fAmt.style.display = '';
        fDate.style.display = '';
        fNote.style.display = '';
        fAmt.focus();
        // 注入分类选择（行内编辑也能换分类图标）
        const catPop = document.createElement('div');
        catPop.className = 'cat-grid';
        catPop.id = 'inlineCatGrid';
        catPop.style.margin = '12px 0 4px';
        catPop.innerHTML = CATS[el.dataset.type].map(c => `<div class="cat ${c.name === el.dataset.cat ? 'on' : ''}" data-name="${c.name}"><div class="emoji">${c.icon}</div><span>${c.name}</span></div>`).join('');
        el.querySelector('.mid').appendChild(catPop);
        catPop.querySelectorAll('.cat').forEach(el2 => el2.addEventListener('click', () => {
          el.dataset.cat = el2.dataset.name;
          catPop.querySelectorAll('.cat').forEach(x => x.classList.remove('on'));
          el2.classList.add('on');
        }));
        editBtn.textContent = '💾';
        editBtn.title = '保存';
        editBtn.onclick = () => {
          const id = el.dataset.id;
          const type = el.dataset.type;
          const cat = el.dataset.cat;
          const amt = parseFloat(fAmt.value);
          const date = fDate.value;
          const note = fNote.value.trim();
          if (!(amt > 0)) { alert('请输入有效金额'); return; }
          const rec = { id, type, cat, amt: amt.toFixed(2), date, note };
          put(rec).then(load);
        };
      });
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('删除这条记录？')) del(el.dataset.id).then(load);
      });
    });
  }

  // ---------- 统计 ----------
  function renderStats() {
    $('#statMonth').textContent = currentMonth.replace('-', '年') + '月';
    const c = calcMonth(currentMonth);
    $('#statIn').textContent = fmtInt(c.ins);
    $('#statOut').textContent = fmtInt(c.out);
    $('#statBal').textContent = fmtInt(c.bal);
    drawTrendChart(currentMonth);
    drawPieChart(currentMonth);
  }

  function drawTrendChart(m) {
    const canvas = $('#barChart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = (rect.width || 300) * dpr;
    canvas.height = 200 * dpr;
    ctx.scale(dpr, dpr);
    const w = canvas.width / dpr, h = 200;
    ctx.clearRect(0, 0, w, h);

    const today = todayStr();
    const isCurrent = m === today.slice(0, 7);
    const days = isCurrent ? parseInt(today.slice(8), 10) : daysInMonth(m);
    const fullDays = daysInMonth(m);
    const map = {};
    for (let i = 1; i <= fullDays; i++) map[i] = { in: 0, out: 0 };
    records.filter(r => monthOf(r.date) === m).forEach(r => {
      const d = parseInt(r.date.slice(8), 10);
      if (map[d]) map[d][r.type] += +r.amt;
    });

    const maxVal = Math.max(1, ...Array.from({ length: days }, (_, i) => i + 1).map(i => Math.max(map[i].in, map[i].out)));
    const padL = 32, padR = 10, bottom = 22, top = 18, chartW = w - padL - padR, chartH = h - bottom - top;
    // X 轴按整月铺开，折线/数据只画到今天
    const xOf = i => padL + chartW * ((i - 1) / Math.max(1, fullDays - 1));
    const yOf = v => top + chartH * (1 - v / maxVal);

    // grid + Y labels
    ctx.strokeStyle = 'rgba(0,0,0,.06)'; ctx.lineWidth = 1;
    ctx.fillStyle = '#9ca3af'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = top + chartH * (i / 4);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillText(Math.round(maxVal * (1 - i / 4)).toString(), padL - 4, y + 3);
    }
    // X labels：始终显示整月关键刻度
    ctx.textAlign = 'center'; ctx.fillStyle = '#6b7280';
    [1, 8, 15, 22, 29].forEach(d => { if (d <= fullDays) ctx.fillText(d, xOf(d), h - 6); });

    // 支出：画到今天的折线
    const drawLine = (key, color) => {
      const pts = [];
      for (let i = 1; i <= days; i++) pts.push([xOf(i), yOf(map[i][key])]);
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach((p, idx) => idx === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
      ctx.stroke();
      ctx.fillStyle = color;
      pts.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 2, 0, Math.PI * 2); ctx.fill(); });
    };

    // 收入：只画有收入的点，分段连线（跳过 0 值）
    const drawIncomeSegments = () => {
      ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      let started = false;
      for (let i = 1; i <= days; i++) {
        const v = map[i].in;
        if (v <= 0) {
          if (started) { ctx.stroke(); started = false; }
          continue;
        }
        const x = xOf(i), y = yOf(v);
        if (!started) { ctx.beginPath(); ctx.moveTo(x, y); started = true; }
        else { ctx.lineTo(x, y); }
        ctx.fillStyle = '#16a34a';
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
      if (started) ctx.stroke();
    };

    drawIncomeSegments();
    drawLine('out', '#ef4444');

    // legend
    ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = '#16a34a'; ctx.fillRect(w - 76, 6, 10, 10); ctx.fillStyle = '#374151'; ctx.fillText('收入', w - 60, 15);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(w - 36, 6, 10, 10); ctx.fillStyle = '#374151'; ctx.fillText('支出', w - 20, 15);
  }

  function drawPieChart(m) {
    const canvas = $('#pieChart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = (rect.width || 300) * dpr;
    canvas.height = 230 * dpr;
    ctx.scale(dpr, dpr);
    const w = canvas.width / dpr, h = 230;
    ctx.clearRect(0, 0, w, h);

    const outRecs = records.filter(r => r.type === 'out' && monthOf(r.date) === m);
    if (!outRecs.length) { ctx.fillStyle = '#9ca3af'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('本月无支出', w / 2, h / 2); return; }

    const map = {};
    outRecs.forEach(r => { map[r.cat] = (map[r.cat] || 0) + +r.amt; });
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    const colors = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
    const cx = w / 2, cy = 78, r = Math.min(cx - 22, cy - 18);
    let start = -Math.PI / 2;
    const legend = [];
    Object.entries(map).forEach(([cat, val], i) => {
      const ang = (val / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, start + ang); ctx.closePath();
      ctx.fillStyle = colors[i % colors.length]; ctx.fill();
      start += ang;
      legend.push({ cat, val, pct: (val / total) * 100, color: colors[i % colors.length] });
    });
    // donut hole
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
    ctx.fillStyle = '#1f2937'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('¥' + Math.round(total).toLocaleString(), cx, cy + 4);

    // legend below: 分两行，每行最多 4 项，紧凑水平排列
    ctx.textAlign = 'left';
    const perRow = 4;
    const rows = Math.ceil(legend.length / perRow);
    const itemW = (w - 24) / perRow;
    const startY = cy + r + 22;
    legend.forEach((l, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const x = 12 + col * itemW + (itemW > 90 ? (itemW - 90) / 2 : 0);
      const y = startY + row * 26;
      const size = 8;
      ctx.fillStyle = l.color; ctx.fillRect(x, y - size / 2, size, size);
      ctx.fillStyle = '#374151'; ctx.font = '12px sans-serif'; ctx.fillText(l.cat, x + 12, y - 1);
      ctx.fillStyle = '#9ca3af'; ctx.font = '11px sans-serif'; ctx.fillText(l.pct.toFixed(1) + '%', x + 12, y + 12);
    });
  }

  // ---------- 记一笔 / 编辑记录 ----------
  function openSheet(id) {
    editingId = id || null;
    $('#sheetTitle').textContent = editingId ? '编辑记录' : '记一笔';
    $('#saveTopBtn').textContent = editingId ? '更新' : '保存';
    $('#saveBtn').textContent = editingId ? '更新记录' : '保存';
    if (editingId) {
      const r = records.find(x => x.id === id);
      if (!r) return;
      $('#fDate').value = r.date;
      $('#fAmt').value = r.amt;
      $('#fNote').value = r.note || '';
      setType(r.type);
      curCat = CATS[r.type].find(c => c.name === r.cat) || CATS[r.type][0];
      renderCatGrid();
    } else {
      $('#fDate').value = todayStr();
      $('#fAmt').value = '';
      $('#fNote').value = '';
      setType('out');
    }
    $('#sheetMask').classList.add('show');
    setTimeout(() => $('#fAmt').focus(), 120);
  }
  function closeSheet() { $('#sheetMask').classList.remove('show'); editingId = null; }
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
      id: editingId || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
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
    root.style.setProperty('--blue-l', t.light || '#6366F1');
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
    if (!records.length && !Object.keys(periodLogs).length) { alert('暂无数据可备份'); return; }
    const blob = new Blob([JSON.stringify({ app: APP_NAME, version: 1, exportAt: new Date().toISOString(), records, periodLogs: Object.values(periodLogs) }, null, 2)], { type: 'application/json' });
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
        const plogs = Array.isArray(data) ? null : (data.periodLogs || []);
        if (plogs && plogs.length) {
          await loadPeriodLogs();
          for (const p of plogs) { await savePeriodLog(p.date, p); }
        }
        await load(); alert(`已导入 ${recs.length} 条记账${plogs && plogs.length ? '、' + plogs.length + ' 条经期记录' : ''}`);
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

  // ================= 经期模块（参考美柚，基础版） =================
  let periodLogs = {}; // { 'YYYY-MM-DD': {date, period, flow, pain, mood, note} }
  function ensurePeriodSettings() {
    if (!settings.period) settings.period = {};
    if (!settings.period.cycle) settings.period.cycle = 28;
    if (!settings.period.duration) settings.period.duration = 5;
    if (settings.period.lastStart === undefined) settings.period.lastStart = '';
  }
  function periodTx(mode) { return db.transaction(PERIOD_STORE, mode).objectStore(PERIOD_STORE); }
  function loadPeriodLogs() {
    return new Promise((res, rej) => {
      const r = periodTx('readonly').getAll();
      r.onsuccess = () => { const arr = r.result || []; periodLogs = {}; arr.forEach(x => { periodLogs[x.date] = x; }); res(periodLogs); };
      r.onerror = () => rej(r.error);
    });
  }
  function savePeriodLog(date, patch) {
    return new Promise((res, rej) => {
      const cur = periodLogs[date] || { date, period: false, flow: '', pain: 0, mood: '', note: '' };
      const next = Object.assign({}, cur, patch, { date });
      periodLogs[date] = next;
      const r = periodTx('readwrite').put(next);
      r.onsuccess = () => res(); r.onerror = () => rej(r.error);
    });
  }
  function delPeriodLog(date) {
    return new Promise((res, rej) => {
      delete periodLogs[date];
      const r = periodTx('readwrite').delete(date);
      r.onsuccess = () => res(); r.onerror = () => rej(r.error);
    });
  }
  function diffDays(a, b) { const da = new Date(a), db = new Date(b); return Math.round((db - da) / 86400000); }
  function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return ymd(d); }
  // 从已标记经期推导「经期开始日」序列（连续 period 天视为同一段）
  function periodStarts() {
    const days = Object.keys(periodLogs).filter(d => periodLogs[d].period).sort();
    const starts = []; let prev = null;
    days.forEach(d => {
      if (!prev || diffDays(prev, d) > (settings.period.duration || 5)) starts.push(d);
      prev = d;
    });
    return starts;
  }
  // 平均周期：有≥2个开始日用实测，否则用设置
  function avgCycle() {
    const starts = periodStarts();
    if (starts.length >= 2) {
      let sum = 0;
      for (let i = 1; i < starts.length; i++) sum += diffDays(starts[i - 1], starts[i]);
      return Math.max(21, Math.min(45, Math.round(sum / (starts.length - 1))));
    }
    return settings.period.cycle || 28;
  }
  // 预测经期区间 + 排卵期 + 易孕期（标准：经期前14天排卵，易孕窗=排卵日前5至后1天）
  function predict() {
    const cycle = avgCycle();
    const dur = settings.period.duration || 5;
    const starts = periodStarts();
    const base = starts.length ? starts[starts.length - 1] : (settings.period.lastStart || '');
    const periodSet = new Set(), predictSet = new Set(), fertileSet = new Set(), ovulationSet = new Set();
    let nextStart = '';
    if (base) {
      const today = todayStr();
      // 1. 收集所有周期开始日：历史回推 + 未来预测
      const allStarts = new Set();
      let cur = base, guard = 0;
      while (guard < 12) { allStarts.add(cur); cur = addDays(cur, -cycle); guard++; }
      nextStart = base;
      while (diffDays(nextStart, today) >= 0) nextStart = addDays(nextStart, cycle);
      let fc = nextStart, fg = 0;
      while (diffDays(fc, today) < 150 && fg < 12) { allStarts.add(fc); fc = addDays(fc, cycle); fg++; }
      // 2. 区分实测经期（深粉）和预测经期（浅粉）
      allStarts.forEach(st => {
        const end = addDays(st, dur - 1);
        const isCurrent = diffDays(st, today) >= 0 && diffDays(end, today) <= 0;
        const isPast = diffDays(end, today) > 0;
        const target = (isCurrent || isPast) ? periodSet : predictSet;
        for (let i = 0; i < dur; i++) target.add(addDays(st, i));
      });
      // 3. 排卵日 & 易孕期
      allStarts.forEach(st => {
        const ov = addDays(st, -14);
        ovulationSet.add(ov);
        for (let i = -5; i <= 1; i++) fertileSet.add(addDays(ov, i));
      });
    }
    return { periodSet, predictSet, fertileSet, ovulationSet, nextStart, base, cycle, dur };
  }
  let periodMonth = monthOf(todayStr());
  let selectedPDate = todayStr();
  function renderPeriod() {
    ensurePeriodSettings();
    const { periodSet, predictSet, fertileSet, ovulationSet, nextStart } = predict();
    const today = todayStr();
    let phase = '', phaseSub = '';
    if (periodSet.has(today)) {
      let d = today, n = 0;
      while (periodLogs[d] && periodLogs[d].period) { n++; d = addDays(d, -1); }
      phase = '🌸 经期第 ' + n + ' 天';
      phaseSub = '好好照顾自己';
    } else if (predictSet.has(today)) {
      phase = '📅 预测经期中';
      phaseSub = '可能快来了，注意身体变化';
    } else if (nextStart) {
      const left = diffDays(today, nextStart);
      if (left > 0) { phase = '距离下次经期还有 ' + left + ' 天'; phaseSub = fertileSet.has(today) ? '当前处于易孕期' : ''; }
      else if (fertileSet.has(today)) { phase = '🌟 易孕期'; phaseSub = '注意身体变化'; }
      else { phase = '常规期'; phaseSub = ''; }
    } else {
      phase = '尚未设置经期记录'; phaseSub = '点日历标记第一天，或调整上方周期长度';
    }
    $('#periodPhase').textContent = phase;
    $('#periodPhaseSub').textContent = phaseSub;
    $('#pCycle').value = settings.period.cycle || 28;
    $('#pDur').value = settings.period.duration || 5;
    $('#periodMonth').textContent = periodMonth.replace('-', '年') + '月';
    renderPeriodCalendar(periodSet, predictSet, fertileSet, ovulationSet, today);
    renderPeriodPanel(selectedPDate);
    let tag = '';
    if (selectedPDate === today) tag = '今天';
    else if (periodSet.has(selectedPDate)) tag = '经期';
    else if (predictSet.has(selectedPDate)) tag = '预测经期';
    else if (ovulationSet.has(selectedPDate)) tag = '排卵日';
    else if (fertileSet.has(selectedPDate)) tag = '易孕期';
    $('#pDayTag').textContent = tag;
    $('#pDayTag').style.display = tag ? 'inline-block' : 'none';
  }
  function renderPeriodCalendar(periodSet, predictSet, fertileSet, ovulationSet, today) {
    const y = +periodMonth.slice(0, 4), m = +periodMonth.slice(5, 7);
    const first = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    const dim = new Date(y, m, 0).getDate();
    const wnames = ['一', '二', '三', '四', '五', '六', '日'];
    const cells = [wnames.map(w => `<div class="pc-w">${w}</div>`).join('')];
    for (let i = 0; i < first; i++) cells.push('<div class="pc-cell empty"></div>');
    for (let d = 1; d <= dim; d++) {
      const date = `${periodMonth}-${String(d).padStart(2, '0')}`;
      const log = periodLogs[date];
      let cls = 'pc-cell';
      const userPeriod = log && log.period === true;
      const userNotPeriod = log && log.period === false;
      const inPeriod = (userPeriod || periodSet.has(date)) && !userNotPeriod;
      const inPredict = predictSet.has(date) && !inPeriod;
      const inFertile = fertileSet.has(date);
      const isOvulation = ovulationSet.has(date);
      if (inPeriod) cls += ' period';
      else if (inPredict) cls += ' predict';
      else if (isOvulation) cls += ' ovulation';
      else if (inFertile) cls += ' fertile-text';
      if (date === today) cls += ' today';
      if (date === selectedPDate) cls += ' selected';
      const hasRecord = log && (log.period || log.flow || log.pain || log.mood || log.note || log.color || log.time);
      if (hasRecord) cls += ' has';
      let tag = '';
      if (isOvulation) tag = '💧';
      else if (log && log.period) tag = (log.flow === 'heavy' || !log.flow || log.flow === 'normal') ? '🔴' : (log.flow === 'light' ? '🟡' : '🔹');
      else if (log && (log.pain || log.mood)) tag = '•';
      cells.push(`<div class="${cls}" data-date="${date}"><span class="pc-d">${d}</span>${tag ? `<span class="pc-dot">${tag}</span>` : ''}</div>`);
    }
    $('#periodGrid').innerHTML = cells.join('');
    $('#periodGrid').querySelectorAll('.pc-cell[data-date]').forEach(el => {
      el.addEventListener('click', () => selectPeriodDay(el.dataset.date));
    });
  }
  function selectPeriodDay(date) {
    selectedPDate = date;
    renderPeriodCalendar(...lastCalendarArgs());
    renderPeriodPanel(date);
  }
  function lastCalendarArgs() {
    const { periodSet, predictSet, fertileSet, ovulationSet } = predict();
    return [periodSet, predictSet, fertileSet, ovulationSet, todayStr()];
  }
  function renderPeriodPanel(date) {
    const log = periodLogs[date] || { date, period: false, flow: '', pain: 0, mood: '', note: '', color: '', time: '' };
    $('#pDayTitle').textContent = date;
    const btn = $('#pDayPeriodYes');
    btn.textContent = log.period ? '🩸 已标记为经期（点击取消）' : '🩸 月经来了';
    btn.classList.toggle('on', !!log.period);
    $('#pFlow').value = log.flow || '';
    $('#pColor').value = log.color || '';
    $('#pPain').value = log.pain || 0;
    $('#pMood').value = log.mood || '';
    $('#pTime').value = log.time || '';
    $('#pNote').value = log.note || '';
    const isPeriod = !!log.period;
    $('#periodOnlyGroup').style.display = isPeriod ? 'block' : 'none';
  }
  function togglePeriodDay() {
    const date = selectedPDate;
    const log = periodLogs[date] || { date, period: false, flow: '', pain: 0, mood: '', note: '', color: '', time: '' };
    const nextPeriod = !log.period;
    if (!nextPeriod && !log.flow && !log.pain && !log.mood && !log.note && !log.color && !log.time) {
      delPeriodLog(date).then(() => renderPeriod());
    } else {
      savePeriodLog(date, { period: nextPeriod }).then(() => renderPeriod());
    }
  }
  function autoSavePeriodField() {
    const date = selectedPDate;
    const log = periodLogs[date] || { date, period: false, flow: '', pain: 0, mood: '', note: '', color: '', time: '' };
    const period = log.period;
    const flow = period ? $('#pFlow').value : '';
    const color = period ? $('#pColor').value : '';
    const pain = +$('#pPain').value;
    const mood = $('#pMood').value;
    const time = $('#pTime').value;
    const note = $('#pNote').value.trim();
    if (!period && !flow && !pain && !mood && !note && !color && !time) {
      delPeriodLog(date).then(() => renderPeriod());
    } else {
      savePeriodLog(date, { period, flow, color, pain, mood, time, note }).then(() => renderPeriod());
    }
  }

  // ---------- init ----------
  async function load() {
    records = await getAll();
    try { await loadPeriodLogs(); } catch (e) {}
    renderHome();
    renderDetail();
    if ($('#viewStats').classList.contains('active')) renderStats();
  }

  function bind() {
    document.querySelectorAll('.tabbar .tab').forEach(t => t.addEventListener('click', () => switchView(t.dataset.view)));
    $('#addBtn').addEventListener('click', () => openSheet());
    $('#closeSheet').addEventListener('click', closeSheet);
    $('#sheetMask').addEventListener('click', (e) => { if (e.target.id === 'sheetMask') closeSheet(); });
    $('#saveBtn').addEventListener('click', save);
    $('#saveTopBtn').addEventListener('click', save);
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
    // 经期模块
    $('#periodEntry').addEventListener('click', () => { selectedPDate = todayStr(); switchView('period'); });
    $('#periodBack').addEventListener('click', () => switchView('mine'));
    $('#prevPMonth').addEventListener('click', () => { periodMonth = prevMonth(periodMonth); renderPeriod(); });
    $('#nextPMonth').addEventListener('click', () => { periodMonth = nextMonth(periodMonth); renderPeriod(); });
    $('#pCycle').addEventListener('change', (e) => { settings.period.cycle = Math.min(45, Math.max(21, +e.target.value || 28)); saveSettings(); renderPeriod(); });
    $('#pDur').addEventListener('change', (e) => { settings.period.duration = Math.min(15, Math.max(2, +e.target.value || 5)); saveSettings(); renderPeriod(); });
    $('#pDayPeriodYes').addEventListener('click', togglePeriodDay);
    document.querySelectorAll('#periodPanel .p-auto-save').forEach(el => {
      el.addEventListener('change', autoSavePeriodField);
    });
    $('#pNote').addEventListener('blur', autoSavePeriodField);
  }

  function prevMonth(m) {
    const [y, mo] = m.split('-').map(Number);
    let ny = y, nmo = mo - 1;
    if (nmo < 1) { nmo = 12; ny--; }
    return `${ny}-${String(nmo).padStart(2, '0')}`;
  }
  function nextMonth(m) {
    const [y, mo] = m.split('-').map(Number);
    let ny = y, nmo = mo + 1;
    if (nmo > 12) { nmo = 1; ny++; }
    return `${ny}-${String(nmo).padStart(2, '0')}`;
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
