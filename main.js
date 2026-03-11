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
  active:     false,
  idx:        null,
  piece:      null,
  snapCol:    null,   // current snapped grid column (top-left of piece)
  snapRow:    null,   // current snapped grid row
  valid:      false,  // is current snap position valid?
  pointerX:   0,
  pointerY:   0,
};

// ── DOM shortcuts ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const SCREENS = ['screen-menu','screen-modes','screen-story','screen-game',
                 'screen-gameover','screen-themes','screen-stats',
                 'screen-achievements','screen-settings'];

function showScreen(id) {
  SCREENS.forEach(s => {
    const el = $(s);
    if (!el) return;
    el.classList.toggle('active', s === id);
    el.classList.toggle('hidden', s !== id);
  });
  TG.hideMainButton();
}

// ── INIT ──────────────────────────────────────────────────────────────────────
async function init() {
  TG.init();
  await Storage.load();
  SoundEngine.init();

  currentTheme = Storage.get().selectedTheme || 'dark';
  applyTheme(currentTheme);

  // Apply saved sound settings
  const d = Storage.get();
  SoundEngine.musicEnabled = d.settings?.music !== false;
  SoundEngine.sfxEnabled   = d.settings?.sfx   !== false;

  buildMenuUI();
  showScreen('screen-menu');
  setupListeners();

  // Unlock music on first touch
  document.addEventListener('pointerdown', () => {
    SoundEngine.resume();
    if (SoundEngine.musicEnabled && !SoundEngine.musicPlaying) {
      SoundEngine.startMusic();
    }
  }, { once: true });
}

// ── MENU ──────────────────────────────────────────────────────────────────────
function buildMenuUI() {
  const d    = Storage.get();
  const name = TG.getFirstName();
  setEl('menu-username', name);
  setEl('menu-avatar-char', name.charAt(0).toUpperCase());
  setEl('menu-coins',   d.coins || 0);
  setEl('menu-best',    (d.bestScore || 0).toLocaleString());
  setEl('menu-story-stat', `${d.storyProgress || 0}/20`);
}

function setEl(id, val) {
  const el = $(id);
  if (el) el.textContent = val;
}

// ── START GAME ─────────────────────────────────────────────────────────────────
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
  renderer.clearAnim  = [];
  renderer.floatTexts = [];
  renderer.blockScale = Array.from({length:gridSize}, ()=>Array(gridSize).fill(1));
  renderer.blockAlpha = Array.from({length:gridSize}, ()=>Array(gridSize).fill(1));

  updateGameUI();
  renderTray();
  showScreen('screen-game');

  // Undo button reset
  const undoBtn = $('btn-undo');
  if (undoBtn) undoBtn.disabled = false;

  // Timer
  clearInterval(timerInt);
  const hasTimed = mode === 'timed' || level?.objective?.type?.includes('timed');
  if (hasTimed) {
    timeLeft = level?.objective?.time || 180;
    updateTimer();
    $('timer-display').style.display = 'block';
    timerInt = setInterval(() => {
      if (!isPaused && !engine.gameOver && !engine.won) {
        timeLeft--;
        updateTimer();
        if (timeLeft <= 0) {
          clearInterval(timerInt);
          handleGameOver(engine.score);
        }
      }
    }, 1000);
  } else {
    $('timer-display').style.display = 'none';
  }

  if (level) showLevelBanner(level);

  if (animId) cancelAnimationFrame(animId);
  loop();

  if (SoundEngine.musicEnabled) SoundEngine.startMusic();
}

function loop() {
  if (!engine || !renderer) return;
  renderer.draw(engine, drag.active ? drag : null);
  animId = requestAnimationFrame(loop);
}

// ── SCORE / EVENTS ─────────────────────────────────────────────────────────────
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
      renderer.addFloatText('+' + gained + (engine.combo > 1 ? ` ×${engine.combo}` : ''),
        canvas.width / 2, canvas.height * 0.38,
        THEMES[currentTheme]?.accent || '#5b7cfa', 20);
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
      cf._t = setTimeout(() => cf.classList.remove('show'), 1200);
    }
    SoundEngine.combo(engine.combo);
  }
  renderTray();
  updateObjProgress();
  checkAchievements(engine, Storage).then(arr => arr.forEach(showAchToast));
}

