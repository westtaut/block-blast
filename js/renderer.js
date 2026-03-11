// ─── CANVAS RENDERER ─────────────────────────────────────────────────────────

class Renderer {
  constructor(canvas, opts = {}) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.theme   = opts.theme || 'dark';
    this.gridSize= opts.gridSize || 8;

    this.particles     = [];
    this.clearAnim     = [];  // rows/cols being cleared
    this.shakeTime     = 0;
    this.shakeAmount   = 0;
    this.floatTexts    = [];
    this.blockScale    = Array.from({length:this.gridSize},()=>Array(this.gridSize).fill(1));
    this.blockAlpha    = Array.from({length:this.gridSize},()=>Array(this.gridSize).fill(1));

    this._resize();
  }

  _resize() {
    const size = Math.min(window.innerWidth, 420);
    const padding = 16;
    this.cellSize = Math.floor((size - padding * 2) / this.gridSize);
    this.boardW   = this.cellSize * this.gridSize;
    this.boardH   = this.cellSize * this.gridSize;
    this.canvas.width  = this.boardW;
    this.canvas.height = this.boardH;
    this.canvas.style.width  = this.boardW + 'px';
    this.canvas.style.height = this.boardH + 'px';
  }

  resize() { this._resize(); }

  // ── Main Draw ────────────────────────────────────────────────────────────
  draw(engine, dragState) {
    const { ctx, cellSize, boardW, boardH } = this;
    const t = THEMES[this.theme] || THEMES.dark;

    ctx.clearRect(0, 0, boardW, boardH);

    // Shake
    ctx.save();
    if (this.shakeTime > 0) {
      const s = this.shakeAmount * (this.shakeTime / 10);
      ctx.translate((Math.random()-0.5)*s, (Math.random()-0.5)*s);
    }

    // Grid background
    this._drawGrid(t);

    // Ghost preview
    if (dragState?.piece && dragState.gridCol !== null) {
      this._drawGhost(engine, dragState, t);
    }

    // Placed blocks
    this._drawBlocks(engine.grid, t);

    // Clear animations
    this._drawClearAnims(t);

    // Particles
    this._drawParticles();

    // Float texts
    this._drawFloatTexts();

    ctx.restore();

    // Decay
    if (this.shakeTime > 0) this.shakeTime--;
  }

  _drawGrid(t) {
    const { ctx, cellSize, boardW, boardH, gridSize } = this;

    // Background
    ctx.fillStyle = t.gridBg;
    this._roundRect(ctx, 0, 0, boardW, boardH, 16);
    ctx.fill();

    // Grid lines
    ctx.strokeStyle = t.gridLine;
    ctx.lineWidth = 1;
    for (let i = 1; i < gridSize; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 4);
      ctx.lineTo(i * cellSize, boardH - 4);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(4, i * cellSize);
      ctx.lineTo(boardW - 4, i * cellSize);
      ctx.stroke();
    }

    // Cell dots
    ctx.fillStyle = t.gridLine;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const cx = c * cellSize + cellSize/2;
        const cy = r * cellSize + cellSize/2;
        ctx.beginPath();
        ctx.arc(cx, cy, 1.5, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  _drawBlocks(grid, t) {
    const { ctx, cellSize, gridSize } = this;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const v = grid[r][c];
        if (v === 0) continue;
        const color = t.blocks[(v-1) % t.blocks.length];
        const sc = this.blockScale[r][c];
        const al = this.blockAlpha[r][c];
        this._drawBlock(ctx, c, r, cellSize, color, sc, al, t);
      }
    }
  }

  _drawBlock(ctx, col, row, cs, color, scale=1, alpha=1, t) {
    const pad = 3;
    const x = col * cs + pad + (cs - pad*2) * (1-scale) / 2;
    const y = row * cs + pad + (cs - pad*2) * (1-scale) / 2;
    const w = (cs - pad*2) * scale;
    const h = (cs - pad*2) * scale;
    const r = Math.max(3, Math.floor(cs * 0.18));

    ctx.globalAlpha = alpha;

    // Shadow
    ctx.shadowColor = color + '66';
    ctx.shadowBlur  = t.glowBlocks ? cs * 0.4 : cs * 0.15;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = t.glowBlocks ? 0 : cs * 0.08;

    // Block body
    ctx.fillStyle = color;
    this._roundRect(ctx, x, y, w, h, r);
    ctx.fill();

    // Highlight
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    const grad = ctx.createLinearGradient(x, y, x, y + h * 0.5);
    grad.addColorStop(0, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    this._roundRect(ctx, x + 2, y + 2, w - 4, h * 0.45, r - 1);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  _drawGhost(engine, { piece, gridCol, gridRow }, t) {
    const { ctx, cellSize } = this;
    ctx.globalAlpha = 0.2;
    for (const [dx, dy] of piece.cells) {
      const c = gridCol + dx, r = gridRow + dy;
      if (c < 0 || c >= this.gridSize || r < 0 || r >= this.gridSize) continue;
      const color = t.blocks[piece.color % t.blocks.length];
      ctx.fillStyle = color;
      this._roundRect(ctx, c*cellSize+3, r*cellSize+3, cellSize-6, cellSize-6, Math.max(3,cellSize*0.18));
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawClearAnims(t) {
    const { ctx, cellSize, boardW, boardH } = this;
    const now = Date.now();
    this.clearAnim = this.clearAnim.filter(a => {
      const age = now - a.start;
      if (age > 400) return false;
      const progress = age / 400;
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = t.accent;
      if (a.type === 'row') {
        ctx.fillRect(0, a.index * cellSize + 2, boardW, cellSize - 4);
      } else {
        ctx.fillRect(a.index * cellSize + 2, 0, cellSize - 4, boardH);
      }
      ctx.globalAlpha = 1;
      return true;
    });
  }

  _drawParticles() {
    const { ctx } = this;
    const now = Date.now();
    this.particles = this.particles.filter(p => {
      const age = (now - p.born) / p.life;
      if (age >= 1) return false;
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = p.color;
      const px = p.x + p.vx * (now - p.born) / 16;
      const py = p.y + p.vy * (now - p.born) / 16 + 0.5 * p.gravity * ((now-p.born)/16)**2;
      const s = p.size * (1 - age * 0.5);
      ctx.beginPath();
      ctx.arc(px, py, s, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return true;
    });
  }

  _drawFloatTexts() {
    const { ctx } = this;
    const now = Date.now();
    this.floatTexts = this.floatTexts.filter(f => {
      const age = (now - f.born) / f.life;
      if (age >= 1) return false;
      const y = f.y - 60 * age;
      ctx.globalAlpha = age < 0.7 ? 1 : 1 - (age - 0.7) / 0.3;
      ctx.fillStyle = f.color;
      ctx.font = `bold ${f.size}px -apple-system, SF Pro Display, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, y);
      ctx.globalAlpha = 1;
      return true;
    });
  }

  // ── Piece Preview (for tray) ─────────────────────────────────────────────
  drawPiecePreview(canvas, piece, themeName, scale=1, used=false) {
    if (!canvas || !piece) return;
    const t   = THEMES[themeName] || THEMES.dark;
    const ctx = canvas.getContext('2d');
    const cs  = Math.floor(canvas.width / 5);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (used) {
      ctx.globalAlpha = 0.3;
    }

    const pw = getPieceWidth(piece);
    const ph = getPieceHeight(piece);
    const ox = Math.floor((canvas.width  - pw * cs) / 2);
    const oy = Math.floor((canvas.height - ph * cs) / 2);

    for (const [dx, dy] of piece.cells) {
      const color = t.blocks[piece.color % t.blocks.length];
      this._drawBlock(ctx, 0, 0, cs, color, scale, 1, t);
      // Actually draw at correct offsets
      const pad=2, x=ox+dx*cs+pad, y=oy+dy*cs+pad, w=cs-pad*2, h=cs-pad*2, r=Math.max(2,cs*0.18);
      ctx.shadowColor = color+'66';
      ctx.shadowBlur = t.glowBlocks ? cs*0.4 : cs*0.12;
      ctx.fillStyle = color;
      this._roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      ctx.shadowBlur=0;
      ctx.shadowColor='transparent';
      const grad=ctx.createLinearGradient(x,y,x,y+h*0.5);
      grad.addColorStop(0,'rgba(255,255,255,0.35)');
      grad.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=grad;
      this._roundRect(ctx,x+1,y+1,w-2,h*0.45,r-1);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── Effects ──────────────────────────────────────────────────────────────
  triggerLineClear(rows, cols, t) {
    const { cellSize, boardW, boardH } = this;
    const theme = THEMES[this.theme];
    const now = Date.now();

    rows.forEach(r => this.clearAnim.push({ type:'row', index:r, start:now }));
    cols.forEach(c => this.clearAnim.push({ type:'col', index:c, start:now }));

    // Particles
    const emitPoints = [];
    rows.forEach(r => {
      for (let c=0;c<this.gridSize;c++) emitPoints.push({ x:c*cellSize+cellSize/2, y:r*cellSize+cellSize/2 });
    });
    cols.forEach(c => {
      for (let r=0;r<this.gridSize;r++) emitPoints.push({ x:c*cellSize+cellSize/2, y:r*cellSize+cellSize/2 });
    });

    emitPoints.forEach(pt => {
      for (let i=0;i<6;i++) {
        const angle = Math.random()*Math.PI*2;
        const speed = 1 + Math.random()*3;
        this.particles.push({
          x:pt.x, y:pt.y,
          vx:Math.cos(angle)*speed,
          vy:Math.sin(angle)*speed - 2,
          gravity:0.15,
          color:theme?.particleColor || '#5b7cff',
          size:2+Math.random()*4,
          born:now,
          life:600+Math.random()*400,
        });
      }
    });

    this.shakeTime   = 8;
    this.shakeAmount = rows.length + cols.length > 2 ? 6 : 3;
  }

  addFloatText(text, x, y, color, size=20) {
    this.floatTexts.push({ text, x, y, color, size, born:Date.now(), life:1000 });
  }

  animatePlacement(piece, col, row) {
    // Scale-down pop effect
    for (const [dx,dy] of piece.cells) {
      const r = row+dy, c = col+dx;
      if (r>=0&&r<this.gridSize&&c>=0&&c<this.gridSize) {
        this.blockScale[r][c] = 1.3;
        setTimeout(()=>{ if(this.blockScale[r]) this.blockScale[r][c]=1; }, 150);
      }
    }
  }

  // ── Utils ────────────────────────────────────────────────────────────────
  _roundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.beginPath();
      ctx.moveTo(x+r,y);
      ctx.lineTo(x+w-r,y);
      ctx.quadraticCurveTo(x+w,y,x+w,y+r);
      ctx.lineTo(x+w,y+h-r);
      ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
      ctx.lineTo(x+r,y+h);
      ctx.quadraticCurveTo(x,y+h,x,y+h-r);
      ctx.lineTo(x,y+r);
      ctx.quadraticCurveTo(x,y,x+r,y);
      ctx.closePath();
    }
  }

  getCellFromXY(x, y) {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    if (col<0||col>=this.gridSize||row<0||row>=this.gridSize) return null;
    return { col, row };
  }
}
