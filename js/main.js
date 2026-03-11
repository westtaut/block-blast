// ─── BLOCK BLAST — MAIN CONTROLLER ──────────────────────────────────────────
'use strict';

let engine       = null;
let renderer     = null;
let currentTheme = 'dark';
let currentMode  = 'classic';
let currentLevel = null;
let animId       = null;
let timerInt     = null;
let timeLeft     = 0;
let isPaused     = false;

// ── Drag State ────────────────────────────────────────────────────────────────
const drag = {
  active:   false,
  idx:      null,
  piece:    null,
  snapCol:  null,
  snapRow:  null,
  valid:    false,
  px:       0,
  py:       0,
  lastSnap: null,       // for haptic on snap change
};

// ── DOM ───────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const SCREENS = [
  'screen-menu','screen-modes','screen-story','screen-game',
  'screen-gameover','screen-themes','screen-stats',
  'screen-achievements','screen-settings',
];

function showScreen(id) {
  SCREENS.forEach(s => {
    const el = $(s);
    if (!el) return;
    el.classList.toggle('active', s === id);
    el.classList.toggle('hidden', s !== id);
  });
  TG.hideMainButton();
}

// ── Haptic helper (respects settings) ─────────────────────────────────────────
function haptic(type) {
  const d = Storage.get();
  if (d.settings?.haptic === false) return;
  TG.haptic(type);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
async function init() {
  TG.init();
  await Storage.load();
  SoundEngine.init();

  const d = Storage.get();
  currentTheme = d.selectedTheme || 'dark';
  applyTheme(currentTheme);

  SoundEngine.musicEnabled = d.settings?.music !== false;
  SoundEngine.sfxEnabled   = d.settings?.sfx   !== false;
  if (d.settings?.musicVol !== undefined) SoundEngine.setMusicVolume(d.settings.musicVol / 100);
  if (d.settings?.sfxVol   !== undefined) SoundEngine.setSfxVolume(d.settings.sfxVol / 100);

  buildMenuUI();
  showScreen('screen-menu');
  setupListeners();

  // Start music on first interaction
  document.addEventListener('pointerdown', () => {
    SoundEngine.resume();
    if (SoundEngine.musicEnabled && !SoundEngine.musicPlaying) SoundEngine.startMusic();
  }, { once: true });
}

// ── MENU ──────────────────────────────────────────────────────────────────────
function buildMenuUI() {
  const d    = Storage.get();
  const name = TG.getFirstName();
  setEl('menu-username',   name);
  setEl('menu-avatar-char', name.charAt(0).toUpperCase());
  setEl('menu-coins',      d.coins || 0);
  setEl('menu-best',       (d.bestScore || 0).toLocaleString());
  setEl('menu-story-stat', `${d.storyProgress || 0}/20`);
  setEl('menu-games',      d.gamesPlayed || 0);
}

function setEl(id, val) {
  const el = $(id);
  if (el) el.textContent = val;
}

// ── START GAME ────────────────────────────────────────────────────────────────
function startGame(mode, level = null) {
  currentMode  = mode;
  currentLevel = level;
  isPaused     = false;

  const gridSize = level?.grid || (mode === 'hard' ? 10 : 8);

  engine = new GameEngine({
    gridSize, mode, level,
    onScore:     handleScore,
    onGameOver:  handleGameOver,
    onLineClear: handleLineClear,
    onLevelWin:  handleLevelWin,
  });

  const canvas = $('game-canvas');
  if (!canvas) return;

  if (!renderer) {
    renderer = new Renderer(canvas, { theme: currentTheme, gridSize });
  } else {
    renderer.gridSize = gridSize;
    renderer.theme    = currentTheme;
    renderer.resize();
  }

  renderer.gridSize   = gridSize;
  renderer.theme      = currentTheme;
  renderer.particles  = [];
  renderer.rings      = [];
  renderer.flashes    = [];
  renderer.shockwaves = [];
  renderer.floatTexts = [];
  renderer.blockScale = Array.from({length:gridSize}, ()=>Array(gridSize).fill(1));
  renderer.blockAlpha = Array.from({length:gridSize}, ()=>Array(gridSize).fill(1));
  renderer.hideDragFloat();

  updateGameUI();
  renderTray();
  showScreen('screen-game');

  const undoBtn = $('btn-undo');
  if (undoBtn) undoBtn.disabled = false;

  // Timer
  clearInterval(timerInt);
  const hasTimed = mode === 'timed' || level?.objective?.type?.includes('timed');
  const timerEl  = $('timer-display');
  if (hasTimed) {
    timeLeft = level?.objective?.time || 180;
    updateTimer();
    if (timerEl) timerEl.style.display = 'block';
    timerInt = setInterval(() => {
      if (!isPaused && !engine.gameOver && !engine.won) {
        timeLeft--;
        updateTimer();
        if (timeLeft <= 0) { clearInterval(timerInt); handleGameOver(engine.score); }
      }
    }, 1000);
  } else {
    if (timerEl) timerEl.style.display = 'none';
  }

  if (level) showLevelBanner(level);

  // Forest ambient background
  stopForestBg();
  if (THEMES[currentTheme]?.forestBg) startForestBg();

  if (animId) cancelAnimationFrame(animId);
  loop();

  if (SoundEngine.musicEnabled && !SoundEngine.musicPlaying) SoundEngine.startMusic();
}

function loop() {
  if (!engine || !renderer) return;
  renderer.draw(engine, drag.active ? drag : null);
  animId = requestAnimationFrame(loop);
}

// ── FOREST AMBIENT BACKGROUND ─────────────────────────────────────────────────
let _forestCanvas = null;
function drawForestBg() {
  const screen = document.getElementById('screen-game');
  if (!screen) return;

  if (!_forestCanvas) {
    _forestCanvas = document.createElement('canvas');
    _forestCanvas.style.cssText = `
      position:absolute;inset:0;width:100%;height:100%;
      pointer-events:none;z-index:0;opacity:0.55;
    `;
    screen.insertBefore(_forestCanvas, screen.firstChild);
  }

  const w = screen.offsetWidth, h = screen.offsetHeight;
  _forestCanvas.width  = w;
  _forestCanvas.height = h;
  const ctx = _forestCanvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // Gradient sky-to-ground
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0,   '#0e2010');
  sky.addColorStop(0.5, '#111a12');
  sky.addColorStop(1,   '#0a1209');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Draw simple tree silhouettes
  const drawTree = (x, baseY, trunkH, trunkW, layers, layerColor) => {
    // Trunk
    ctx.fillStyle = '#2d1b0e55';
    ctx.fillRect(x - trunkW/2, baseY - trunkH, trunkW, trunkH);
    // Layered triangles (pine tree)
    for (let i = 0; i < layers; i++) {
      const ly = baseY - trunkH - i * (trunkH * 0.3);
      const lw = trunkW * (4 - i * 0.5);
      const lh = trunkH * 0.55;
      ctx.fillStyle = layerColor;
      ctx.globalAlpha = 0.18 + i * 0.04;
      ctx.beginPath();
      ctx.moveTo(x, ly - lh);
      ctx.lineTo(x - lw, ly);
      ctx.lineTo(x + lw, ly);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  // Far trees (lighter, smaller)
  const farColor = '#1e3d1e';
  [0.08, 0.22, 0.38, 0.62, 0.75, 0.88, 0.95].forEach((fx, i) => {
    drawTree(fx * w, h * 0.72, h * 0.18, 6, 4, farColor);
  });

  // Near trees (darker, taller)
  const nearColor = '#152d15';
  [-0.04, 0.12, 0.5, 0.88, 1.04].forEach((fx) => {
    drawTree(fx * w, h, h * 0.38, 10, 5, nearColor);
  });

  // Fireflies / bokeh lights
  const now = Date.now();
  ctx.save();
  for (let i = 0; i < 18; i++) {
    const fx = (Math.sin(i * 73.1 + now * 0.0004 + i) * 0.5 + 0.5) * w;
    const fy = (Math.cos(i * 51.7 + now * 0.0003) * 0.3 + 0.45) * h;
    const fa = 0.15 + 0.35 * Math.abs(Math.sin(now * 0.001 * (i * 0.3 + 0.7) + i * 2.1));
    const fr = 1.5 + Math.sin(i) * 0.8;
    const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr * 4);
    grad.addColorStop(0, `rgba(180,255,150,${fa})`);
    grad.addColorStop(1, 'rgba(180,255,150,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(fx, fy, fr * 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Moon glow in top-right
  const mx = w * 0.8, my = h * 0.08;
  const moonGrad = ctx.createRadialGradient(mx, my, 0, mx, my, h * 0.18);
  moonGrad.addColorStop(0,   'rgba(200,235,180,0.12)');
  moonGrad.addColorStop(0.5, 'rgba(150,200,130,0.06)');
  moonGrad.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = moonGrad;
  ctx.fillRect(0, 0, w, h);
}

let _forestBgAnimId = null;
function startForestBg() {
  const animate = () => {
    drawForestBg();
    _forestBgAnimId = requestAnimationFrame(animate);
  };
  animate();
}
function stopForestBg() {
  cancelAnimationFrame(_forestBgAnimId);
  if (_forestCanvas) { _forestCanvas.remove(); _forestCanvas = null; }
}

// ── SCORE / EVENTS ────────────────────────────────────────────────────────────
function handleScore(total, gained, cleared) {
  const el = $('score-val');
  if (el) {
    el.textContent = total;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  if (gained > 0 && renderer) {
    const canvas = $('game-canvas');
    if (canvas) {
      const label = gained > 0 ? '+' + gained + (engine.combo > 1 ? ` ×${engine.combo}` : '') : '';
      renderer.addFloatText(label, canvas.width / 2, canvas.height * 0.35,
        THEMES[currentTheme]?.accent || '#5b7cfa', 22);
    }
  }

  if (engine.combo > 1) {
    const cf = $('combo-flash');
    if (cf) {
      cf.textContent = `×${engine.combo} COMBO`;
      cf.classList.remove('show');
      void cf.offsetWidth;
      cf.classList.add('show');
      clearTimeout(cf._t);
      cf._t = setTimeout(() => cf.classList.remove('show'), 1300);
    }
    SoundEngine.combo(engine.combo);
    haptic('medium');
  }

  renderTray();
  updateObjProgress();
  checkAchievements(engine, Storage).then(arr => arr.forEach(showAchToast));
}

function handleLineClear({ rows, cols, snapshot }) {
  // snapshot is captured in gameEngine._clearLines BEFORE grid is zeroed
  renderer.triggerLineClear(rows, cols, snapshot);

  const total = rows.length + cols.length;
  haptic(total >= 3 ? 'heavy' : 'medium');
  SoundEngine.lineClear(total);
}

function handleGameOver(score) {
  clearInterval(timerInt);
  cancelAnimationFrame(animId);
  renderer.hideDragFloat();
  haptic('error');
  SoundEngine.gameOver();
  SoundEngine.stopMusic();

  Storage.addScore(score, currentMode);
  Storage.updateStats({
    linesCleared:  engine.linesCleared,
    piecesPlaced:  engine.piecesPlaced,
    maxCombo:      engine.maxCombo,
    perfectClears: engine.perfectClears,
  });

  const d = Storage.get();
  setEl('go-score',  score);
  setEl('go-best',   d.bestScore);
  setEl('go-lines',  engine.linesCleared);
  setEl('go-combos', engine.maxCombo);
  setEl('go-pieces', engine.piecesPlaced);
  setEl('go-mode',   modeLabel(currentMode));

  const nb = $('go-new-best');
  if (nb) nb.style.display = (score >= d.bestScore && score > 0) ? 'flex' : 'none';

  setTimeout(() => showScreen('screen-gameover'), 350);
}

async function handleLevelWin(level, score) {
  clearInterval(timerInt);
  cancelAnimationFrame(animId);
  renderer.hideDragFloat();
  haptic('success');
  SoundEngine.levelWin();
  SoundEngine.stopMusic();
  const stars = await Storage.completeLevel(level.id, score);
  await Storage.addScore(score, 'story');
  showWinScreen(level, score, stars);
}

// ── TRAY ──────────────────────────────────────────────────────────────────────
function renderTray() {
  if (!engine || !renderer) return;
  for (let i = 0; i < 3; i++) {
    const canvas = $(`pc-${i}`);
    const slot   = $(`ps-${i}`);
    if (!canvas || !slot) continue;
    const piece = engine.pieces[i];
    slot.classList.toggle('used', !piece);
    if (piece) renderer.drawPiecePreview(canvas, piece, currentTheme);
    else canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ── DRAG & DROP ───────────────────────────────────────────────────────────────
function setupDrag() {
  for (let i = 0; i < 3; i++) {
    const slot = $(`ps-${i}`);
    if (slot) slot.addEventListener('pointerdown', e => startDrag(e, i), { passive: false });
  }
  window.addEventListener('pointermove',   onDragMove,   { passive: true });
  window.addEventListener('pointerup',     onDragEnd);
  window.addEventListener('pointercancel', cancelDrag);
}

function startDrag(e, idx) {
  e.preventDefault();
  const piece = engine?.pieces[idx];
  if (!piece) return;

  drag.active   = true;
  drag.idx      = idx;
  drag.piece    = piece;
  drag.snapCol  = null;
  drag.snapRow  = null;
  drag.valid    = false;
  drag.lastSnap = null;

  const pt = e.touches?.[0] || e;
  drag.px = pt.clientX;
  drag.py = pt.clientY;

  // Show floating piece element above finger
  renderer.showDragFloat(piece, drag.px, drag.py, currentTheme);

  $(`ps-${idx}`)?.classList.add('dragging');
  haptic('light');
  SoundEngine.snap();

  updateSnapPosition();
}

function onDragMove(e) {
  if (!drag.active) return;
  const pt = e.touches?.[0] || e;
  drag.px = pt.clientX;
  drag.py = pt.clientY;

  // Move floating element
  renderer.moveDragFloat(drag.px, drag.py);

  updateSnapPosition();
}

function updateSnapPosition() {
  const canvas = $('game-canvas');
  if (!canvas || !renderer || !drag.piece) return;

  const rect = canvas.getBoundingClientRect();
  const cs   = renderer.cellSize;
  const gs   = renderer.gridSize;

  // Map pointer to canvas space
  // Offset: look slightly above the finger (1.8 cells) so the piece is visible
  const lx = drag.px - rect.left;
  const ly = drag.py - rect.top - cs * 1.6;

  // Raw cell under hotspot (top-left of piece bounding box)
  const rawCol = Math.floor(lx / cs);
  const rawRow = Math.floor(ly / cs);

  // Magnetic snap search: check a 3×3 radius around raw position
  let bestCol  = null, bestRow = null;
  let bestDist = Infinity;

  const pw = getPieceWidth(drag.piece);
  const ph = getPieceHeight(drag.piece);

  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const col = rawCol + dc;
      const row = rawRow + dr;
      if (engine.canPlace(drag.piece, col, row)) {
        // Score: distance from pointer to center of piece bounding box
        const cx   = (col + pw / 2) * cs;
        const cy   = (row + ph / 2) * cs;
        const dist = Math.hypot(lx - cx, ly - cy);
        if (dist < bestDist) {
          bestDist = dist;
          bestCol  = col;
          bestRow  = row;
        }
      }
    }
  }

  if (bestCol !== null) {
    drag.snapCol = bestCol;
    drag.snapRow = bestRow;
    drag.valid   = true;

    // Haptic tick when snapping to a NEW valid cell
    const snapKey = `${bestCol},${bestRow}`;
    if (drag.lastSnap !== snapKey) {
      drag.lastSnap = snapKey;
      haptic('light');
    }
  } else {
    // Show piece at raw position (red/invalid)
    drag.snapCol = rawCol;
    drag.snapRow = rawRow;
    drag.valid   = false;
    drag.lastSnap = null;
  }
}

function onDragEnd() {
  if (!drag.active) return;

  const placed = drag.valid && drag.snapCol !== null && drag.snapRow !== null
    ? engine.placePiece(drag.idx, drag.snapCol, drag.snapRow)
    : false;

  renderer.hideDragFloat();

  if (placed) {
    renderer.animatePlacement(drag.piece, drag.snapCol, drag.snapRow);
    haptic('light');
    SoundEngine.place();
  } else {
    // Snap back animation with CSS class
    const slot = $(`ps-${drag.idx}`);
    if (slot) {
      slot.classList.remove('snap-back');
      void slot.offsetWidth; // reflow
      slot.classList.add('snap-back');
      setTimeout(() => slot.classList.remove('snap-back'), 250);
    }
    haptic('warning');
    SoundEngine.error();
  }

  $(`ps-${drag.idx}`)?.classList.remove('dragging');
  drag.active   = false;
  drag.piece    = null;
  drag.idx      = null;
  drag.snapCol  = null;
  drag.snapRow  = null;
  drag.valid    = false;
  drag.lastSnap = null;

  renderTray();
}

function cancelDrag() {
  renderer?.hideDragFloat();
  $(`ps-${drag.idx}`)?.classList.remove('dragging');
  drag.active = false;
  drag.piece  = null;
}

// ── TIMER ─────────────────────────────────────────────────────────────────────
function updateTimer() {
  const el = $('timer-display');
  if (!el) return;
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  el.classList.toggle('urgent', timeLeft <= 30);
}

function updateGameUI() {
  if (!engine) return;
  setEl('score-val', engine.score);
  setEl('best-val',  Storage.get().bestScore);
  updateObjProgress();
}

function updateObjProgress() {
  const bar = $('objective-bar');
  if (!bar || !currentLevel) { if (bar) bar.style.display = 'none'; return; }
  bar.style.display = 'block';
  const obj = currentLevel.objective;
  setEl('obj-label', obj.label);

  let pct = 0;
  switch (obj.type) {
    case 'score': case 'score_timed': pct = engine.score         / obj.target; break;
    case 'lines': case 'lines_timed': pct = engine.linesCleared  / obj.target; break;
    case 'columns':  pct = engine.columnsCleared / obj.target; break;
    case 'combo':    pct = engine.maxCombo        / obj.target; break;
    case 'pieces':   pct = engine.piecesPlaced    / obj.target; break;
  }

  const fill = $('obj-fill');
  if (fill) fill.style.width = Math.min(100, pct * 100) + '%';
}

// ── LEVEL BANNER ──────────────────────────────────────────────────────────────
function showLevelBanner(lv) {
  const b = $('level-banner');
  if (!b) return;
  setEl('banner-level', `Level ${lv.id}`);
  setEl('banner-title', lv.title);
  setEl('banner-story', lv.story);
  setEl('banner-obj',   `🎯 ${lv.objective.label}`);
  b.classList.add('show');
  setTimeout(() => b.classList.remove('show'), 3500);
}

// ── WIN SCREEN ────────────────────────────────────────────────────────────────
function showWinScreen(lv, score, stars) {
  const win = $('level-win');
  if (!win) { handleGameOver(score); return; }
  setEl('win-name',   lv.title);
  setEl('win-score',  score);
  setEl('win-reward', `+${lv.reward}🪙`);
  win.querySelectorAll('.win-star').forEach((s, i) => s.classList.toggle('lit', i < stars));
  win.classList.add('show');
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function buildSettingsScreen() {
  const d = Storage.get();
  const s = d.settings || {};

  const musicT = $('toggle-music');
  if (musicT) {
    musicT.checked = s.music !== false;
    musicT.onchange = async () => {
      SoundEngine.musicEnabled = musicT.checked;
      musicT.checked ? SoundEngine.startMusic() : SoundEngine.stopMusic();
      await saveSettings({ music: musicT.checked });
    };
  }

  const sfxT = $('toggle-sfx');
  if (sfxT) {
    sfxT.checked = s.sfx !== false;
    sfxT.onchange = async () => {
      SoundEngine.sfxEnabled = sfxT.checked;
      await saveSettings({ sfx: sfxT.checked });
    };
  }

  const hapticT = $('toggle-haptic');
  if (hapticT) {
    hapticT.checked = s.haptic !== false;
    hapticT.onchange = async () => await saveSettings({ haptic: hapticT.checked });
  }

  const musicVol = $('slider-music-vol');
  if (musicVol) {
    musicVol.value = s.musicVol ?? 55;
    musicVol.oninput = () => {
      SoundEngine.setMusicVolume(musicVol.value / 100);
      saveSettings({ musicVol: +musicVol.value });
    };
  }

  const sfxVol = $('slider-sfx-vol');
  if (sfxVol) {
    sfxVol.value = s.sfxVol ?? 55;
    sfxVol.oninput = () => {
      SoundEngine.setSfxVolume(sfxVol.value / 100);
      saveSettings({ sfxVol: +sfxVol.value });
    };
  }

  const usr = $('settings-user');
  if (usr) usr.textContent = TG.getUsername() || TG.getFirstName() || 'Guest';
}

async function saveSettings(patch) {
  const d = Storage.get();
  d.settings = { ...(d.settings || {}), ...patch };
  await Storage.save();
}

// ── STORY SCREEN ──────────────────────────────────────────────────────────────
function buildStoryScreen() {
  const grid = $('story-grid');
  if (!grid) return;
  const d = Storage.get();
  grid.innerHTML = '';

  STORY_LEVELS.forEach(lv => {
    const prog     = d.storyProgress || 0;
    const unlocked = lv.id === 1 || lv.id <= prog + 1;
    const stars    = d.storyStars?.[lv.id] || 0;
    const isCur    = lv.id === prog + 1;

    const div = document.createElement('div');
    div.className = `lv-card ${!unlocked ? 'lv-locked' : ''} ${stars === 3 ? 'lv-3star' : ''} ${isCur ? 'lv-current' : ''}`;
    div.innerHTML = `
      <div class="lv-num">${lv.id}</div>
      <div class="lv-name">${lv.title}</div>
      <div class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</div>
      ${!unlocked ? '<div class="lv-lock">🔒</div>' : ''}
    `;
    if (unlocked) {
      div.addEventListener('click', () => { haptic('light'); SoundEngine.button(); startGame('story', lv); });
    }
    grid.appendChild(div);
  });

  const fill = $('story-fill');
  if (fill) fill.style.width = (((d.storyProgress || 0) / 20) * 100) + '%';
  setEl('story-count', `${d.storyProgress || 0}/20`);
}

// ── THEMES SCREEN ─────────────────────────────────────────────────────────────
function buildThemesScreen() {
  const grid = $('themes-grid');
  if (!grid) return;
  const d = Storage.get();
  grid.innerHTML = '';

  Object.entries(THEMES).forEach(([key, t]) => {
    const owned = !t.locked || d.achievements?.['theme_' + key];
    const card  = document.createElement('div');
    card.className = `theme-card ${key === currentTheme ? 'active' : ''}`;
    card.style.cssText = `background:${t.bg};border-color:${key === currentTheme ? t.accent : (t.border || 'rgba(255,255,255,0.07)')}`;

    card.innerHTML = `
      <div class="theme-swatch">${t.blocks.slice(0,4).map(c => `<div class="tsw-cell" style="background:${c}"></div>`).join('')}</div>
      <div class="theme-label">
        <span class="theme-emoji">${t.emoji}</span>
        <span class="theme-name" style="color:${t.text}">${t.name}</span>
      </div>
      ${!owned ? `<div class="theme-price">🪙 ${t.price}</div>` : ''}
      ${key === currentTheme ? '<div class="theme-chk">✓</div>' : ''}
    `;

    card.addEventListener('click', async () => {
      SoundEngine.button(); haptic('light');
      if (!owned) {
        const ok = await Storage.spendCoins(t.price || 50);
        if (!ok) { haptic('error'); showToast('Not enough coins 🪙'); return; }
        d.achievements = d.achievements || {};
        d.achievements['theme_' + key] = Date.now();
        await Storage.save();
        haptic('success');
      }
      currentTheme = key;
      applyTheme(key);
      await Storage.setTheme(key);
      if (renderer) renderer.theme = key;
      buildThemesScreen(); buildMenuUI();
    });
    grid.appendChild(card);
  });
}

// ── STATS SCREEN ──────────────────────────────────────────────────────────────
function buildStatsScreen() {
  const d = Storage.get(), st = d.stats || {};
  const el = $('stats-content');
  if (!el) return;

  const rows = [
    ['🏆', 'Best Score',     (d.bestScore   || 0).toLocaleString()],
    ['📊', 'Total Score',    (d.totalScore  || 0).toLocaleString()],
    ['🎮', 'Games Played',   (d.gamesPlayed || 0).toLocaleString()],
    ['➖', 'Lines Cleared',  (st.linesCleared || 0).toLocaleString()],
    ['🧩', 'Pieces Placed',  (st.piecesPlaced || 0).toLocaleString()],
    ['⚡', 'Max Combo',      st.maxCombo || 0],
    ['✨', 'Perfect Clears', st.perfectClears || 0],
    ['🪙', 'Coins',          (d.coins || 0).toLocaleString()],
    ['📖', 'Story Levels',   `${d.storyProgress || 0}/20`],
  ];

  el.innerHTML = `<div class="stats-group">${rows.map(([ico, name, val]) =>
    `<div class="stat-row"><div class="stat-ico">${ico}</div><div class="stat-info"><div class="stat-name">${name}</div></div><div class="stat-val">${val}</div></div>`
  ).join('')}</div>`;
}

// ── ACHIEVEMENTS SCREEN ───────────────────────────────────────────────────────
function buildAchievementsScreen() {
  const d  = Storage.get();
  const el = $('ach-content');
  if (!el) return;
  el.innerHTML = `<div class="ach-list">${Object.values(ACHIEVEMENTS).map(a => {
    const done = !!d.achievements?.[a.id];
    return `<div class="ach-card ${done ? 'done' : ''}">
      <div class="ach-ico">${done ? '🏆' : '🔒'}</div>
      <div class="ach-body"><div class="ach-name">${a.label}</div><div class="ach-desc">${a.desc}</div></div>
      ${done ? '<div class="ach-done">✓</div>' : `<div class="ach-badge">+${a.coins}🪙</div>`}
    </div>`;
  }).join('')}</div>`;
}

// ── ACHIEVEMENT TOAST ──────────────────────────────────────────────────────────
function showAchToast(a) {
  SoundEngine.achievement(); haptic('success');
  const el = document.createElement('div');
  el.className = 'ach-toast';
  el.innerHTML = `<div class="ach-t-ico">🏆</div><div class="ach-t-body"><div class="ach-t-name">${a.label}</div><div class="ach-t-desc">${a.desc}</div></div><div class="ach-t-coins">+${a.coins}🪙</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 2800);
}

// ── TOAST ──────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 350); }, 2000);
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function modeLabel(m) {
  return { classic:'Classic', timed:'Timed', challenge:'Challenge', zen:'Zen', hard:'Hard', story:'Story' }[m] || m;
}

function togglePause() {
  if (!engine || engine.gameOver) return;
  isPaused = !isPaused;
  if (isPaused) {
    cancelAnimationFrame(animId);
    $('pause-overlay')?.classList.add('show');
    SoundEngine.stopMusic();
    haptic('light');
  } else {
    $('pause-overlay')?.classList.remove('show');
    loop();
    if (SoundEngine.musicEnabled) SoundEngine.startMusic();
  }
}

async function doUndo() {
  if (!engine) return;
  if (engine.usedUndo) { showToast('Undo already used'); return; }
  engine.undo();
  renderTray(); updateGameUI();
  haptic('light'); SoundEngine.button();
  const b = $('btn-undo');
  if (b) b.disabled = true;
}

async function doShuffle() {
  if (!engine) return;
  const ok = await Storage.spendCoins(5);
  if (!ok) { showToast('Need 5 🪙 to shuffle'); haptic('error'); return; }
  engine.shuffle();
  renderTray();
  haptic('medium'); SoundEngine.button();
  buildMenuUI();
}

// ── LISTENERS ─────────────────────────────────────────────────────────────────
function btn(id, fn) {
  $(id)?.addEventListener('click', () => { SoundEngine.button(); haptic('light'); fn(); });
}

function setupListeners() {
  btn('btn-play',         () => startGame('classic'));
  btn('btn-modes',        () => showScreen('screen-modes'));
  btn('btn-story',        () => { buildStoryScreen(); showScreen('screen-story'); });
  btn('btn-themes',       () => { buildThemesScreen(); showScreen('screen-themes'); });
  btn('btn-stats',        () => { buildStatsScreen(); showScreen('screen-stats'); });
  btn('btn-achievements', () => { buildAchievementsScreen(); showScreen('screen-achievements'); });
  btn('btn-settings',     () => { buildSettingsScreen(); showScreen('screen-settings'); });

  // Mode cards
  document.querySelectorAll('[data-mode]').forEach(el => {
    el.addEventListener('click', () => { SoundEngine.button(); haptic('light'); startGame(el.dataset.mode); });
  });

  // Random story buttons
  $('btn-rand-easy')?.addEventListener('click', () => startGame('story', generateRandomLevel(Math.floor(Math.random()*8)+1)));
  $('btn-rand-hard')?.addEventListener('click', () => startGame('story', generateRandomLevel(Math.floor(Math.random()*8)+11)));

  // Back buttons
  document.querySelectorAll('[data-back]').forEach(el => {
    el.addEventListener('click', () => { SoundEngine.button(); haptic('light'); showScreen(el.dataset.back); });
  });

  // Game controls
  $('btn-pause')?.addEventListener('click', togglePause);
  $('btn-undo')?.addEventListener('click', doUndo);
  $('btn-shuffle')?.addEventListener('click', doShuffle);

  // Pause overlay
  btn('btn-resume',     () => togglePause());
  btn('btn-pause-menu', () => { isPaused = false; $('pause-overlay')?.classList.remove('show'); SoundEngine.stopMusic(); buildMenuUI(); showScreen('screen-menu'); });

  // Game over
  btn('btn-play-again', () => startGame(currentMode, currentLevel));
  btn('btn-go-menu',    () => { buildMenuUI(); showScreen('screen-menu'); });
  btn('btn-share',      () => TG.shareScore(engine?.score || 0, modeLabel(currentMode)));

  // Level win
  btn('btn-next-level', () => {
    $('level-win')?.classList.remove('show');
    const next = STORY_LEVELS.find(l => l.id === (currentLevel?.id || 0) + 1);
    if (next) startGame('story', next);
    else { buildMenuUI(); showScreen('screen-menu'); }
  });
  btn('btn-retry',      () => { $('level-win')?.classList.remove('show'); startGame('story', currentLevel); });
  btn('btn-win-menu',   () => { $('level-win')?.classList.remove('show'); buildMenuUI(); showScreen('screen-menu'); });

  // Resize
  window.addEventListener('resize', () => renderer?.resize());

  // Drag
  setupDrag();
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