function handleLineClear({ rows, cols }) {
  renderer.triggerLineClear(rows, cols, currentTheme);
  TG.haptic(rows.length + cols.length >= 3 ? 'heavy' : 'medium');
  SoundEngine.lineClear(rows.length + cols.length);
}

function handleGameOver(score) {
  clearInterval(timerInt);
  cancelAnimationFrame(animId);
  TG.haptic('error');
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
  TG.haptic('success');
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
    else canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  }
}

// ── DRAG & DROP (MAGNETIC SNAP) ───────────────────────────────────────────────
function setupDrag() {
  for (let i = 0; i < 3; i++) {
    const slot = $(`ps-${i}`);
    if (!slot) continue;
    slot.addEventListener('pointerdown', e => startDrag(e, i), { passive: false });
  }

  document.addEventListener('pointermove', onDragMove, { passive: true });
  document.addEventListener('pointerup',   onDragEnd);
  document.addEventListener('pointercancel', cancelDrag);
}

function startDrag(e, idx) {
  e.preventDefault();
  const piece = engine?.pieces[idx];
  if (!piece) return;

  drag.active = true;
  drag.idx    = idx;
  drag.piece  = piece;
  drag.snapCol= null;
  drag.snapRow= null;
  drag.valid  = false;

  const pt = e.touches ? e.touches[0] : e;
  drag.pointerX = pt.clientX;
  drag.pointerY = pt.clientY;

  $(`ps-${idx}`)?.classList.add('dragging');
  TG.haptic('light');
  SoundEngine.snap();
}

function onDragMove(e) {
  if (!drag.active) return;
  const pt = e.touches ? e.touches[0] : e;
  drag.pointerX = pt.clientX;
  drag.pointerY = pt.clientY;
  updateSnapPosition();
}

function updateSnapPosition() {
  const canvas = $('game-canvas');
  if (!canvas || !renderer || !drag.piece) return;

  const rect = canvas.getBoundingClientRect();
  const cs   = renderer.cellSize;

  // Pointer offset: lift piece slightly above finger for visibility
  const lx = drag.pointerX - rect.left;
  const ly = drag.pointerY - rect.top - cs * 1.2; // lift 1.2 cells above touch point

  // Find grid cell under the hotspot (top-left of piece bounding box)
  const rawCol = Math.floor(lx / cs);
  const rawRow = Math.floor(ly / cs);

  // Magnetic snap: find nearest valid position within ±1 cell radius
  let bestCol = null, bestRow = null;
  let bestDist = Infinity;

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const col = rawCol + dc;
      const row = rawRow + dr;
      if (engine.canPlace(drag.piece, col, row)) {
        // Distance from ideal center
        const cx = (col + getPieceWidth(drag.piece)  / 2) * cs;
        const cy = (row + getPieceHeight(drag.piece) / 2) * cs;
        const dist = Math.hypot(lx - cx, ly - cy);
        if (dist < bestDist) {
          bestDist = dist;
          bestCol  = col;
          bestRow  = row;
        }
      }
    }
  }

  // If no valid snap found nearby, just show at raw position
  if (bestCol !== null) {
    drag.snapCol = bestCol;
    drag.snapRow = bestRow;
    drag.valid   = true;
  } else {
    drag.snapCol = rawCol;
    drag.snapRow = rawRow;
    drag.valid   = false;
  }
}

function onDragEnd() {
  if (!drag.active) return;

  const placed = drag.valid && drag.snapCol !== null && drag.snapRow !== null
    ? engine.placePiece(drag.idx, drag.snapCol, drag.snapRow)
    : false;

  if (placed) {
    renderer.animatePlacement(drag.piece, drag.snapCol, drag.snapRow);
    TG.haptic('light');
    SoundEngine.place();
  } else {
    TG.haptic('warning');
    SoundEngine.error();
  }

  $(`ps-${drag.idx}`)?.classList.remove('dragging');
  drag.active = false;
  drag.piece  = null;
  drag.idx    = null;
  drag.snapCol= null;
  drag.snapRow= null;
  drag.valid  = false;

  renderTray();
}

