// ─── TELEGRAM MINI APP INTEGRATION ──────────────────────────────────────────

const TG = {
  app: null,
  user: null,
  isReady: false,

  init() {
    if (window.Telegram?.WebApp) {
      this.app = window.Telegram.WebApp;
      this.app.ready();
      this.app.expand();
      this.app.setHeaderColor('#0a0a0f');
      this.app.setBackgroundColor('#0a0a0f');
      this.user = this.app.initDataUnsafe?.user || null;
      this.isReady = true;

      // Disable vertical swipe on game screen
      try { this.app.disableVerticalSwipes(); } catch {}
    } else {
      // Dev/browser fallback
      this.user = { id: 'dev_user', first_name: 'Player', username: 'dev' };
      this.isReady = false;
    }
    return this;
  },

  getUserId()    { return this.user?.id?.toString() || 'guest'; },
  getUsername()  { return this.user?.username || this.user?.first_name || 'Player'; },
  getFirstName() { return this.user?.first_name || 'Player'; },

  // ── Haptic ──────────────────────────────────────────────────────────────
  haptic(type = 'light') {
    try {
      const h = this.app?.HapticFeedback;
      if (!h) return;
      if (type === 'light')    h.impactOccurred('light');
      if (type === 'medium')   h.impactOccurred('medium');
      if (type === 'heavy')    h.impactOccurred('heavy');
      if (type === 'success')  h.notificationOccurred('success');
      if (type === 'warning')  h.notificationOccurred('warning');
      if (type === 'error')    h.notificationOccurred('error');
    } catch {}
  },

  // ── Cloud Storage ────────────────────────────────────────────────────────
  cloudGet(key) {
    return new Promise(resolve => {
      if (!this.app?.CloudStorage) return resolve(null);
      this.app.CloudStorage.getItem(key, (err, val) => resolve(err ? null : val));
    });
  },

  cloudSet(key, value) {
    return new Promise(resolve => {
      if (!this.app?.CloudStorage) return resolve(false);
      this.app.CloudStorage.setItem(key, value, (err) => resolve(!err));
    });
  },

  // ── Share ────────────────────────────────────────────────────────────────
  shareScore(score, mode) {
    const text = `🎮 I scored ${score} in Block Blast ${mode} mode! Can you beat me?`;
    try {
      this.app?.openTelegramLink(`https://t.me/share/url?url=https://t.me/your_bot&text=${encodeURIComponent(text)}`);
    } catch {
      navigator.clipboard?.writeText(text).catch(() => {});
    }
  },

  // ── MainButton ───────────────────────────────────────────────────────────
  showMainButton(text, onClick) {
    if (!this.app?.MainButton) return;
    this.app.MainButton.setText(text);
    this.app.MainButton.onClick(onClick);
    this.app.MainButton.show();
  },

  hideMainButton() {
    try { this.app?.MainButton.hide(); } catch {}
  },
};
