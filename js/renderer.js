// ─── PREMIUM RENDERER ────────────────────────────────────────────────────────
// 60fps Canvas renderer with beautiful particle explosions

class Renderer {
  constructor(canvas, opts = {}) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext('2d');
    this.theme    = opts.theme || 'dark';
    this.gridSize = opts.gridSize || 8;

    // Particle systems
    this.particles   = [];  // { x,y,vx,vy,gravity,color,size,shape,life,born,spin,spinV,trail }
    this.rings       = [];  // expanding ring effects
    this.flashes     = [];  // row/col flash effects
    this.floatTexts  = [];
    this.shockwaves  = [];  // circular shockwave rings

    // Block animation state
    this.blockScale  = Array.from({length:this.gridSize},()=>Array(this.gridSize).fill(1));
    this.blockAlpha  = Array.from({length:this.gridSize},()=>Array(this.gridSize).fill(1));

    // Screen shake
    this.shakeTime = 0;
    this.shakeAmt  = 0;
    this.shakeX    = 0;
    this.shakeY    = 0;

    // Drag floating element
    this._dragEl = null;

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

  // ── MAIN DRAW ─────────────────────────────────────────────────────────────
  draw(engine, dragState) {
    const { ctx, boardW, boardH } = this;
    const t = THEMES[this.theme] || THEMES.dark;

    // Update shake
    if (this.shakeTime > 0) {
      const decay = this.shakeTime / 12;
      this.shakeX = (Math.random() - 0.5) * this.shakeAmt * decay;
      this.shakeY = (Math.random() - 0.5) * this.shakeAmt * decay;
      this.shakeTime--;
    } else {
      this.shakeX = this.shakeY = 0;
    }

    ctx.clearRect(0, 0, boardW, boardH);
    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

    this._drawBg(t);
    this._drawGrid(t);
    this._drawBlocks(engine.grid, t);
    this._drawSnapPreview(engine, dragState, t);
    this._drawFlashes(t);
    this._drawShockwaves(t);
    this._drawParticles();
    this._drawRings(t);
    this._drawFloatTexts();

    ctx.restore();
  }

