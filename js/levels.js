// ─── LEVELS ────────────────────────────────────────────────────────────────

const STORY_LEVELS = [
  {
    id: 1,
    title: 'First Steps',
    story: 'A blank canvas. Every journey starts with a single block.',
    objective: { type: 'score', target: 50, label: 'Score 50 pts' },
    grid: 8,
    preset: null,
    difficulty: 'easy',
    reward: 10,
  },
  {
    id: 2,
    title: 'Clear the Path',
    story: 'Scattered ruins block the road. Clear them away.',
    objective: { type: 'lines', target: 3, label: 'Clear 3 lines' },
    grid: 8,
    preset: generatePreset(8, [7]),
    difficulty: 'easy',
    reward: 15,
  },
  {
    id: 3,
    title: 'Foundation',
    story: 'Build from the ground up. Score matters now.',
    objective: { type: 'score', target: 150, label: 'Score 150 pts' },
    grid: 8,
    preset: generatePreset(8, [5,6,7]),
    difficulty: 'easy',
    reward: 20,
  },
  {
    id: 4,
    title: 'Column March',
    story: 'Vertical order is the key to this puzzle.',
    objective: { type: 'columns', target: 2, label: 'Clear 2 columns' },
    grid: 8,
    preset: generatePreset(8, [4,5,6,7]),
    difficulty: 'easy',
    reward: 25,
  },
  {
    id: 5,
    title: 'Combo Starter',
    story: 'Chain your clears and watch the points multiply!',
    objective: { type: 'combo', target: 2, label: 'Make a 2x combo' },
    grid: 8,
    preset: null,
    difficulty: 'medium',
    reward: 30,
  },
  {
    id: 6,
    title: 'The Rubble',
    story: 'Heavy debris fills the lower half. Think before you place.',
    objective: { type: 'lines', target: 5, label: 'Clear 5 lines' },
    grid: 8,
    preset: generatePreset(8, [3,4,5,6,7]),
    difficulty: 'medium',
    reward: 40,
  },
  {
    id: 7,
    title: 'Half Way',
    story: 'The board is half full. Score your way to victory.',
    objective: { type: 'score', target: 300, label: 'Score 300 pts' },
    grid: 8,
    preset: generatePreset(8, [2,3,4,5,6,7]),
    difficulty: 'medium',
    reward: 50,
  },
  {
    id: 8,
    title: 'Perfect Clear',
    story: 'Can you clear the entire board?',
    objective: { type: 'perfect', target: 1, label: 'Perfect clear!' },
    grid: 8,
    preset: generateClearablePreset(8),
    difficulty: 'medium',
    reward: 75,
  },
  {
    id: 9,
    title: 'Timed Rush',
    story: 'The clock ticks. Score as much as you can in 90 seconds.',
    objective: { type: 'score_timed', target: 400, time: 90, label: 'Score 400 in 90s' },
    grid: 8,
    preset: null,
    difficulty: 'medium',
    reward: 60,
  },
  {
    id: 10,
    title: 'Crossfire',
    story: 'Rows and columns — clear both at once for bonus!',
    objective: { type: 'cross_clear', target: 2, label: 'Clear row+col x2' },
    grid: 8,
    preset: generatePreset(8, [1,2,3,4,5,6,7]),
    difficulty: 'medium',
    reward: 80,
  },
  {
    id: 11,
    title: 'Deeper Waters',
    story: 'The grid grows. Welcome to 10x10.',
    objective: { type: 'score', target: 500, label: 'Score 500 pts' },
    grid: 10,
    preset: null,
    difficulty: 'medium',
    reward: 100,
  },
  {
    id: 12,
    title: 'Avalanche',
    story: 'Nearly full from the start. Find the gaps.',
    objective: { type: 'lines', target: 8, label: 'Clear 8 lines' },
    grid: 10,
    preset: generatePreset(10, [2,3,4,5,6,7,8,9]),
    difficulty: 'hard',
    reward: 120,
  },
  {
    id: 13,
    title: 'Speed Demon',
    story: '60 seconds. Clear as many lines as possible.',
    objective: { type: 'lines_timed', target: 6, time: 60, label: 'Clear 6 lines in 60s' },
    grid: 8,
    preset: generatePreset(8, [4,5,6,7]),
    difficulty: 'hard',
    reward: 130,
  },
  {
    id: 14,
    title: 'Combo God',
    story: 'Chain 5 consecutive clearing moves.',
    objective: { type: 'combo', target: 5, label: 'Reach combo x5' },
    grid: 8,
    preset: null,
    difficulty: 'hard',
    reward: 150,
  },
  {
    id: 15,
    title: 'Thousand Yard',
    story: 'A thousand points. The master test begins.',
    objective: { type: 'score', target: 1000, label: 'Score 1000 pts' },
    grid: 10,
    preset: null,
    difficulty: 'hard',
    reward: 200,
  },
  {
    id: 16,
    title: 'The Labyrinth',
    story: 'A maze of blocks. Only the sharpest eye finds the path.',
    objective: { type: 'lines', target: 12, label: 'Clear 12 lines' },
    grid: 10,
    preset: generateMazePreset(10),
    difficulty: 'hard',
    reward: 250,
  },
  {
    id: 17,
    title: 'Efficiency',
    story: 'Place 30 pieces without losing. Every move counts.',
    objective: { type: 'pieces', target: 30, label: 'Place 30 pieces' },
    grid: 8,
    preset: null,
    difficulty: 'hard',
    reward: 300,
  },
  {
    id: 18,
    title: 'Iron Wall',
    story: 'An almost solid board. Crack it open.',
    objective: { type: 'lines', target: 15, label: 'Clear 15 lines' },
    grid: 10,
    preset: generatePreset(10, [0,1,2,3,4,5,6,7,8,9], 0.85),
    difficulty: 'hard',
    reward: 350,
  },
  {
    id: 19,
    title: 'Grand Master',
    story: 'Score 2000 points on a 10x10 board. Legend awaits.',
    objective: { type: 'score', target: 2000, label: 'Score 2000 pts' },
    grid: 10,
    preset: generatePreset(10, [3,4,5,6,7,8,9]),
    difficulty: 'hard',
    reward: 500,
  },
  {
    id: 20,
    title: 'The Finale',
    story: 'The ultimate challenge. Full board, 3 minutes, maximum score.',
    objective: { type: 'score_timed', target: 1500, time: 180, label: 'Score 1500 in 3 min' },
    grid: 10,
    preset: generatePreset(10, [1,2,3,4,5,6,7,8,9]),
    difficulty: 'hard',
    reward: 1000,
  },
];

