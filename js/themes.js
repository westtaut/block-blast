// ─── THEMES ──────────────────────────────────────────────────────────────────

const THEMES = {
  dark: {
    name: 'Dark', emoji: '🌑', locked: false,
    bg: '#0a0a0f', surface: '#13131a', surface2: '#1c1c26',
    border: '#ffffff0f', text: '#ffffff', textSub: '#ffffff66',
    accent: '#5b7cff', gridBg: '#13131a', gridLine: '#ffffff08',
    shadow: '0 8px 32px #0008',
    blocks: ['#5b7cff','#ff5f7e','#ffd166','#06d6a0','#a78bfa','#f97316',
             '#38bdf8','#f43f5e','#84cc16','#e879f9','#fb923c','#2dd4bf','#c084fc'],
    particleColor: '#5b7cff',
  },

  forest: {
    name: 'Forest', emoji: '🌲', locked: false,
    bg: '#0e1a0f',         // very dark forest floor
    surface: '#152318',    // dark moss
    surface2: '#1c2e1e',   // slightly lighter bark
    border: '#4a7c5933',
    text: '#d4e8c2',       // soft sage leaf
    textSub: '#7aad6a88',
    accent: '#5dbf4e',     // bright leaf green
    gridBg: '#111c12',     // forest floor, almost black-green
    gridLine: '#2a4d2a22',
    shadow: '0 8px 40px #0a1a0a88',
    glowBlocks: false,
    // Rich natural palette: greens, browns, gold, sky
    blocks: [
      '#5dbf4e',   // fresh leaf
      '#8bc34a',   // lime grass
      '#c8a84b',   // autumn gold
      '#795548',   // warm bark brown
      '#4db6ac',   // forest stream teal
      '#f4845f',   // mushroom orange
      '#aed581',   // pale grass
      '#6d9c55',   // deep fern
      '#ffcc02',   // morning sun
      '#e57373',   // wild berry
      '#80cbc4',   // misty blue
      '#a1887f',   // clay earth
      '#dce775',   // young leaf
    ],
    particleColor: '#5dbf4e',
    // Special: draw soft tree silhouettes in background
    forestBg: true,
  },

  neon: {
    name: 'Neon', emoji: '⚡', locked: false,
    bg: '#060612', surface: '#0d0d24', surface2: '#131330',
    border: '#00f5ff22', text: '#00f5ff', textSub: '#00f5ff88',
    accent: '#ff00ff', gridBg: '#0a0a1f', gridLine: '#00f5ff11',
    shadow: '0 0 30px #00f5ff33',
    blocks: ['#00f5ff','#ff00ff','#ffff00','#00ff88','#ff4444','#44ffff',
             '#ff8800','#8844ff','#00ff44','#ff0088','#44ff00','#0088ff','#ff4400'],
    particleColor: '#00f5ff',
    glowBlocks: true,
  },

  candy: {
    name: 'Candy', emoji: '🍬', locked: false,
    bg: '#fff0f8', surface: '#ffffff', surface2: '#fce4f5',
    border: '#ff69b422', text: '#2d0a1e', textSub: '#2d0a1e99',
    accent: '#ff69b4', gridBg: '#fff8fc', gridLine: '#ff69b411',
    shadow: '0 8px 32px #ff69b422',
    blocks: ['#ff69b4','#ff9f43','#ffd93d','#6bcb77','#c77dff','#4d96ff',
             '#ff6b6b','#a8dadc','#f9c74f','#f95d6a','#a05195','#2f9e44','#e36414'],
    particleColor: '#ff69b4',
  },

  space: {
    name: 'Space', emoji: '🚀', locked: true, price: 50,
    bg: '#030712', surface: '#0c1220', surface2: '#111827',
    border: '#3b82f611', text: '#e2e8f0', textSub: '#94a3b8',
    accent: '#818cf8', gridBg: '#0a1020', gridLine: '#1e3a5f',
    shadow: '0 8px 40px #818cf833',
    blocks: ['#818cf8','#38bdf8','#34d399','#fb923c','#f472b6','#a78bfa',
             '#4ade80','#facc15','#60a5fa','#f87171','#c084fc','#2dd4bf','#fbbf24'],
    particleColor: '#818cf8',
    starField: true,
  },

  cyber: {
    name: 'Cyber', emoji: '🤖', locked: true, price: 50,
    bg: '#000a05', surface: '#001208', surface2: '#001a0c',
    border: '#00ff4133', text: '#00ff41', textSub: '#00ff4188',
    accent: '#00ff41', gridBg: '#000d06', gridLine: '#00ff4118',
    shadow: '0 0 20px #00ff4133',
    blocks: ['#00ff41','#00d4ff','#ff0040','#ffff00','#ff8c00','#40ff00',
             '#0080ff','#ff40ff','#00ffcc','#ff4000','#80ff00','#ff0080','#00ff80'],
    particleColor: '#00ff41',
    scanlines: true,
  },

  classic: {
    name: 'Classic', emoji: '🕹️', locked: false,
    bg: '#1a1a2e', surface: '#16213e', surface2: '#0f3460',
    border: '#e9456022', text: '#e2e2e2', textSub: '#e2e2e2aa',
    accent: '#e94560', gridBg: '#16213e', gridLine: '#e9456011',
    shadow: '0 8px 32px #0009',
    blocks: ['#e94560','#0f3460','#533483','#e8aa14','#00b4d8','#7ae582',
             '#f4a261','#e63946','#457b9d','#1d3557','#a8dadc','#f1faee','#e9c46a'],
    particleColor: '#e94560',
  },
};

function applyTheme(name) {
  const t = THEMES[name] || THEMES.dark;
  const root = document.documentElement;
  Object.entries({
    '--bg':       t.bg,
    '--surface':  t.surface,
    '--surface2': t.surface2,
    '--border':   t.border,
    '--text':     t.text,
    '--text-2':   t.textSub,
    '--text-3':   t.textSub ? t.textSub.replace(/88|66|99/, '44') : 'rgba(255,255,255,0.3)',
    '--accent':   t.accent,
    '--accent-dim': t.accent + '22',
    '--grid-bg':  t.gridBg,
    '--grid-line':t.gridLine,
    '--green':    name === 'forest' ? '#5dbf4e' : '#34d399',
  }).forEach(([k,v]) => { if(v) root.style.setProperty(k, v); });

  // Body background — forest gets a subtle gradient
  if (name === 'forest') {
    document.body.style.background =
      'radial-gradient(ellipse at 50% 0%, #1e3a1e 0%, #0e1a0f 55%, #080f08 100%)';
  } else {
    document.body.style.background = t.bg;
  }
  return t;
}

function getBlockColor(colorId, themeName) {
  const t = THEMES[themeName] || THEMES.dark;
  if (colorId === 0) return null;
  return t.blocks[(colorId - 1) % t.blocks.length];
}