  // ── BACKGROUND ────────────────────────────────────────────────────────────
  _drawBg(t) {
    const { ctx, boardW, boardH } = this;

    // Forest theme: subtle wood-grain gradient on the grid bg
    if (t.forestBg) {
      const grad = ctx.createLinearGradient(0, 0, boardW, boardH);
      grad.addColorStop(0,   '#0f1d10');
      grad.addColorStop(0.4, '#111c12');
      grad.addColorStop(1,   '#0d1a0e');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = t.gridBg;
    }
    this._rr(ctx, 0, 0, boardW, boardH, 18);
    ctx.fill();

    // Star field (space theme)
    if (t.starField) {
      const now = Date.now();
      ctx.save();
      for (let i = 0; i < 40; i++) {
        const x = (Math.sin(i * 137.5) * 0.5 + 0.5) * boardW;
        const y = (Math.cos(i * 97.3)  * 0.5 + 0.5) * boardH;
        const a = 0.3 + 0.3 * Math.sin(now * 0.002 + i);
        ctx.globalAlpha = a;
        ctx.fillStyle   = '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, 0.8 + Math.sin(i) * 0.5, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
  }

  _drawGrid(t) {
    const { ctx, cellSize, boardW, boardH, gridSize } = this;
    ctx.save();
    ctx.strokeStyle = t.gridLine;
    ctx.lineWidth = 1;

    for (let i = 1; i < gridSize; i++) {
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(i * cellSize, 8); ctx.lineTo(i * cellSize, boardH - 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8, i * cellSize); ctx.lineTo(boardW - 8, i * cellSize); ctx.stroke();
    }

    // Subtle dot at each intersection
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = t.gridLine;
    for (let r = 1; r < gridSize; r++) {
      for (let c = 1; c < gridSize; c++) {
        ctx.beginPath();
        ctx.arc(c * cellSize, r * cellSize, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ── SNAP PREVIEW — very visible on canvas for large pieces ──────────────────
  _drawSnapPreview(engine, dragState, t) {
    if (!dragState?.active || dragState.snapCol === null || dragState.snapRow === null) return;
    const { ctx, cellSize: cs } = this;
    const { piece, snapCol: col, snapRow: row, valid } = dragState;
    const color = t.blocks[piece.color % t.blocks.length];
    const now   = Date.now();

    const pulse = valid ? (0.82 + 0.1 * Math.sin(now * 0.007)) : 1;
    const pad = 3, radius = Math.max(5, cs * 0.22);

    // ── 1. Bounding-box glow behind the whole piece (makes it pop out) ─────
    if (valid) {
      const cells = piece.cells;
      const minC  = Math.min(...cells.map(([dx]) => col + dx));
      const maxC  = Math.max(...cells.map(([dx]) => col + dx));
      const minR  = Math.min(...cells.map(([,dy]) => row + dy));
      const maxR  = Math.max(...cells.map(([,dy]) => row + dy));
      const bx = minC * cs, by = minR * cs;
      const bw = (maxC - minC + 1) * cs, bh = (maxR - minR + 1) * cs;

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur  = cs * 0.9;
      ctx.globalAlpha = pulse * 0.22;
      ctx.fillStyle   = color;
      this._rr(ctx, bx + pad, by + pad, bw - pad*2, bh - pad*2, radius + 4);
      ctx.fill();
      ctx.restore();
    }

    // ── 2. Per-cell blocks ──────────────────────────────────────────────────
    for (const [dx, dy] of piece.cells) {
      const c = col + dx, r = row + dy;
      const x = c * cs, y = r * cs;
      const w = cs - pad * 2, h = cs - pad * 2;

      ctx.save();

      if (!valid) {
        // ── INVALID: translucent red + X ────────────────────────────────
        ctx.globalAlpha = 0.55;
        ctx.fillStyle   = '#ff4d4d';
        this._rr(ctx, x + pad, y + pad, w, h, radius);
        ctx.fill();

        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth   = 2;
        const cx = x + cs/2, cy = y + cs/2, s = cs * 0.17;
        ctx.beginPath(); ctx.moveTo(cx-s,cy-s); ctx.lineTo(cx+s,cy+s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx+s,cy-s); ctx.lineTo(cx-s,cy+s); ctx.stroke();
      } else {
        // ── VALID: full-opacity block with strong glow ───────────────────
        // Glow
        ctx.shadowColor = color + 'cc';
        ctx.shadowBlur  = cs * 0.5;
        ctx.globalAlpha = pulse;
        ctx.fillStyle   = color;
        this._rr(ctx, x + pad, y + pad, w, h, radius);
        ctx.fill();
        ctx.shadowBlur  = 0;
        ctx.shadowColor = 'transparent';

        // Bottom depth edge
        ctx.fillStyle = this._darken(color, 0.28);
        this._rr(ctx, x+pad+1, y+pad + h*0.76, w-2, h*0.24, radius);
        ctx.fill();

        // Top shine
        const shine = ctx.createLinearGradient(x+pad, y+pad, x+pad, y+pad+h*0.5);
        shine.addColorStop(0, 'rgba(255,255,255,0.52)');
        shine.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = shine;
        this._rr(ctx, x+pad+2, y+pad+2, w-4, h*0.44, radius-1);
        ctx.fill();

        // Bright animated border
        ctx.globalAlpha  = pulse * 0.9;
        ctx.strokeStyle  = 'rgba(255,255,255,0.75)';
        ctx.lineWidth    = 2;
        this._rr(ctx, x+pad, y+pad, w, h, radius);
        ctx.stroke();
      }

      ctx.restore();
    }

    // ── 3. Animated outer border around the whole piece footprint ───────────
    if (valid) {
      const cells = piece.cells;
      const minC  = Math.min(...cells.map(([dx]) => col + dx));
      const maxC  = Math.max(...cells.map(([dx]) => col + dx));
      const minR  = Math.min(...cells.map(([,dy]) => row + dy));
      const maxR  = Math.max(...cells.map(([,dy]) => row + dy));
      const bx = minC * cs, by = minR * cs;
      const bw = (maxC - minC + 1) * cs, bh = (maxR - minR + 1) * cs;

      ctx.save();
      ctx.globalAlpha = pulse * 0.6;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth   = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -(now * 0.04 % 10);
      this._rr(ctx, bx + 1, by + 1, bw - 2, bh - 2, radius + 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
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
    const bx  = col * cs + pad + (cs - pad * 2) * (1 - scale) / 2;
    const by  = row * cs + pad + (cs - pad * 2) * (1 - scale) / 2;
    const r   = Math.max(4, cs * 0.2);

    ctx.save();
    ctx.globalAlpha = alpha;

    // Block glow
    if (t.glowBlocks) {
      ctx.shadowColor = color + '99';
      ctx.shadowBlur  = cs * 0.4;
    } else {
      ctx.shadowColor = color + '33';
      ctx.shadowBlur  = 6;
      ctx.shadowOffsetY = 2;
    }

    ctx.fillStyle = color;
    this._rr(ctx, bx, by, bw, bh, r);
    ctx.fill();

    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.shadowColor = 'transparent';

    // Bottom edge (depth)
    ctx.fillStyle = this._darken(color, 0.25);
    this._rr(ctx, bx + 2, by + bh * 0.75, bw - 4, bh * 0.25, r);
    ctx.fill();

    // Top shine
    const shine = ctx.createLinearGradient(bx, by, bx, by + bh * 0.5);
    shine.addColorStop(0, 'rgba(255,255,255,0.38)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    this._rr(ctx, bx + 2, by + 2, bw - 4, bh * 0.44, r - 1);
    ctx.fill();

    ctx.restore();
  }

  // ── FLASH (row/col highlight on clear) ───────────────────────────────────
  _drawFlashes(t) {
    const { ctx, cellSize, boardW, boardH } = this;
    const now = Date.now();
    this.flashes = this.flashes.filter(f => {
      const age = (now - f.start) / f.duration;
      if (age >= 1) return false;
      // Ease out flash
      const ease = 1 - age * age;
      ctx.save();
      ctx.globalAlpha = ease * 0.55;

      // White flash that fades
      const grad = f.type === 'row'
        ? ctx.createLinearGradient(0, f.index * cellSize, 0, (f.index + 1) * cellSize)
        : ctx.createLinearGradient(f.index * cellSize, 0, (f.index + 1) * cellSize, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.3, f.color + 'ff');
      grad.addColorStop(0.7, f.color + 'ff');
      grad.addColorStop(1, 'rgba(255,255,255,0)');

      if (f.type === 'row') {
        ctx.fillStyle = grad;
        ctx.fillRect(0, f.index * cellSize, boardW, cellSize);
      } else {
        ctx.fillStyle = grad;
        ctx.fillRect(f.index * cellSize, 0, cellSize, boardH);
      }
      ctx.restore();
      return true;
    });
  }

  // ── SHOCKWAVES ────────────────────────────────────────────────────────────
  _drawShockwaves(t) {
    const { ctx } = this;
    const now = Date.now();
    this.shockwaves = this.shockwaves.filter(sw => {
      const age = (now - sw.born) / sw.life;
      if (age >= 1) return false;
      const ease = 1 - (1 - age) * (1 - age); // ease in
      const r    = sw.maxRadius * ease;
      ctx.save();
      ctx.globalAlpha = (1 - age) * 0.5;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth   = (1 - age) * 4;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return true;
    });
  }

  // ── PARTICLES ─────────────────────────────────────────────────────────────
  _drawParticles() {
    const { ctx } = this;
    const now = Date.now();

    this.particles = this.particles.filter(p => {
      const elapsed = now - p.born;
      const age     = elapsed / p.life;
      if (age >= 1) return false;

      const dt = elapsed / 1000; // seconds
      const px = p.x  + p.vx * dt;
      const py = p.y  + p.vy * dt + 0.5 * p.gravity * dt * dt;
      const alpha = age < 0.3 ? 1 : 1 - (age - 0.3) / 0.7;
      const size  = p.size * (1 - age * 0.5) * (age < 0.1 ? age * 10 : 1);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = p.color;

      if (p.shape === 'square') {
        const spin = (p.spin || 0) + (p.spinV || 0) * dt;
        ctx.translate(px, py);
        ctx.rotate(spin);
        ctx.fillRect(-size / 2, -size / 2, size, size);
      } else if (p.shape === 'star') {
        ctx.translate(px, py);
        ctx.rotate((p.spin || 0) + (p.spinV || 0) * dt);
        this._drawStar(ctx, 0, 0, size * 0.5, size, 4);
      } else if (p.shape === 'diamond') {
        ctx.translate(px, py);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-size / 2, -size / 2, size, size);
      } else {
        // circle (default)
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      return true;
    });
  }

  _drawStar(ctx, x, y, r1, r2, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const r     = i % 2 === 0 ? r2 : r1;
      i === 0 ? ctx.moveTo(x + r * Math.cos(angle), y + r * Math.sin(angle))
              : ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
    }
    ctx.closePath();
    ctx.fill();
  }

  // ── RINGS (placement pop) ─────────────────────────────────────────────────
  _drawRings(t) {
    const { ctx } = this;
    const now = Date.now();
    this.rings = this.rings.filter(rg => {
      const age = (now - rg.born) / rg.life;
      if (age >= 1) return false;
      const ease = 1 - (1 - age) * (1 - age) * (1 - age);
      ctx.save();
      ctx.globalAlpha = (1 - age) * 0.7;
      ctx.strokeStyle = rg.color;
      ctx.lineWidth   = (1 - age) * 3;
      ctx.beginPath();
      ctx.roundRect
        ? ctx.roundRect(rg.x - rg.r * ease, rg.y - rg.r * ease, rg.r * ease * 2, rg.r * ease * 2, 6)
        : ctx.rect(rg.x - rg.r * ease, rg.y - rg.r * ease, rg.r * ease * 2, rg.r * ease * 2);
      ctx.stroke();
      ctx.restore();
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
      const y = f.y - 70 * (age * age);
      const a = age < 0.5 ? 1 : 1 - (age - 0.5) / 0.5;
      const s = 1 + (age < 0.15 ? (age / 0.15) * 0.25 : 0.25 * (1 - (age - 0.15) / 0.85));

      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(f.x, y);
      ctx.scale(s, s);
      ctx.font        = `900 ${f.size}px -apple-system, SF Pro Rounded, sans-serif`;
      ctx.textAlign   = 'center';
      ctx.textBaseline= 'middle';

      // Text shadow
      ctx.shadowColor  = f.color + '88';
      ctx.shadowBlur   = 12;
      ctx.fillStyle    = '#fff';
      ctx.fillText(f.text, 0, 0);
      ctx.shadowBlur   = 0;
      ctx.fillStyle    = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
      return true;
    });
  }

  // ── TRAY PIECE PREVIEW ────────────────────────────────────────────────────
  drawPiecePreview(canvas, piece, themeName) {
    if (!canvas || !piece) return;
    const t   = THEMES[themeName] || THEMES.dark;
    const ctx = canvas.getContext('2d');
    const pw  = getPieceWidth(piece);
    const ph  = getPieceHeight(piece);
    const pad = 8;
    const cs  = Math.floor(Math.min(
      (canvas.width  - pad * 2) / pw,
      (canvas.height - pad * 2) / ph,
      canvas.width / 4.2
    ));
    const ox  = Math.floor((canvas.width  - pw * cs) / 2);
    const oy  = Math.floor((canvas.height - ph * cs) / 2);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const [dx, dy] of piece.cells) {
      const color  = t.blocks[piece.color % t.blocks.length];
      const bpad   = 2;
      const bx     = ox + dx * cs + bpad;
      const by     = oy + dy * cs + bpad;
      const bw     = cs - bpad * 2;
      const bh     = cs - bpad * 2;
      const radius = Math.max(2, cs * 0.2);

      // Glow
      ctx.shadowColor = color + (t.glowBlocks ? '99' : '44');
      ctx.shadowBlur  = t.glowBlocks ? cs * 0.35 : cs * 0.12;
      ctx.fillStyle   = color;
      this._rr(ctx, bx, by, bw, bh, radius);
      ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';

      // Edge
      ctx.fillStyle = this._darken(color, 0.22);
      this._rr(ctx, bx + 1, by + bh * 0.76, bw - 2, bh * 0.24, radius);
      ctx.fill();

      // Shine
      const g = ctx.createLinearGradient(bx, by, bx, by + bh * 0.5);
      g.addColorStop(0, 'rgba(255,255,255,0.38)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      this._rr(ctx, bx + 1, by + 1, bw - 2, bh * 0.44, radius - 1);
      ctx.fill();
    }
  }

  // ── DRAG FLOATING ELEMENT ─────────────────────────────────────────────────
  // Floats above finger — anchored so the piece center is above the touch point
  showDragFloat(piece, px, py, themeName) {
    this.hideDragFloat();
    const pw = getPieceWidth(piece);
    const ph = getPieceHeight(piece);
    // Use larger cell size for the float preview so it's always easy to see
    const cs = Math.max(this.cellSize, 40);

    const el  = document.createElement('canvas');
    el.width  = pw * cs + 8;
    el.height = ph * cs + 8;
    // transform: center X on finger, place bottom of piece ~20px above finger
    el.style.cssText = `
      position:fixed;
      pointer-events:none;
      z-index:9999;
      border-radius:${cs * 0.2}px;
      opacity:0.97;
      transform-origin:50% 100%;
      transform:translate(-50%,-100%) translateY(-24px) scale(1.12);
      transition:none;
      will-change:left,top;
      filter:drop-shadow(0 8px 24px rgba(0,0,0,0.55));
    `;
    this.drawPiecePreview(el, piece, themeName);
    el.style.left = px + 'px';
    el.style.top  = py + 'px';
    document.body.appendChild(el);
    this._dragEl = el;
    this._dragPiece = piece;
  }

  moveDragFloat(px, py) {
    if (!this._dragEl) return;
    this._dragEl.style.left = px + 'px';
    this._dragEl.style.top  = py + 'px';
  }

  hideDragFloat() {
    if (this._dragEl) {
      this._dragEl.remove();
      this._dragEl = null;
    }
  }

  // ── EFFECTS ───────────────────────────────────────────────────────────────

  /**
   * triggerLineClear — beautiful premium explosion
   * @param {number[]} rows - cleared row indices
   * @param {number[]} cols - cleared col indices
   * @param {number[][]} grid - the grid BEFORE clearing (to get block colors)
   */
  triggerLineClear(rows, cols, gridSnapshot) {
    const t   = THEMES[this.theme] || THEMES.dark;
    const now = Date.now();
    const cs  = this.cellSize;
    const gs  = this.gridSize;

    const totalLines = rows.length + cols.length;

    // ── Flash sweeps ──────────────────────────────────────────────────────
    rows.forEach((r, i) => {
      this.flashes.push({
        type: 'row', index: r, start: now + i * 30,
        duration: 380, color: t.accent,
      });
    });
    cols.forEach((c, i) => {
      this.flashes.push({
        type: 'col', index: c, start: now + i * 30,
        duration: 380, color: t.accent,
      });
    });

    // ── Center shockwave ─────────────────────────────────────────────────
    const bw = this.boardW, bh = this.boardH;
    this.shockwaves.push({
      x: bw / 2, y: bh / 2,
      maxRadius: Math.max(bw, bh) * 0.7,
      born: now, life: 600,
      color: t.accent,
    });
    if (totalLines >= 3) {
      setTimeout(() => this.shockwaves.push({
        x: bw / 2, y: bh / 2,
        maxRadius: Math.max(bw, bh) * 0.9,
        born: Date.now(), life: 700,
        color: t.blocks[3],
      }), 80);
    }

    // ── Per-cell explosion ────────────────────────────────────────────────
    const emitCell = (col, row, color, delay) => {
      const cx = col * cs + cs / 2;
      const cy = row * cs + cs / 2;

      setTimeout(() => {
        const baseColor = color || t.particleColor;
        const colors    = [baseColor, t.blocks[(t.blocks.indexOf(baseColor) + 3) % t.blocks.length], '#ffffff'];

        // Burst: 10-14 particles per cell
        const count = 8 + Math.floor(Math.random() * 6);
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
          const speed = 60 + Math.random() * 180;
          const shapes = ['circle','circle','square','square','star','diamond'];
          const shape  = shapes[Math.floor(Math.random() * shapes.length)];
          const sz     = (shape === 'star' ? 6 : 3) + Math.random() * (cs * 0.28);

          this.particles.push({
            x:      cx + (Math.random() - 0.5) * cs * 0.4,
            y:      cy + (Math.random() - 0.5) * cs * 0.4,
            vx:     Math.cos(angle) * speed,
            vy:     Math.sin(angle) * speed - 80 - Math.random() * 80,
            gravity:280 + Math.random() * 120,
            color:  colors[Math.floor(Math.random() * colors.length)],
            size:   sz,
            shape,
            spin:   Math.random() * Math.PI * 2,
            spinV:  (Math.random() - 0.5) * 12,
            born:   Date.now(),
            life:   500 + Math.random() * 600,
          });
        }

        // Sparkle ring from each cell
        this.shockwaves.push({
          x: cx, y: cy,
          maxRadius: cs * 1.2,
          born: Date.now(), life: 350,
          color: baseColor,
        });

      }, delay);
    };

    // Stagger emissions along rows
    rows.forEach(r => {
      for (let c = 0; c < gs; c++) {
        const colorId = gridSnapshot?.[r]?.[c];
        const color   = colorId ? (THEMES[this.theme].blocks[(colorId - 1) % THEMES[this.theme].blocks.length]) : t.particleColor;
        emitCell(c, r, color, c * 18);
      }
    });

    // Stagger emissions along cols
    cols.forEach(c => {
      for (let r = 0; r < gs; r++) {
        // Skip already-done rows
        if (rows.includes(r)) continue;
        const colorId = gridSnapshot?.[r]?.[c];
        const color   = colorId ? (THEMES[this.theme].blocks[(colorId - 1) % THEMES[this.theme].blocks.length]) : t.particleColor;
        emitCell(c, r, color, r * 18 + rows.length * 50);
      }
    });

    // ── Screen shake ─────────────────────────────────────────────────────
    this.shakeTime = totalLines >= 3 ? 16 : 9;
    this.shakeAmt  = totalLines >= 3 ? 8  : 4;
  }

  // Placement pop rings
  animatePlacement(piece, col, row) {
    const t  = THEMES[this.theme] || THEMES.dark;
    const cs = this.cellSize;
    const now = Date.now();

    for (const [dx, dy] of piece.cells) {
      const r = row + dy, c = col + dx;
      if (r >= 0 && r < this.gridSize && c >= 0 && c < this.gridSize) {
        // Scale bounce
        this.blockScale[r][c] = 1.22;
        const rr = r, cc = c;
        setTimeout(() => { if (this.blockScale[rr]) this.blockScale[rr][cc] = 1; }, 130);

        // Tiny pop ring
        const color = t.blocks[piece.color % t.blocks.length];
        this.rings.push({
          x: c * cs + cs / 2, y: r * cs + cs / 2,
          r: cs * 0.25, life: 280, born: now,
          color,
        });
      }
    }
  }

  addFloatText(text, x, y, color, size = 22) {
    this.floatTexts.push({ text, x, y, color, size, born: Date.now(), life: 1100 });
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────
  _rr(ctx, x, y, w, h, r) {
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

  _darken(hex, amount) {
    try {
      const r = parseInt(hex.slice(1,3), 16);
      const g = parseInt(hex.slice(3,5), 16);
      const b = parseInt(hex.slice(5,7), 16);
      return `rgb(${Math.round(r*(1-amount))},${Math.round(g*(1-amount))},${Math.round(b*(1-amount))})`;
    } catch { return hex; }
  }

  getCellFromXY(x, y) {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    if (col < 0 || col >= this.gridSize || row < 0 || row >= this.gridSize) return null;
    return { col, row };
  }
}