function generatePreset(size, filledRows, density = 0.75) {
  const grid = Array.from({ length: size }, () => Array(size).fill(0));
  filledRows.forEach(row => {
    if (row >= size) return;
    for (let col = 0; col < size; col++) {
      if (Math.random() < density) {
        grid[row][col] = Math.floor(Math.random() * 12) + 1;
      }
    }
  });
  return grid;
}

function generateClearablePreset(size) {
  const grid = Array.from({ length: size }, () => Array(size).fill(0));
  // Fill bottom 3 rows almost completely, leaving strategic gaps
  for (let row = size - 3; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (Math.random() < 0.7) grid[row][col] = Math.floor(Math.random() * 12) + 1;
    }
  }
  return grid;
}

function generateMazePreset(size) {
  const grid = Array.from({ length: size }, () => Array(size).fill(0));
  // Checkerboard-like pattern with gaps
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if ((r + c) % 3 !== 0 && r > 1) {
        grid[r][c] = Math.floor(Math.random() * 12) + 1;
      }
    }
  }
  return grid;
}

// ── Random Level Generator ─────────────────────────────────────────────────
function generateRandomLevel(levelNum) {
  const isHard = levelNum > 10;
  const size = isHard ? 10 : 8;
  const filledRows = [];
  const rowCount = Math.min(Math.floor(levelNum / 2), isHard ? 8 : 6);
  for (let i = 0; i < rowCount; i++) {
    filledRows.push(size - 1 - i);
  }

  const objectives = [
    { type: 'score',   target: 50 * levelNum,       label: `Score ${50 * levelNum} pts` },
    { type: 'lines',   target: Math.max(2, Math.floor(levelNum * 0.8)), label: `Clear ${Math.max(2, Math.floor(levelNum * 0.8))} lines` },
    { type: 'score',   target: 30 * levelNum,       label: `Score ${30 * levelNum} pts` },
  ];

  return {
    id: `random_${levelNum}`,
    title: `Level ${levelNum}`,
    story: getRandomStory(levelNum),
    objective: objectives[levelNum % objectives.length],
    grid: size,
    preset: rowCount > 0 ? generatePreset(size, filledRows) : null,
    difficulty: levelNum <= 5 ? 'easy' : levelNum <= 12 ? 'medium' : 'hard',
    reward: levelNum * 10,
    isRandom: true,
  };
}

const STORY_SNIPPETS = [
  'A new puzzle awaits your sharp mind.',
  'The blocks have shifted. Find the solution.',
  'Chaos reigns — bring order to the board.',
  'Every move matters. Choose wisely.',
  'The grid demands your full attention.',
  'Pattern recognition is your superpower.',
  'Breathe. Think. Place.',
  'The perfect move is just waiting to be found.',
  'Blocks fall. Lines clear. Scores rise.',
  'This one might surprise you.',
];

function getRandomStory(n) {
  return STORY_SNIPPETS[n % STORY_SNIPPETS.length];
}

// ── Level Progress Helpers ─────────────────────────────────────────────────
function isObjectiveMet(obj, state) {
  switch (obj.type) {
    case 'score':        return state.score >= obj.target;
    case 'lines':        return state.linesCleared >= obj.target;
    case 'columns':      return state.columnsCleared >= obj.target;
    case 'combo':        return state.maxCombo >= obj.target;
    case 'perfect':      return state.perfectClears >= obj.target;
    case 'cross_clear':  return state.crossClears >= obj.target;
    case 'pieces':       return state.piecesPlaced >= obj.target;
    case 'score_timed':  return state.score >= obj.target;
    case 'lines_timed':  return state.linesCleared >= obj.target;
    default: return false;
  }
}