function cancelDrag() {
  $(`ps-${drag.idx}`)?.classList.remove('dragging');
  drag.active = false;
  drag.piece  = null;
}

// ── TIMER / OBJECTIVE ─────────────────────────────────────────────────────────
function updateTimer() {
  const el = $('timer-display');
  if (!el) return;
  const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
  el.textContent = `${m}:${s.toString().padStart(2,'0')}`;
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
  if (!bar || !currentLevel) { if(bar) bar.style.display='none'; return; }
  bar.style.display = 'block';
  const obj = currentLevel.objective;
  setEl('obj-label', obj.label);
  let pct = 0;
  switch (obj.type) {
    case 'score': case 'score_timed': pct = engine.score / obj.target; break;
    case 'lines': case 'lines_timed': pct = engine.linesCleared / obj.target; break;
    case 'columns': pct = engine.columnsCleared / obj.target; break;
    case 'combo':   pct = engine.maxCombo / obj.target; break;
    case 'pieces':  pct = engine.piecesPlaced / obj.target; break;
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
  win.querySelectorAll('.win-star').forEach((s, i) => {
    s.classList.toggle('lit', i < stars);
  });
  win.classList.add('show');
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function buildSettingsScreen() {
  const d = Storage.get();
  const settings = d.settings || {};

  // Music toggle
  const musicToggle = $('toggle-music');
  if (musicToggle) {
    musicToggle.checked = settings.music !== false;
    musicToggle.onchange = async () => {
      SoundEngine.musicEnabled = musicToggle.checked;
      if (musicToggle.checked) SoundEngine.startMusic();
      else SoundEngine.stopMusic();
      await saveSettings({ music: musicToggle.checked });
    };
  }

  // SFX toggle
  const sfxToggle = $('toggle-sfx');
  if (sfxToggle) {
    sfxToggle.checked = settings.sfx !== false;
    sfxToggle.onchange = async () => {
      SoundEngine.sfxEnabled = sfxToggle.checked;
      await saveSettings({ sfx: sfxToggle.checked });
    };
  }

  // Music volume
  const musicVol = $('slider-music-vol');
  if (musicVol) {
    musicVol.value = settings.musicVol !== undefined ? settings.musicVol : 70;
    musicVol.oninput = () => {
      SoundEngine.setMusicVolume(musicVol.value / 100);
      saveSettings({ musicVol: parseInt(musicVol.value) });
    };
  }

  // SFX volume
  const sfxVol = $('slider-sfx-vol');
  if (sfxVol) {
    sfxVol.value = settings.sfxVol !== undefined ? settings.sfxVol : 80;
    sfxVol.oninput = () => {
      SoundEngine.setSfxVolume(sfxVol.value / 100);
      saveSettings({ sfxVol: parseInt(sfxVol.value) });
    };
  }

  // Haptic toggle
  const hapticToggle = $('toggle-haptic');
  if (hapticToggle) {
    hapticToggle.checked = settings.haptic !== false;
    hapticToggle.onchange = async () => {
      await saveSettings({ haptic: hapticToggle.checked });
    };
  }
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
  const d   = Storage.get();
  grid.innerHTML = '';

  STORY_LEVELS.forEach(lv => {
    const unlocked = lv.id === 1 || lv.id <= (d.storyProgress || 0) + 1;
    const stars    = d.storyStars?.[lv.id] || 0;
    const isCur    = lv.id === (d.storyProgress || 0) + 1;

    const div = document.createElement('div');
    div.className = `lv-card ${unlocked ? '' : 'lv-locked'} ${stars===3?'lv-3star':''} ${isCur?'lv-current':''}`;
    div.innerHTML = `
      <div class="lv-num">${lv.id}</div>
      <div class="lv-name">${lv.title}</div>
      <div class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</div>
      ${!unlocked ? '<div class="lv-lock">🔒</div>' : ''}
    `;
    if (unlocked) div.addEventListener('click', () => { SoundEngine.button(); TG.haptic('light'); startGame('story', lv); });
    grid.appendChild(div);
  });

  // Progress bar
  const fill = $('story-fill');
  const pct  = ((d.storyProgress || 0) / 20) * 100;
  if (fill) fill.style.width = pct + '%';
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
    card.style.cssText = `background:${t.bg};border-color:${key===currentTheme?t.accent:t.border||'rgba(255,255,255,0.07)'}`;

    const swatches = t.blocks.slice(0,4).map(c =>
      `<div class="tsw-cell" style="background:${c}"></div>`).join('');

    card.innerHTML = `
      <div class="theme-swatch">${swatches}</div>
      <div class="theme-label">
        <span class="theme-emoji">${t.emoji}</span>
        <span class="theme-name" style="color:${t.text}">${t.name}</span>
      </div>
      ${!owned ? `<div class="theme-price">🪙 ${t.price}</div>` : ''}
      ${key === currentTheme ? '<div class="theme-chk">✓</div>' : ''}
    `;

    card.addEventListener('click', async () => {
      SoundEngine.button();
      if (!owned) {
        const ok = await Storage.spendCoins(t.price || 50);
        if (!ok) { TG.haptic('error'); showToast('Not enough coins 🪙'); return; }
        d.achievements = d.achievements || {};
        d.achievements['theme_' + key] = Date.now();
        await Storage.save();
        TG.haptic('success');
      }
      currentTheme = key;
      applyTheme(key);
      await Storage.setTheme(key);
      if (renderer) renderer.theme = key;
      TG.haptic('light');
      buildThemesScreen();
      buildMenuUI();
    });
    grid.appendChild(card);
  });
}

