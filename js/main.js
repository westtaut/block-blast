// ─── MAIN APP CONTROLLER ─────────────────────────────────────────────────────

'use strict';

let engine      = null;
let renderer    = null;
let currentTheme= 'dark';
let currentMode = 'classic';
let currentLevel= null;
let animFrameId = null;
let timerInterval = null;
let timeLeft    = 0;
let isPaused    = false;

// Drag state
let drag = {
  active: false,
  pieceIndex: null,
  piece: null,
  startX: 0, startY: 0,
  currentX: 0, currentY: 0,
  gridCol: null, gridRow: null,
  offsetX: 0, offsetY: 0,
  ghost: null,
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const screens = ['screen-menu','screen-modes','screen-story','screen-game',
                 'screen-gameover','screen-themes','screen-stats','screen-achievements'];

function showScreen(id) {
  screens.forEach(s => {
    const el = $(s);
    if (el) {
      el.classList.toggle('active', s === id);
      el.classList.toggle('hidden', s !== id);
    }
  });
  TG.hideMainButton();
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  TG.init();
  await Storage.load();

  currentTheme = Storage.get().selectedTheme || 'dark';
  applyTheme(currentTheme);

  buildMenuUI();
  showScreen('screen-menu');
  setupEventListeners();

  // Animate menu in
  setTimeout(() => document.querySelector('.menu-card')?.classList.add('visible'), 100);
}

// ── Menu UI ────────────────────────────────────────────────────────────────────
function buildMenuUI() {
  const data = Storage.get();
  const name = TG.getFirstName();
  const el = $('menu-username');
  if (el) el.textContent = name;
  const av = $('menu-avatar');
  if (av) av.textContent = name.charAt(0).toUpperCase();
  const coins = $('menu-coins');
  if (coins) coins.textContent = data.coins || 0;
  const best = $('menu-best');
  if (best) best.textContent = (data.bestScore || 0).toLocaleString();
  const story = $('menu-story');
  if (story) story.textContent = `${data.storyProgress || 0}/20`;
}

// ── Start Game ─────────────────────────────────────────────────────────────────
function startGame(mode, level = null) {
  currentMode  = mode;
  currentLevel = level;
  isPaused     = false;

  const gridSize = level?.grid || (mode === 'hard' ? 10 : 8);

  // Setup engine
  engine = new GameEngine({
    gridSize,
    mode,
    level,
    onScore:    handleScore,
    onGameOver: handleGameOver,
    onLineClear:handleLineClear,
    onLevelWin: handleLevelWin,
  });

  // Setup renderer
  const canvas = $('game-canvas');
  if (!canvas) return;

  if (renderer) renderer.theme = currentTheme;
  else renderer = new Renderer(canvas, { theme: currentTheme, gridSize });
  renderer.gridSize = gridSize;
  renderer.theme = currentTheme;
  renderer.resize();

  // Reset block animations
  renderer.blockScale = Array.from({length:gridSize},()=>Array(gridSize).fill(1));
  renderer.blockAlpha = Array.from({length:gridSize},()=>Array(gridSize).fill(1));
  renderer.particles  = [];
  renderer.clearAnim  = [];
  renderer.floatTexts = [];

  // UI
  updateGameUI();
  renderPieceTray();
  showScreen('screen-game');

  // Timer
  clearInterval(timerInterval);
  if (mode === 'timed' || level?.objective?.type?.includes('timed')) {
    timeLeft = level?.objective?.time || 180;
    updateTimer();
    timerInterval = setInterval(() => {
      if (!isPaused && !engine.gameOver && !engine.won) {
        timeLeft--;
        updateTimer();
        if (timeLeft <= 0) {
          clearInterval(timerInterval);
          handleGameOver(engine.score);
        }
      }
    }, 1000);
  }

  // Level info banner
  if (level) {
    showLevelBanner(level);
  }

  // Start loop
  if (animFrameId) cancelAnimationFrame(animFrameId);
  gameLoop();
}

function gameLoop() {
  if (!engine || !renderer) return;
  renderer.draw(engine, drag.active ? drag : null);
  animFrameId = requestAnimationFrame(gameLoop);
}

// ── Score / Events ─────────────────────────────────────────────────────────────
function handleScore(total, gained, cleared) {
  $('score-value').textContent = total;
  if (gained > 0) {
    const canvas = $('game-canvas');
    const cx = canvas ? canvas.width/2 : 150;
    const cy = canvas ? canvas.height/2 : 150;
    let label = '+' + gained;
    if (engine.combo > 1) label += ` ×${engine.combo}`;
    renderer.addFloatText(label, cx, cy - 40, THEMES[currentTheme]?.accent || '#5b7cff', 22);
  }
  if (engine.combo > 1) {
    $('combo-display').textContent = `×${engine.combo} COMBO`;
    $('combo-display').classList.add('visible');
    setTimeout(()=>$('combo-display').classList.remove('visible'), 1500);
  }
  renderPieceTray();
  checkAchievements(engine, Storage).then(unlocked => {
    unlocked.forEach(a => showAchievementToast(a));
  });
}

function handleLineClear({ rows, cols }) {
  renderer.triggerLineClear(rows, cols, currentTheme);
  TG.haptic(rows.length + cols.length >= 3 ? 'heavy' : 'medium');
  updateObjectiveProgress();
}

function handleGameOver(score) {
  clearInterval(timerInterval);
  cancelAnimationFrame(animFrameId);
  TG.haptic('error');

  Storage.addScore(score, currentMode);
  Storage.updateStats({
    linesCleared:  engine.linesCleared,
    piecesPlaced:  engine.piecesPlaced,
    maxCombo:      engine.maxCombo,
    perfectClears: engine.perfectClears,
  });

  const data = Storage.get();
  $('go-score').textContent    = score;
  $('go-best').textContent     = data.bestScore;
  $('go-lines').textContent    = engine.linesCleared;
  $('go-combos').textContent   = engine.maxCombo;
  $('go-mode').textContent     = modeLabel(currentMode);
  $('go-new-best').style.display = score >= data.bestScore && score > 0 ? 'block' : 'none';

  setTimeout(() => showScreen('screen-gameover'), 400);
}

async function handleLevelWin(level, score) {
  clearInterval(timerInterval);
  cancelAnimationFrame(animFrameId);
  TG.haptic('success');

  const stars = await Storage.completeLevel(level.id, score);
  await Storage.addScore(score, 'story');

  showLevelWinScreen(level, score, stars);
}

// ── Piece Tray ─────────────────────────────────────────────────────────────────
function renderPieceTray() {
  if (!engine) return;
  for (let i = 0; i < 3; i++) {
    const canvas = $(`piece-canvas-${i}`);
    const wrap   = $(`piece-wrap-${i}`);
    if (!canvas || !wrap) continue;
    const piece  = engine.pieces[i];
    if (!piece) {
      wrap.classList.add('used');
      canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
    } else {
      wrap.classList.remove('used');
      renderer.drawPiecePreview(canvas, piece, currentTheme);
    }
  }
}

// ── Drag & Drop ─────────────────────────────────────────────────────────────────
function setupDragListeners() {
  const tray = $('piece-tray');
  if (!tray) return;

  function onPiecePointerDown(e, idx) {
    e.preventDefault();
    const piece = engine?.pieces[idx];
    if (!piece) return;
    TG.haptic('light');

    const pt = e.touches ? e.touches[0] : e;
    drag.active     = true;
    drag.pieceIndex = idx;
    drag.piece      = piece;
    drag.startX     = pt.clientX;
    drag.startY     = pt.clientY;
    drag.currentX   = pt.clientX;
    drag.currentY   = pt.clientY;
    drag.gridCol    = null;
    drag.gridRow    = null;

    // Show floating drag clone
    showDragGhost(piece, pt.clientX, pt.clientY);
  }

  for (let i=0;i<3;i++) {
    const wrap = $(`piece-wrap-${i}`);
    if (!wrap) continue;
    wrap.addEventListener('pointerdown', e => onPiecePointerDown(e, i), {passive:false});
  }
}

let dragGhostEl = null;

function showDragGhost(piece, x, y) {
  if (dragGhostEl) dragGhostEl.remove();
  const t = THEMES[currentTheme] || THEMES.dark;
  const cs = Math.floor(Math.min(window.innerWidth,420) / (engine.gridSize + 2));

  dragGhostEl = document.createElement('canvas');
  const pw = getPieceWidth(piece), ph = getPieceHeight(piece);
  dragGhostEl.width  = (pw+1)*cs;
  dragGhostEl.height = (ph+1)*cs;
  dragGhostEl.style.cssText = `
    position:fixed;pointer-events:none;z-index:9999;
    left:${x - dragGhostEl.width/2}px;
    top:${y - dragGhostEl.height/2 - 30}px;
    opacity:0.95;transform:scale(1.15);transition:none;
  `;
  renderer.drawPiecePreview(dragGhostEl, piece, currentTheme);
  document.body.appendChild(dragGhostEl);
}

function moveDragGhost(x, y) {
  if (!dragGhostEl) return;
  dragGhostEl.style.left = `${x - dragGhostEl.width/2}px`;
  dragGhostEl.style.top  = `${y - dragGhostEl.height/2 - 30}px`;
}

function setupPointerListeners() {
  document.addEventListener('pointermove', e => {
    if (!drag.active) return;
    const pt = e.touches ? e.touches[0] : e;
    drag.currentX = pt.clientX;
    drag.currentY = pt.clientY;
    moveDragGhost(pt.clientX, pt.clientY);

    // Compute grid cell under finger
    const canvas = $('game-canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const lx = pt.clientX - rect.left;
    const ly = pt.clientY - rect.top - 30; // offset up so not covered by finger

    const cell = renderer.getCellFromXY(lx, ly);
    if (cell) {
      // Anchor to top-left of piece
      const piece = drag.piece;
      drag.gridCol = cell.col;
      drag.gridRow = cell.row;
    } else {
      drag.gridCol = null;
      drag.gridRow = null;
    }
  }, {passive:true});

  document.addEventListener('pointerup', e => {
    if (!drag.active) return;
    const placed = tryPlaceDrag();
    if (dragGhostEl) { dragGhostEl.remove(); dragGhostEl = null; }
    if (!placed) TG.haptic('warning');
    drag.active = false;
    drag.piece  = null;
    renderPieceTray();
  });

  document.addEventListener('pointercancel', () => {
    if (dragGhostEl) { dragGhostEl.remove(); dragGhostEl = null; }
    drag.active = false;
    drag.piece  = null;
  });
}

function tryPlaceDrag() {
  if (!engine || drag.gridCol === null || drag.gridRow === null) return false;
  const ok = engine.placePiece(drag.pieceIndex, drag.gridCol, drag.gridRow);
  if (ok) {
    renderer.animatePlacement(drag.piece, drag.gridCol, drag.gridRow);
    TG.haptic('light');
  }
  return ok;
}

// ── Timer UI ──────────────────────────────────────────────────────────────────
function updateTimer() {
  const el = $('timer-display');
  if (!el) return;
  const m = Math.floor(timeLeft/60), s = timeLeft%60;
  el.textContent = `${m}:${s.toString().padStart(2,'0')}`;
  if (timeLeft <= 30) el.classList.add('urgent');
  else el.classList.remove('urgent');
}

function updateGameUI() {
  if (!engine) return;
  $('score-value').textContent = engine.score;
  const best = Storage.get().bestScore;
  $('best-value').textContent  = best;

  // Show/hide timer
  const timerEl = $('timer-display');
  if (timerEl) {
    const hasTimed = currentMode === 'timed' || currentLevel?.objective?.type?.includes('timed');
    timerEl.style.display = hasTimed ? 'block' : 'none';
  }

  // Objective
  updateObjectiveProgress();
}

function updateObjectiveProgress() {
  const el = $('objective-bar');
  if (!el || !currentLevel) { if(el) el.style.display='none'; return; }
  el.style.display = 'block';
  const obj = currentLevel.objective;
  $('obj-label').textContent = obj.label;
  let progress = 0;
  switch(obj.type) {
    case 'score': case 'score_timed': progress = Math.min(1, engine.score / obj.target); break;
    case 'lines': case 'lines_timed': progress = Math.min(1, engine.linesCleared / obj.target); break;
    case 'columns': progress = Math.min(1, engine.columnsCleared / obj.target); break;
    case 'combo':   progress = Math.min(1, engine.maxCombo / obj.target); break;
    case 'pieces':  progress = Math.min(1, engine.piecesPlaced / obj.target); break;
    default: progress = 0;
  }
  $('obj-fill').style.width = (progress * 100) + '%';
}

// ── Level Banner ──────────────────────────────────────────────────────────────
function showLevelBanner(level) {
  const banner = $('level-banner');
  if (!banner) return;
  $('banner-title').textContent = `Level ${level.id}: ${level.title}`;
  $('banner-story').textContent = level.story;
  $('banner-obj').textContent   = `🎯 ${level.objective.label}`;
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 3500);
}

// ── Level Win ──────────────────────────────────────────────────────────────────
function showLevelWinScreen(level, score, stars) {
  const win = $('level-win');
  if (!win) { handleGameOver(score); return; }
  $('win-title').textContent = level.title;
  $('win-score').textContent = score;
  $('win-reward').textContent= '+' + level.reward + ' 🪙';
  const starEls = win.querySelectorAll('.star');
  starEls.forEach((s,i) => s.classList.toggle('lit', i < stars));
  win.classList.add('show');
}

// ── Achievement Toast ──────────────────────────────────────────────────────────
function showAchievementToast(achievement) {
  const t = document.createElement('div');
  t.className = 'achievement-toast';
  t.innerHTML = `<span class="ach-icon">🏆</span><div><div class="ach-name">${achievement.label}</div><div class="ach-desc">${achievement.desc}</div></div><span class="ach-coins">+${achievement.coins}🪙</span>`;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(()=>t.remove(),500); }, 3000);
}

