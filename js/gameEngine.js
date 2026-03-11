// ─── GAME ENGINE ────────────────────────────────────────────────────────────

class GameEngine {
  constructor(opts = {}) {
    this.gridSize   = opts.gridSize || 8;
    this.mode       = opts.mode || 'classic';   // classic|timed|challenge|zen|hard|story
    this.level      = opts.level || null;
    this.onScore    = opts.onScore    || (() => {});
    this.onGameOver = opts.onGameOver || (() => {});
    this.onLineClear= opts.onLineClear|| (() => {});
    this.onLevelWin = opts.onLevelWin || (() => {});
    this.reset();
  }

  reset() {
    this.grid       = Array.from({ length: this.gridSize }, () => Array(this.gridSize).fill(0));
    this.score      = 0;
    this.combo      = 0;
    this.maxCombo   = 0;
    this.linesCleared   = 0;
    this.columnsCleared = 0;
    this.crossClears    = 0;
    this.perfectClears  = 0;
    this.piecesPlaced   = 0;
    this.pieces     = getThreePieces(this._difficulty());
    this.usedUndo   = false;
    this.gameOver   = false;
    this.won        = false;
    this.prevGrid   = null;
    this.prevPieces = null;
    this.prevScore  = 0;
    this.timerStart = Date.now();
    this.elapsed    = 0;

    if (this.level?.preset) {
      this.grid = this.level.preset.map(r => [...r]);
    }
    this._checkGameOver();
  }

  _difficulty() {
    if (this.mode === 'hard') return 'hard';
    if (this.level) return this.level.difficulty || 'medium';
    return 'medium';
  }

  // ── Can Place ──────────────────────────────────────────────────────────────
  canPlace(piece, col, row) {
    for (const [dx, dy] of piece.cells) {
      const nx = col + dx, ny = row + dy;
      if (nx < 0 || nx >= this.gridSize || ny < 0 || ny >= this.gridSize) return false;
      if (this.grid[ny][nx] !== 0) return false;
    }
    return true;
  }

  hasAnyValidPlacement(piece) {
    for (let r = 0; r < this.gridSize; r++)
      for (let c = 0; c < this.gridSize; c++)
        if (this.canPlace(piece, c, r)) return true;
    return false;
  }

  // ── Place Piece ────────────────────────────────────────────────────────────
  placePiece(pieceIndex, col, row) {
    const piece = this.pieces[pieceIndex];
    if (!piece || !this.canPlace(piece, col, row)) return false;

    // Save state for undo
    this.prevGrid   = this.grid.map(r => [...r]);
    this.prevPieces = this.pieces.map(p => p ? { ...p, cells: p.cells.map(c => [...c]) } : null);
    this.prevScore  = this.score;

    // Place
    const colorId = piece.color + 1;
    for (const [dx, dy] of piece.cells) {
      this.grid[row + dy][col + dx] = colorId;
    }
    this.pieces[pieceIndex] = null;
    this.piecesPlaced++;

    // Clear lines
    const cleared = this._clearLines();

    // Refill if all pieces used
    if (this.pieces.every(p => p === null)) {
      this.pieces = getThreePieces(this._difficulty());
    }

    // Combo
    if (cleared.rows + cleared.cols > 0) {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
    } else {
      this.combo = 0;
    }

    // Score
    const pts = this._calcScore(cleared);
    this.score += pts;
    this.onScore(this.score, pts, cleared);

    // Level win check
    if (this.level && isObjectiveMet(this.level.objective, this)) {
      this.won = true;
      this.onLevelWin(this.level, this.score);
      return true;
    }

    // Game over check
    this._checkGameOver();
    return true;
  }

  _clearLines() {
    const cleared = { rows: [], cols: [], rowScore: 0, colScore: 0 };

    // Check rows
    for (let r = 0; r < this.gridSize; r++) {
      if (this.grid[r].every(v => v !== 0)) cleared.rows.push(r);
    }
    // Check cols
    for (let c = 0; c < this.gridSize; c++) {
      if (this.grid.every(row => row[c] !== 0)) cleared.cols.push(c);
    }

    // Clear rows
    cleared.rows.forEach(r => {
      this.grid[r] = Array(this.gridSize).fill(0);
      this.linesCleared++;
    });
    // Clear cols
    cleared.cols.forEach(c => {
      for (let r = 0; r < this.gridSize; r++) this.grid[r][c] = 0;
      this.columnsCleared++;
    });

    // Cross clear
    if (cleared.rows.length > 0 && cleared.cols.length > 0) this.crossClears++;

    // Perfect clear
    if (this.grid.every(row => row.every(v => v === 0))) this.perfectClears++;

    if (cleared.rows.length + cleared.cols.length > 0) {
      this.onLineClear(cleared);
    }
    return cleared;
  }

  _calcScore({ rows, cols }) {
    const lineScore = [0, 10, 30, 60, 120, 200, 300, 450, 600, 800, 1000];
    let total = 0;
    const total_lines = rows.length + cols.length;
    total += lineScore[Math.min(total_lines, lineScore.length - 1)];

    // Cross bonus
    if (rows.length > 0 && cols.length > 0) total *= 2;

    // Combo bonus
    if (this.combo > 1) total = Math.floor(total * (1 + (this.combo - 1) * 0.1));

    return total;
  }

  _checkGameOver() {
    if (this.mode === 'zen') return;
    const activePieces = this.pieces.filter(Boolean);
    if (activePieces.length === 0) return;
    const hasMove = activePieces.some(p => this.hasAnyValidPlacement(p));
    if (!hasMove) {
      this.gameOver = true;
      this.onGameOver(this.score);
    }
  }

  // ── Undo ───────────────────────────────────────────────────────────────────
  undo() {
    if (this.usedUndo || !this.prevGrid) return false;
    this.usedUndo  = true;
    this.grid      = this.prevGrid;
    this.pieces    = this.prevPieces;
    this.score     = this.prevScore;
    this.prevGrid  = null;
    this.prevPieces= null;
    return true;
  }

  // ── Shuffle ────────────────────────────────────────────────────────────────
  shuffle() {
    this.pieces = getThreePieces(this._difficulty());
    this._checkGameOver();
  }

  // ── Ghost Preview ──────────────────────────────────────────────────────────
  getGhostRow(piece, col) {
    for (let row = 0; row <= this.gridSize; row++) {
      if (!this.canPlace(piece, col, row)) return row - 1;
    }
    return this.gridSize - 1;
  }

  // ── Serialize / Deserialize ────────────────────────────────────────────────
  serialize() {
    return {
      grid: this.grid,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      linesCleared: this.linesCleared,
      piecesPlaced: this.piecesPlaced,
      pieces: this.pieces,
      usedUndo: this.usedUndo,
      mode: this.mode,
      elapsed: this.elapsed,
    };
  }

  deserialize(data) {
    Object.assign(this, data);
    this.grid = data.grid;
    this.pieces = data.pieces;
  }
}