// ── STATS SCREEN ──────────────────────────────────────────────────────────────
function buildStatsScreen() {
  const d = Storage.get(), st = d.stats || {};
  const rows = [
    ['🏆','Best Score',    (d.bestScore||0).toLocaleString()],
    ['📊','Total Score',   (d.totalScore||0).toLocaleString()],
    ['🎮','Games Played',  (d.gamesPlayed||0).toLocaleString()],
    ['➖','Lines Cleared', (st.linesCleared||0).toLocaleString()],
    ['🧩','Pieces Placed', (st.piecesPlaced||0).toLocaleString()],
    ['⚡','Max Combo',     st.maxCombo||0],
    ['✨','Perfect Clears',st.perfectClears||0],
    ['🪙','Coins',         (d.coins||0).toLocaleString()],
    ['📖','Story Levels',  `${d.storyProgress||0}/20`],
  ];
  const el = $('stats-content');
  if (!el) return;
  el.innerHTML = `<div class="stats-group">${rows.map(([ico,name,val])=>`
    <div class="stat-row">
      <div class="stat-ico">${ico}</div>
      <div class="stat-info"><div class="stat-name">${name}</div></div>
      <div class="stat-val">${val}</div>
    </div>`).join('')}</div>`;
}

// ── ACHIEVEMENTS SCREEN ───────────────────────────────────────────────────────
function buildAchievementsScreen() {
  const d  = Storage.get();
  const el = $('ach-content');
  if (!el) return;
  el.innerHTML = `<div class="ach-list">${Object.values(ACHIEVEMENTS).map(a => {
    const done = !!d.achievements?.[a.id];
    return `<div class="ach-card ${done?'done':''}">
      <div class="ach-ico">${done?'🏆':'🔒'}</div>
      <div class="ach-body">
        <div class="ach-name">${a.label}</div>
        <div class="ach-desc">${a.desc}</div>
      </div>
      ${done ? '<div class="ach-done">✓</div>' : `<div class="ach-badge">+${a.coins}🪙</div>`}
    </div>`;
  }).join('')}</div>`;
}

// ── ACHIEVEMENT TOAST ──────────────────────────────────────────────────────────
function showAchToast(a) {
  SoundEngine.achievement();
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
  return { classic:'Classic', timed:'Timed', challenge:'Challenge',
           zen:'Zen', hard:'Hard', story:'Story' }[m] || m;
}

