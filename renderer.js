// ─── CANVAS RENDERER ─────────────────────────────────────────────────────────

class Renderer {
  constructor(canvas, opts = {}) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext('2d');
    this.theme    = opts.theme || 'dark';
    this.gridSize = opts.gridSize || 8;

    this.particles  = [];
    this.clearAnim  = [];
    this.floatTexts = [];
    this.blockScale = Array.from({length:this.gridSize},()=>Array(this.gridSize).fill(1));
    this.blockAlpha = Array.from({length:this.gridSize},()=>Array(this.gridSize).fill(1));
    this.shakeTime  = 0;
    this.shakeAmt   = 0;

    this._resize();
  }

  _resize() {
    const side    = Math.min(window.innerWidth, 430);
    const padding = 32;
    this.cellSize = Math.floor((side - padding) / this.gridSize);
    this.boardW   = this.cellSize * this.gridSize;
    this.boardH   = this.cellSize * this.gridSize;
    this.canvas.width  = this.boardW;
    this.canvas.height = this.boardH;
    this.canvas.style.width  = this.boardW + 'px';
    this.canvas.style.height = this.boardH + 'px';
  }

  resize() { this._resize(); }

  // ── MAIN DRAW LOOP ────────────────────────────────────────────────────────
  draw(engine, dragState) {
    const { ctx, boardW, boardH } = this;
    const t = THEMES[this.theme] || THEMES.dark;

    ctx.clearRect(0, 0, boardW, boardH);
    ctx.save();

    // Shake offset
    if (this.shakeTime > 0) {
      const s = this.shakeAmt * (this.shakeTime / 10);
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      this.shakeTime--;
    }

    this._drawGridBg(t);
    this._drawSnappedPiece(engine, dragState, t);
    this._drawBlocks(engine.grid, t);
    this._drawClearAnims(t);
    this._drawParticles();
    this._drawFloatTexts();

    ctx.restore();
  }

  // ── GRID BACKGROUND ───────────────────────────────────────────────────────
  _drawGridBg(t) {
    const { ctx, cellSize, boardW, boardH, gridSize } = this;

    ctx.fillStyle = t.gridBg;
    this._rrect(ctx, 0, 0, boardW, boardH, 16);
    ctx.fill();

    // Lines
    ctx.strokeStyle = t.gridLine;
    ctx.lineWidth   = 1;
    for (let i = 1; i < gridSize; i++) {
      ctx.beginPath(); ctx.moveTo(i * cellSize, 6); ctx.lineTo(i * cellSize, boardH - 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, i * cellSize); ctx.lineTo(boardW - 6, i * cellSize); ctx.stroke();
    }

    // Dots at intersections
    ctx.fillStyle = t.gridLine;
    for (let r = 1; r < gridSize; r++) {
      for (let c = 1; c < gridSize; c++) {
        ctx.beginPath();
        ctx.arc(c * cellSize, r * cellSize, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── SNAPPED PIECE PREVIEW ON CANVAS (no floating element) ─────────────────
  // This replaces the old floating HTML ghost — the piece is drawn directly
  // on the canvas at its snapped grid position, WITH or WITHOUT validation tint.
  _drawSnappedPiece(engine, dragState, t) {
    if (!dragState?.active || dragState.snapCol === null || dragState.snapRow === null) return;

    const { ctx, cellSize } = this;
    const piece  = dragState.piece;
    const col    = dragState.snapCol;
    const row    = dragState.snapRow;
    const valid  = dragState.valid;
    const color  = t.blocks[piece.color % t.blocks.length];

    for (const [dx, dy] of piece.cells) {
      const c = col + dx, r = row + dy;
      // Draw even if out of bounds slightly for visual feedback
      const x = c * cellSize;
      const y = r * cellSize;
      const pad = 3, w = cellSize - pad*2, h = cellSize - pad*2, radius = Math.max(4, cellSize * 0.18);

      ctx.globalAlpha = valid ? 0.92 : 0.45;

      // Tint: green-ish when valid, red-ish when invalid
      let drawColor = color;
      if (!valid) {
        drawColor = '#f87171';  // red
      }

      // No shadow on dragged piece (clean, crisp)
      ctx.shadowBlur = 0;

      ctx.fillStyle = drawColor;
      this._rrect(ctx, x + pad, y + pad, w, h, radius);
      ctx.fill();

      // Highlight
      if (valid) {
        const grad = ctx.createLinearGradient(x+pad, y+pad, x+pad, y+pad + h*0.45);
        grad.addColorStop(0, 'rgba(255,255,255,0.35)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        this._rrect(ctx, x+pad+2, y+pad+2, w-4, h*0.4, radius-1);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    }
  }

  // ── PLACED BLOCKS ─────────────────────────────────────────────────────────
  _drawBlocks(grid, t) {
    const { ctx, cellSize, gridSize } = this;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const v = grid[r][c];
        if (!v) continue;
        const color = t.blocks[(v - 1) % t.blocks.length];
        this._drawBlock(ctx, c, r, cellSize, color,
          this.blockScale[r][c], this.blockAlpha[r][c], t);
      }
    }
  }

  _drawBlock(ctx, col, row, cs, color, scale = 1, alpha = 1, t) {
    const pad = 3;
    const bw  = (cs - pad * 2) * scale;
    const bh  = (cs - pad * 2) * scale;
    const bx  = col * cs + pad + (cs - pad*2) * (1 - scale) / 2;
    const by  = row * cs + pad + (cs - pad*2) * (1 - scale) / 2;
    const r   = Math.max(3, Math.floor(cs * 0.18));

    ctx.globalAlpha = alpha;

    // Subtle shadow (only for placed blocks)
    ctx.shadowColor   = color + '44';
    ctx.shadowBlur    = t.glowBlocks ? cs * 0.35 : cs * 0.1;
    ctx.shadowOffsetY = t.glowBlocks ? 0 : 2;

    ctx.fillStyle = color;
    this._rrect(ctx, bx, by, bw, bh, r);
    ctx.fill();

    // Shine
    ctx.shadowBlur    = 0;
    ctx.shadowColor   = 'transparent';
    ctx.shadowOffsetY = 0;
    const grad = ctx.createLinearGradient(bx, by, bx, by + bh * 0.5);
    grad.addColorStop(0, 'rgba(255,255,255,0.32)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    this._rrect(ctx, bx + 2, by + 2, bw - 4, bh * 0.42, r - 1);
    ctx.fill();

    ctx.globalAlpha   = 1;
    ctx.shadowBlur    = 0;
    ctx.shadowColor   = 'transparent';
    ctx.shadowOffsetY = 0;
  }

  // ── CLEAR ANIMATIONS ──────────────────────────────────────────────────────
  _drawClearAnims(t) {
    const { ctx, cellSize, boardW, boardH } = this;
    const now = Date.now();
    this.clearAnim = this.clearAnim.filter(a => {
      const age = (now - a.start) / 380;
      if (age >= 1) return false;
      ctx.globalAlpha = (1 - age) * 0.7;
      ctx.fillStyle   = t.accent;
      if (a.type === 'row') ctx.fillRect(0, a.index * cellSize + 2, boardW, cellSize - 4);
      else                  ctx.fillRect(a.index * cellSize + 2, 0, cellSize - 4, boardH);
      ctx.globalAlpha = 1;
      return true;
    });
  }

  // ── PARTICLES ─────────────────────────────────────────────────────────────
  _drawParticles() {
    const { ctx } = this;
    const now = Date.now();
    this.particles = this.particles.filter(p => {
      const t = (now - p.born) / p.life;
      if (t >= 1) return false;
      const px = p.x + p.vx * (now - p.born) / 16;
      const py = p.y + p.vy * (now - p.born) / 16 + 0.5 * p.gravity * ((now - p.born) / 16) ** 2;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(px, py, p.size * (1 - t * 0.4), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return true;
    });
  }

  // ── FLOAT TEXTS ───────────────────────────────────────────────────────────
  _drawFloatTexts() {
    const { ctx } = this;
    const now = Date.now();
    this.floatTexts = this.floatTexts.filter(f => {
      const age = (now - f.born) / f.life;
      if (age >= 1) return false;
      const y = f.y - 50 * age;
      ctx.globalAlpha = age < 0.65 ? 1 : 1 - (age - 0.65) / 0.35;
      ctx.fillStyle   = f.color;
      ctx.font        = `bold ${f.size}px -apple-system, SF Pro Rounded, sans-serif`;
      ctx.textAlign   = 'center';
      ctx.textBaseline= 'middle';
      ctx.fillText(f.text, f.x, y);
      ctx.globalAlpha  = 1;
      ctx.textBaseline = 'alphabetic';
      return true;
    });
  }

  // ── PIECE PREVIEW (tray slots) ─────────────────────────────────────────────
  drawPiecePreview(canvas, piece, themeName) {
    if (!canvas || !piece) return;
    const t   = THEMES[themeName] || THEMES.dark;
    const ctx = canvas.getContext('2d');
    const pw  = getPieceWidth(piece);
    const ph  = getPieceHeight(piece);

    // Determine cell size to fit piece in canvas with padding
    const pad   = 6;
    const fitW  = (canvas.width  - pad * 2) / pw;
    const fitH  = (canvas.height - pad * 2) / ph;
    const cs    = Math.floor(Math.min(fitW, fitH, canvas.width / 4));
    const ox    = Math.floor((canvas.width  - pw * cs) / 2);
    const oy    = Math.floor((canvas.height - ph * cs) / 2);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const [dx, dy] of piece.cells) {
      const color  = t.blocks[piece.color % t.blocks.length];
      const xb     = ox + dx * cs;
      const yb     = oy + dy * cs;
      const bpad   = 2;
      const bw     = cs - bpad * 2;
      const bh     = cs - bpad * 2;
      const radius = Math.max(2, cs * 0.18);

      ctx.shadowColor = color + '55';
      ctx.shadowBlur  = t.glowBlocks ? cs * 0.3 : cs * 0.08;

      ctx.fillStyle = color;
      this._rrect(ctx, xb + bpad, yb + bpad, bw, bh, radius);
      ctx.fill();

      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';

      const grad = ctx.createLinearGradient(xb+bpad, yb+bpad, xb+bpad, yb+bpad+bh*0.45);
      grad.addColorStop(0, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      this._rrect(ctx, xb+bpad+1, yb+bpad+1, bw-2, bh*0.42, radius-1);
      ctx.fill();
    }
  }

  // ── EFFECTS ───────────────────────────────────────────────────────────────
  triggerLineClear(rows, cols) {
    const now = Date.now();
    rows.forEach(r => this.clearAnim.push({ type:'row', index:r, start:now }));
    cols.forEach(c => this.clearAnim.push({ type:'col', index:c, start:now }));

    const t = THEMES[this.theme];
    const { cellSize, gridSize } = this;

    rows.forEach(r => {
      for (let c = 0; c < gridSize; c++) this._burst(c * cellSize + cellSize/2, r * cellSize + cellSize/2, t);
    });
    cols.forEach(c => {
      for (let r = 0; r < gridSize; r++) this._burst(c * cellSize + cellSize/2, r * cellSize + cellSize/2, t);
    });

    this.shakeTime = 7;
    this.shakeAmt  = rows.length + cols.length > 2 ? 5 : 3;
  }

  _burst(x, y, t) {
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        gravity: 0.12,
        color: t?.particleColor || '#5b7cfa',
        size:  2 + Math.random() * 3,
        born:  now,
        life:  500 + Math.random() * 400,
      });
    }
  }

  addFloatText(text, x, y, color, size = 20) {
    this.floatTexts.push({ text, x, y, color, size, born: Date.now(), life: 900 });
  }

  animatePlacement(piece, col, row) {
    for (const [dx, dy] of piece.cells) {
      const r = row + dy, c = col + dx;
      if (r >= 0 && r < this.gridSize && c >= 0 && c < this.gridSize) {
        this.blockScale[r][c] = 1.25;
        setTimeout(() => { if (this.blockScale[r]) this.blockScale[r][c] = 1; }, 140);
      }
    }
  }

  // ── UTILS ─────────────────────────────────────────────────────────────────
  _rrect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  }

  getCellFromXY(x, y) {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    if (col < 0 || col >= this.gridSize || row < 0 || row >= this.gridSize) return null;
    return { col, row };
  }
}
