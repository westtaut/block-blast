// ─── STORAGE (CloudStorage + localStorage fallback) ─────────────────────────

const STORE_KEY = 'blockblast_v2';

const Storage = {
  // Default player data
  _default() {
    return {
      userId: TG.getUserId(),
      username: TG.getUsername(),
      bestScore: 0,
      totalScore: 0,
      gamesPlayed: 0,
      selectedTheme: 'dark',
      coins: 0,
      achievements: {},
      storyProgress: 0,   // highest story level completed
      storyStars: {},     // levelId → stars (1-3)
      stats: {
        linesCleared: 0,
        piecesPlaced: 0,
        maxCombo: 0,
        perfectClears: 0,
      },
      dailyQuests: {
        date: '',
        quests: [],
        completed: [],
      },
    };
  },

  _data: null,

  async load() {
    try {
      // Try Telegram CloudStorage first
      const cloud = await TG.cloudGet(STORE_KEY);
      if (cloud) {
        this._data = { ...this._default(), ...JSON.parse(cloud) };
        return this._data;
      }
    } catch {}

    // Fallback: localStorage
    try {
      const local = localStorage.getItem(STORE_KEY);
      if (local) {
        this._data = { ...this._default(), ...JSON.parse(local) };
        return this._data;
      }
    } catch {}

    this._data = this._default();
    return this._data;
  },

  async save() {
    if (!this._data) return;
    const json = JSON.stringify(this._data);
    try { await TG.cloudSet(STORE_KEY, json); } catch {}
    try { localStorage.setItem(STORE_KEY, json); } catch {}
  },

  get() { return this._data || this._default(); },

  // ── Helpers ──────────────────────────────────────────────────────────────
  async addScore(score, mode) {
    const d = this.get();
    d.totalScore   += score;
    d.gamesPlayed  += 1;
    if (score > d.bestScore) d.bestScore = score;
    await this.save();
  },

  async updateStats(stats) {
    const d = this.get();
    d.stats.linesCleared  += stats.linesCleared  || 0;
    d.stats.piecesPlaced  += stats.piecesPlaced  || 0;
    d.stats.maxCombo = Math.max(d.stats.maxCombo, stats.maxCombo || 0);
    d.stats.perfectClears += stats.perfectClears || 0;
    await this.save();
  },

  async unlockAchievement(id) {
    const d = this.get();
    if (d.achievements[id]) return false;
    d.achievements[id] = Date.now();
    d.coins += ACHIEVEMENTS[id]?.coins || 10;
    await this.save();
    return true;
  },

  async setTheme(theme) {
    this.get().selectedTheme = theme;
    await this.save();
  },

  async spendCoins(amount) {
    const d = this.get();
    if (d.coins < amount) return false;
    d.coins -= amount;
    await this.save();
    return true;
  },

  async completeLevel(levelId, score) {
    const d = this.get();
    const stars = score >= 2000 ? 3 : score >= 1000 ? 2 : 1;
    const prev = d.storyStars[levelId] || 0;
    if (stars > prev) d.storyStars[levelId] = stars;
    const numId = parseInt(levelId);
    if (!isNaN(numId) && numId > d.storyProgress) d.storyProgress = numId;
    d.coins += stars * 5;
    await this.save();
    return stars;
  },

  async getDailyQuests() {
    const d = this.get();
    const today = new Date().toISOString().split('T')[0];
    if (d.dailyQuests.date !== today) {
      d.dailyQuests = {
        date: today,
        quests: generateDailyQuests(),
        completed: [],
      };
      await this.save();
    }
    return d.dailyQuests;
  },
};

// ── Daily Quests ─────────────────────────────────────────────────────────────
function generateDailyQuests() {
  return [
    { id: 'q1', label: 'Score 500 pts',   type: 'score',  target: 500,  reward: 20 },
    { id: 'q2', label: 'Clear 10 lines',  type: 'lines',  target: 10,   reward: 15 },
    { id: 'q3', label: 'Make a 3x combo', type: 'combo',  target: 3,    reward: 25 },
  ];
}

// ── Achievements ─────────────────────────────────────────────────────────────
const ACHIEVEMENTS = {
  first_line:    { id:'first_line',    label:'First Line',       desc:'Clear your first line',           coins:5  },
  score_100:     { id:'score_100',     label:'Century',          desc:'Score 100 points',                coins:10 },
  score_500:     { id:'score_500',     label:'High Roller',      desc:'Score 500 points',                coins:15 },
  score_1000:    { id:'score_1000',    label:'Grand',            desc:'Score 1000 points',               coins:25 },
  score_5000:    { id:'score_5000',    label:'Legend',           desc:'Score 5000 points',               coins:50 },
  combo_3:       { id:'combo_3',       label:'Combo!',           desc:'Reach a 3x combo',                coins:10 },
  combo_5:       { id:'combo_5',       label:'Combo Master',     desc:'Reach a 5x combo',                coins:20 },
  perfect_clear: { id:'perfect_clear', label:'Perfect Clear',    desc:'Clear the entire board',          coins:30 },
  games_10:      { id:'games_10',      label:'Dedicated',        desc:'Play 10 games',                   coins:10 },
  games_100:     { id:'games_100',     label:'Veteran',          desc:'Play 100 games',                  coins:30 },
  story_5:       { id:'story_5',       label:'Chapter 1',        desc:'Complete 5 story levels',         coins:20 },
  story_10:      { id:'story_10',      label:'Halfway',          desc:'Complete 10 story levels',        coins:40 },
  story_20:      { id:'story_20',      label:'Story Complete',   desc:'Complete all story levels',       coins:100},
};

async function checkAchievements(engine, store) {
  const unlocked = [];
  const data = store.get();
  const s = engine.score;
  const checks = [
    ['first_line',    engine.linesCleared >= 1],
    ['score_100',     s >= 100],
    ['score_500',     s >= 500],
    ['score_1000',    s >= 1000],
    ['score_5000',    s >= 5000],
    ['combo_3',       engine.maxCombo >= 3],
    ['combo_5',       engine.maxCombo >= 5],
    ['perfect_clear', engine.perfectClears >= 1],
    ['games_10',      data.gamesPlayed >= 10],
    ['games_100',     data.gamesPlayed >= 100],
    ['story_5',       data.storyProgress >= 5],
    ['story_10',      data.storyProgress >= 10],
    ['story_20',      data.storyProgress >= 20],
  ];
  for (const [id, cond] of checks) {
    if (cond) {
      const didUnlock = await store.unlockAchievement(id);
      if (didUnlock) unlocked.push(ACHIEVEMENTS[id]);
    }
  }
  return unlocked;
}