function togglePause() {
  if (!engine || engine.gameOver) return;
  isPaused = !isPaused;
  if (isPaused) {
    cancelAnimationFrame(animId);
    $('pause-overlay')?.classList.add('show');
    SoundEngine.stopMusic();
    TG.haptic('light');
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
  TG.haptic('light'); SoundEngine.button();
  $('btn-undo').disabled = true;
}

async function doShuffle() {
  if (!engine) return;
  const ok = await Storage.spendCoins(5);
  if (!ok) { showToast('Need 5 🪙 to shuffle'); TG.haptic('error'); return; }
  engine.shuffle();
  renderTray();
  TG.haptic('medium'); SoundEngine.button();
  buildMenuUI();
}

// ── EVENT LISTENERS ───────────────────────────────────────────────────────────
function setupListeners() {
  // Menu
  $('btn-play')?.addEventListener('click', () => { SoundEngine.button(); TG.haptic('light'); startGame('classic'); });
  $('btn-modes')?.addEventListener('click', () => { SoundEngine.button(); TG.haptic('light'); showScreen('screen-modes'); });
  $('btn-story')?.addEventListener('click', () => { SoundEngine.button(); TG.haptic('light'); buildStoryScreen(); showScreen('screen-story'); });
  $('btn-themes')?.addEventListener('click', () => { SoundEngine.button(); TG.haptic('light'); buildThemesScreen(); showScreen('screen-themes'); });
  $('btn-stats')?.addEventListener('click', () => { SoundEngine.button(); TG.haptic('light'); buildStatsScreen(); showScreen('screen-stats'); });
  $('btn-achievements')?.addEventListener('click', () => { SoundEngine.button(); TG.haptic('light'); buildAchievementsScreen(); showScreen('screen-achievements'); });
  $('btn-settings')?.addEventListener('click', () => { SoundEngine.button(); TG.haptic('light'); buildSettingsScreen(); showScreen('screen-settings'); });

  // Mode cards
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => { SoundEngine.button(); TG.haptic('light'); startGame(btn.dataset.mode); });
  });

  // Random story buttons
  $('btn-rand-easy')?.addEventListener('click', () => { SoundEngine.button(); startGame('story', generateRandomLevel(Math.floor(Math.random()*8)+1)); });
  $('btn-rand-hard')?.addEventListener('click', () => { SoundEngine.button(); startGame('story', generateRandomLevel(Math.floor(Math.random()*8)+11)); });

  // Back buttons
  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => { SoundEngine.button(); TG.haptic('light'); showScreen(btn.dataset.back); });
  });

  // Game controls
  $('btn-pause')?.addEventListener('click', togglePause);
  $('btn-undo')?.addEventListener('click',  doUndo);
  $('btn-shuffle')?.addEventListener('click', doShuffle);

  // Resume
  $('btn-resume')?.addEventListener('click', () => { togglePause(); });
  $('btn-pause-menu')?.addEventListener('click', () => {
    isPaused = false;
    $('pause-overlay')?.classList.remove('show');
    SoundEngine.stopMusic();
    buildMenuUI(); showScreen('screen-menu');
  });

  // Game over
  $('btn-play-again')?.addEventListener('click', () => { SoundEngine.button(); startGame(currentMode, currentLevel); });
  $('btn-go-menu')?.addEventListener('click', () => { SoundEngine.button(); buildMenuUI(); showScreen('screen-menu'); });
  $('btn-share')?.addEventListener('click', () => { SoundEngine.button(); TG.shareScore(engine?.score || 0, modeLabel(currentMode)); });

  // Level win
  $('btn-next-level')?.addEventListener('click', () => {
    SoundEngine.button();
    $('level-win')?.classList.remove('show');
    const next = STORY_LEVELS.find(l => l.id === (currentLevel?.id || 0) + 1);
    if (next) startGame('story', next);
    else { buildMenuUI(); showScreen('screen-menu'); }
  });
  $('btn-retry')?.addEventListener('click', () => {
    SoundEngine.button();
    $('level-win')?.classList.remove('show');
    startGame('story', currentLevel);
  });
  $('btn-win-menu')?.addEventListener('click', () => {
    SoundEngine.button();
    $('level-win')?.classList.remove('show');
    buildMenuUI(); showScreen('screen-menu');
  });

  // Resize
  window.addEventListener('resize', () => renderer?.resize());

  // Drag
  setupDrag();
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
