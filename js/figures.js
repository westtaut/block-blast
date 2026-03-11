// ─── FIGURES / PIECES ──────────────────────────────────────────────────────
const FIGURES = {
  I1: { cells: [[0,0],[1,0],[2,0],[3,0]], color: 0, name:'I-4' },
  I2: { cells: [[0,0],[0,1],[0,2],[0,3]], color: 0, name:'I-4v' },
  I3: { cells: [[0,0],[1,0],[2,0]], color: 1, name:'I-3' },
  I4: { cells: [[0,0],[0,1],[0,2]], color: 1, name:'I-3v' },
  I5: { cells: [[0,0],[1,0]], color: 2, name:'I-2' },
  I6: { cells: [[0,0],[0,1]], color: 2, name:'I-2v' },
  I7: { cells: [[0,0],[1,0],[2,0],[3,0],[4,0]], color: 6, name:'I-5' },
  I8: { cells: [[0,0],[0,1],[0,2],[0,3],[0,4]], color: 6, name:'I-5v' },

  O1: { cells: [[0,0],[1,0],[0,1],[1,1]], color: 3, name:'O-2x2' },
  O2: { cells: [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]], color: 4, name:'O-3x3' },
  O3: { cells: [[0,0]], color: 5, name:'Single' },

  L1: { cells: [[0,0],[0,1],[0,2],[1,2]], color: 6, name:'L' },
  L2: { cells: [[0,0],[1,0],[0,1],[0,2]], color: 6, name:'L-flip' },
  L3: { cells: [[1,0],[1,1],[0,2],[1,2]], color: 6, name:'L-rot' },
  L4: { cells: [[0,0],[1,0],[1,1],[1,2]], color: 6, name:'L-rot2' },

  J1: { cells: [[1,0],[1,1],[0,2],[1,2]], color: 7, name:'J' },
  J2: { cells: [[0,0],[0,1],[1,1],[0,2]], color: 7, name:'J-flip' },
  J3: { cells: [[0,0],[1,0],[0,1],[0,2]], color: 7, name:'J-rot' },
  J4: { cells: [[0,0],[1,0],[1,1],[1,2]], color: 7, name:'J-rot2' },

  T1: { cells: [[0,0],[1,0],[2,0],[1,1]], color: 8, name:'T' },
  T2: { cells: [[1,0],[0,1],[1,1],[1,2]], color: 8, name:'T-rot' },
  T3: { cells: [[1,0],[0,1],[1,1],[2,1]], color: 8, name:'T-rot2' },
  T4: { cells: [[0,0],[0,1],[1,1],[0,2]], color: 8, name:'T-rot3' },

  S1: { cells: [[1,0],[2,0],[0,1],[1,1]], color: 9, name:'S' },
  S2: { cells: [[0,0],[0,1],[1,1],[1,2]], color: 9, name:'S-rot' },

  Z1: { cells: [[0,0],[1,0],[1,1],[2,1]], color: 10, name:'Z' },
  Z2: { cells: [[1,0],[0,1],[1,1],[0,2]], color: 10, name:'Z-rot' },

  C1: { cells: [[0,0],[2,0],[0,1],[2,1],[0,2],[2,2]], color: 11, name:'C-frame' },
  CR: { cells: [[1,0],[0,1],[1,1],[2,1],[1,2]], color: 11, name:'Cross' },
  CR2:{ cells: [[0,0],[2,0],[1,1],[0,2],[2,2]], color: 12, name:'X' },
  U1: { cells: [[0,0],[2,0],[0,1],[1,1],[2,1]], color: 12, name:'U' },

  COR1:{ cells: [[0,0],[0,1],[1,1]], color: 3, name:'Corner-S' },
  COR2:{ cells: [[1,0],[0,1],[1,1]], color: 3, name:'Corner-S2' },
  COR3:{ cells: [[0,0],[1,0],[0,1]], color: 3, name:'Corner-S3' },
  COR4:{ cells: [[0,0],[1,0],[1,1]], color: 3, name:'Corner-S4' },
  COR5:{ cells: [[0,0],[0,1],[0,2],[1,2]], color: 4, name:'Corner-L' },
  COR6:{ cells: [[0,0],[1,0],[2,0],[0,1]], color: 4, name:'Corner-L2' },
  COR7:{ cells: [[0,0],[1,0],[2,0],[2,1]], color: 4, name:'Corner-L3' },
  COR8:{ cells: [[2,0],[0,1],[1,1],[2,1]], color: 4, name:'Corner-L4' },
};

// Difficulty tiers
const EASY_PIECES   = ['I3','I4','I5','I6','O1','O3','COR1','COR2','COR3','COR4'];
const MEDIUM_PIECES = ['I1','I2','L1','L2','L3','L4','J1','J2','T1','T2','T3','T4','S1','S2','Z1','Z2','COR5','COR6','COR7','COR8'];
const HARD_PIECES   = ['I7','I8','O2','CR','CR2','U1','C1'];

function getRandomPiece(difficulty = 'medium') {
  let pool;
  if (difficulty === 'easy')   pool = [...EASY_PIECES, ...EASY_PIECES, ...MEDIUM_PIECES];
  else if (difficulty === 'hard') pool = [...MEDIUM_PIECES, ...HARD_PIECES, ...HARD_PIECES];
  else pool = [...EASY_PIECES, ...MEDIUM_PIECES, ...MEDIUM_PIECES, ...HARD_PIECES];
  const key = pool[Math.floor(Math.random() * pool.length)];
  return { ...FIGURES[key], key };
}

function getThreePieces(difficulty = 'medium') {
  return [getRandomPiece(difficulty), getRandomPiece(difficulty), getRandomPiece(difficulty)];
}

// Normalize piece so top-left cell is at (0,0)
function normalizePiece(piece) {
  const minX = Math.min(...piece.cells.map(c => c[0]));
  const minY = Math.min(...piece.cells.map(c => c[1]));
  return { ...piece, cells: piece.cells.map(([x,y]) => [x - minX, y - minY]) };
}

function getPieceWidth(piece)  { return Math.max(...piece.cells.map(c => c[0])) + 1; }
function getPieceHeight(piece) { return Math.max(...piece.cells.map(c => c[1])) + 1; }