// ── Mode Labels ───────────────────────────────────────────────────────────────
function modeLabel(m) {
  return { classic:'Classic',timed:'Timed',challenge:'Challenge',zen:'Zen',hard:'Hard',story:'Story' }[m] || m;
}

// ── Story Screen ───────────────────────────────────────────────────────────────
function buildStoryScreen() {
  const grid = $('story-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const data = Storage.get();

  STORY_LEVELS.forEach(lv => {
    const unlocked = lv.id === 1 || lv.id <= data.storyProgress + 1;
    const stars    = data.storyStars[lv.id] || 0;
    const div = document.createElement('div');
    div.className = `story-level ${unlocked ? '' : 'locked'} ${stars === 3 ? 'perfect' : ''}`;
    div.innerHTML = `
      <div class="lv-num">${lv.id}</div>
      <div class="lv-title">${lv.title}</div>
      <div class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</div>
      ${!unlocked ? '<div class="lv-lock">🔒</div>' : ''}
    `;
    if (unlocked) {
      div.addEventListener('click', () => {
        TG.haptic('light');
        startGame('story', lv);
      });
    }
    grid.appendChild(div);
  });
}

// ── Themes Screen ─────────────────────────────────────────────────────────────
function buildThemesScreen() {
  const grid = $('themes-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const data = Storage.get();

  Object.entries(THEMES).forEach(([key, t]) => {
    const owned = !t.locked || data.achievements['theme_' + key];
    const div = document.createElement('div');
    div.className = `theme-card ${key === currentTheme ? 'active' : ''} ${!owned ? 'locked' : ''}`;
    div.style.cssText = `background:${t.bg};border-color:${key===currentTheme ? t.accent : t.border};`;
    div.innerHTML = `
      <div class="theme-preview">
        ${t.blocks.slice(0,4).map(c=>`<div style="background:${c};width:18px;height:18px;border-radius:4px"></div>`).join('')}
      </div>
      <div class="theme-emoji">${t.emoji}</div>
      <div class="theme-name" style="color:${t.text}">${t.name}</div>
      ${!owned ? `<div class="theme-price" style="color:${t.text}88">🪙 ${t.price}</div>` : ''}
      ${key===currentTheme ? `<div class="theme-check">✓</div>` : ''}
    `;
    div.addEventListener('click', async () => {
      if (!owned) {
        const ok = await Storage.spendCoins(t.price||50);
        if (!ok) { TG.haptic('error'); showToast('Not enough coins!'); return; }
        data.achievements['theme_'+key] = Date.now();
        await Storage.save();
        TG.haptic('success');
      }
      currentTheme = key;
      applyTheme(key);
      await Storage.setTheme(key);
      if (renderer) renderer.theme = key;
      TG.haptic('light');
      buildThemesScreen();
    });
    grid.appendChild(div);
  });
}

// ── Stats Screen ──────────────────────────────────────────────────────────────
function buildStatsScreen() {
  const data = Storage.get();
  const stats = data.stats || {};
  const items = [
    ['Best Score',    data.bestScore || 0],
    ['Total Score',   data.totalScore || 0],
    ['Games Played',  data.gamesPlayed || 0],
    ['Lines Cleared', stats.linesCleared || 0],
    ['Pieces Placed', stats.piecesPlaced || 0],
    ['Max Combo',     stats.maxCombo || 0],
    ['Perfect Clears',stats.perfectClears || 0],
    ['Coins',         data.coins || 0],
  ];
  const el = $('stats-content');
  if (!el) return;
  el.innerHTML = items.map(([label, val]) =>
    `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-val">${val.toLocaleString()}</span></div>`
  ).join('');
}

// ── Achievements Screen ───────────────────────────────────────────────────────
function buildAchievementsScreen() {
  const data = Storage.get();
  const el = $('achievements-content');
  if (!el) return;
  el.innerHTML = Object.values(ACHIEVEMENTS).map(a => {
    const done = !!data.achievements[a.id];
    return `<div class="ach-row ${done?'done':''}">
      <div class="ach-icon-big">${done?'🏆':'🔒'}</div>
      <div class="ach-info"><div class="ach-title">${a.label}</div><div class="ach-sub">${a.desc}</div></div>
      <div class="ach-reward">${done?'✓':'+'+a.coins+'🪙'}</div>
    </div>`;
  }).join('');
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),400);},2000);
}

// ── Event Listeners ───────────────────────────────────────────────────────────
function setupEventListeners() {
  // Menu buttons
  $('btn-classic')?.addEventListener('click', () => { TG.haptic('light'); startGame('classic'); });
  $('btn-modes')?.addEventListener('click',   () => { TG.haptic('light'); showScreen('screen-modes'); });
  $('btn-story')?.addEventListener('click',   () => { TG.haptic('light'); buildStoryScreen(); showScreen('screen-story'); });
  $('btn-themes')?.addEventListener('click',  () => { TG.haptic('light'); buildThemesScreen(); showScreen('screen-themes'); });
  $('btn-stats')?.addEventListener('click',   () => { TG.haptic('light'); buildStatsScreen(); showScreen('screen-stats'); });
  $('btn-achievements')?.addEventListener('click', () => { TG.haptic('light'); buildAchievementsScreen(); showScreen('screen-achievements'); });

  // Mode selection
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      TG.haptic('light');
      const mode = btn.dataset.mode;
      startGame(mode);
    });
  });

  // Game buttons
  $('btn-pause')?.addEventListener('click', togglePause);
  $('btn-undo')?.addEventListener('click',  doUndo);
  $('btn-shuffle')?.addEventListener('click', doShuffle);

  // Back buttons
  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => { TG.haptic('light'); showScreen(btn.dataset.back); });
  });

  // Game over buttons
  $('btn-play-again')?.addEventListener('click', () => {
    TG.haptic('light');
    startGame(currentMode, currentLevel);
  });
  $('btn-menu')?.addEventListener('click', () => {
    TG.haptic('light');
    buildMenuUI();
    showScreen('screen-menu');
  });
  $('btn-share')?.addEventListener('click', () => {
    TG.haptic('light');
    TG.shareScore(engine?.score || 0, modeLabel(currentMode));
  });

  // Level win buttons
  $('btn-next-level')?.addEventListener('click', () => {
    const win = $('level-win'); if(win) win.classList.remove('show');
    const nextId = (currentLevel?.id||0) + 1;
    const next = STORY_LEVELS.find(l=>l.id===nextId);
    if (next) startGame('story', next);
    else { buildMenuUI(); showScreen('screen-menu'); }
  });
  $('btn-retry-level')?.addEventListener('click', () => {
    const win=$('level-win'); if(win) win.classList.remove('show');
    startGame('story', currentLevel);
  });
  $('btn-win-menu')?.addEventListener('click', () => {
    const win=$('level-win'); if(win) win.classList.remove('show');
    buildMenuUI(); showScreen('screen-menu');
  });

  // Resize
  window.addEventListener('resize', () => { if (renderer) renderer.resize(); });

  // Drag setup
  setupDragListeners();
  setupPointerListeners();

  // Pause overlay
  $('btn-resume')?.addEventListener('click', () => { isPaused=false; $('pause-overlay')?.classList.remove('show'); gameLoop(); });
}

function togglePause() {
  if (!engine || engine.gameOver) return;
  isPaused = !isPaused;
  if (isPaused) {
    cancelAnimationFrame(animFrameId);
    $('pause-overlay')?.classList.add('show');
    TG.haptic('light');
  } else {
    $('pause-overlay')?.classList.remove('show');
    gameLoop();
  }
}

function doUndo() {
  if (!engine) return;
  if (engine.usedUndo) { showToast('Undo already used!'); return; }
  engine.undo();
  renderPieceTray();
  updateGameUI();
  TG.haptic('light');
  $('btn-undo').disabled = true;
}

async function doShuffle() {
  if (!engine) return;
  const ok = await Storage.spendCoins(5);
  if (!ok) { showToast('Need 5 🪙 to shuffle!'); TG.haptic('error'); return; }
  engine.shuffle();
  renderPieceTray();
  TG.haptic('medium');
  buildMenuUI();
}

// ── Boot ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
