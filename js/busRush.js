// ==========================================================================
// E-BUS CONNECT UGANDA - "BUS RUSH" MINI-GAME (SECTION 18)
// Optional passenger engagement feature while waiting for a bus.
// AUTO-PAUSES when bus is approaching, arrives, or alert fires.
// Does NOT interfere with transit information.
// ==========================================================================

const BusRush = {
  canvas: null,
  ctx: null,
  running: false,
  paused: false,
  pauseReason: '',
  animFrame: null,

  // Game state
  score: 0,
  highScore: parseInt(localStorage.getItem('ebus_busrush_hi') || '0'),
  lane: 1,         // 0=left, 1=center, 2=right
  laneCount: 3,
  speed: 3,
  frameCount: 0,
  obstacles: [],
  coins: [],
  player: { width: 36, height: 52 },
  canvasWidth: 320,
  canvasHeight: 480,
  gameOver: false,

  // Colors (brand palette)
  colors: {
    bg: '#080D1D',
    lane: '#0F1B35',
    laneLine: '#1E3A5F',
    player: '#10B981',
    obstacle: '#EF4444',
    coin: '#F59E0B',
    text: '#E2E8F0',
    dim: '#475569'
  },

  // -----------------------------------------------------------------------
  // INIT — render the game UI shell
  // -----------------------------------------------------------------------
  init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.score = 0;
    this.gameOver = false;
    this.obstacles = [];
    this.coins = [];
    this.lane = 1;
    this.speed = 3;
    this.frameCount = 0;

    container.innerHTML = `
      <div class="busrush-wrapper" id="busrush-wrapper" aria-label="Bus Rush mini-game. Press Pause if a bus alert appears.">

        <!-- Header -->
        <div class="busrush-header">
          <div>
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Score</div>
            <div style="font-size:1.6rem; font-weight:800; color:var(--primary);" id="busrush-score">0</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:1rem; font-weight:800; color:#F59E0B;">🚌 BUS RUSH</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">Collect ⚡ coins, dodge 🚧 barriers</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Best</div>
            <div style="font-size:1.6rem; font-weight:800; color:var(--accent-gold);" id="busrush-hi">${this.highScore}</div>
          </div>
        </div>

        <!-- Canvas -->
        <canvas id="busrush-canvas" width="${this.canvasWidth}" height="${this.canvasHeight}"
          style="display:block; margin:0 auto; border-radius: 0.75rem; touch-action:none;"
          aria-label="Bus Rush game canvas">
        </canvas>

        <!-- Controls -->
        <div class="busrush-controls">
          <button class="busrush-btn left" id="busrush-left" aria-label="Move bus left" ontouchstart="BusRush.moveLane(-1)">◀ Left</button>
          <button class="busrush-btn pause" id="busrush-pause" onclick="BusRush.togglePause()" aria-label="Pause game">⏸ Pause</button>
          <button class="busrush-btn right" id="busrush-right" aria-label="Move bus right" ontouchstart="BusRush.moveLane(1)">Right ▶</button>
        </div>

        <!-- Keyboard hint -->
        <div style="text-align:center; font-size:0.72rem; color:var(--text-dim); margin-top:0.5rem;">
          ← → Arrow keys or buttons to steer. Space = pause.
        </div>

        <!-- Alert overlay (shown when bus is approaching) -->
        <div id="busrush-alert-overlay" style="display:none; position:absolute; inset:0; background:rgba(8,13,29,0.9); border-radius:0.75rem; z-index:10; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:2rem;">
          <div style="font-size:3rem;">🚌</div>
          <div style="font-size:1.3rem; font-weight:800; color:var(--primary); margin:0.5rem 0;" id="busrush-overlay-title">
            Your bus is approaching!
          </div>
          <div style="font-size:0.88rem; color:var(--text-secondary); margin-bottom:1.25rem;" id="busrush-overlay-msg">
            Game paused. Get ready to board!
          </div>
          <button class="btn btn-primary" onclick="BusRush.resumeFromAlert()">Resume Game</button>
        </div>
        <div id="busrush-alert-overlay" style="display:none;"></div>

      </div>

      <div style="font-size:0.72rem; color:var(--text-dim); text-align:center; margin-top:0.75rem; padding:0.5rem 1rem; background:rgba(245,158,11,0.06); border-radius:0.5rem;">
        ⚠️ Bus Rush is an optional entertainment feature. It will automatically pause when your bus is nearby.
        <b>Always check transit notifications above.</b>
      </div>
    `;

    this.canvas = document.getElementById('busrush-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.canvasWidth = this.canvas.width;
    this.canvasHeight = this.canvas.height;

    // Keyboard controls
    this._keyHandler = (e) => {
      if (e.key === 'ArrowLeft') this.moveLane(-1);
      if (e.key === 'ArrowRight') this.moveLane(1);
      if (e.key === ' ' || e.key === 'Spacebar') this.togglePause();
    };
    window.addEventListener('keydown', this._keyHandler);

    // Touch swipe on canvas
    let startX = 0;
    this.canvas.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; });
    this.canvas.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      if (dx > 30) this.moveLane(1);
      else if (dx < -30) this.moveLane(-1);
    });

    this.start();
  },

  // -----------------------------------------------------------------------
  // GAME LOOP
  // -----------------------------------------------------------------------
  start() {
    this.running = true;
    this.paused = false;
    this.loop();
  },

  loop() {
    if (!this.running) return;
    if (!this.paused && !this.gameOver) {
      this.update();
      this.draw();
      // Auto-check: pause if bus is approaching (ETA < 3 min)
      this.checkBusApproaching();
    } else if (this.gameOver) {
      this.drawGameOver();
    }
    this.animFrame = requestAnimationFrame(() => this.loop());
  },

  stop() {
    this.running = false;
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    if (this._keyHandler) window.removeEventListener('keydown', this._keyHandler);
  },

  // -----------------------------------------------------------------------
  // UPDATE STATE
  // -----------------------------------------------------------------------
  update() {
    this.frameCount++;
    // Increase difficulty over time
    if (this.frameCount % 300 === 0) this.speed = Math.min(this.speed + 0.5, 12);

    const laneWidth = this.canvasWidth / this.laneCount;

    // Spawn obstacles
    if (this.frameCount % Math.max(40, 90 - this.speed * 5) === 0) {
      const spawnLane = Math.floor(Math.random() * this.laneCount);
      this.obstacles.push({
        lane: spawnLane,
        y: -60,
        width: laneWidth * 0.55,
        height: 48
      });
    }

    // Spawn coins
    if (this.frameCount % 55 === 0) {
      this.coins.push({
        lane: Math.floor(Math.random() * this.laneCount),
        y: -24,
        radius: 12
      });
    }

    // Move obstacles
    this.obstacles.forEach(o => { o.y += this.speed; });
    this.obstacles = this.obstacles.filter(o => o.y < this.canvasHeight + 60);

    // Move coins
    this.coins.forEach(c => { c.y += this.speed; });
    this.coins = this.coins.filter(c => c.y < this.canvasHeight + 24);

    // Collision detection
    const playerLaneX = (this.lane * laneWidth) + (laneWidth - this.player.width) / 2;
    const playerY = this.canvasHeight - this.player.height - 20;

    this.obstacles.forEach(o => {
      const obsX = (o.lane * laneWidth) + (laneWidth - o.width) / 2;
      if (o.lane === this.lane &&
          playerY < o.y + o.height &&
          playerY + this.player.height > o.y) {
        this.handleGameOver();
      }
    });

    this.coins = this.coins.filter(c => {
      const coinX = (c.lane * laneWidth) + laneWidth / 2;
      if (c.lane === this.lane &&
          Math.abs(playerY + this.player.height / 2 - c.y) < 30) {
        this.score += 10;
        document.getElementById('busrush-score')?.textContent && (document.getElementById('busrush-score').textContent = this.score);
        return false; // collected
      }
      return true;
    });

    // Passive score for distance
    if (this.frameCount % 10 === 0) {
      this.score += 1;
      const scoreEl = document.getElementById('busrush-score');
      if (scoreEl) scoreEl.textContent = this.score;
    }
  },

  // -----------------------------------------------------------------------
  // DRAW
  // -----------------------------------------------------------------------
  draw() {
    const ctx = this.ctx;
    const W = this.canvasWidth;
    const H = this.canvasHeight;
    const laneWidth = W / this.laneCount;

    // Background
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, W, H);

    // Lane backgrounds
    for (let i = 0; i < this.laneCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? this.colors.lane : this.colors.bg;
      ctx.fillRect(i * laneWidth, 0, laneWidth, H);
    }

    // Lane dividers (dashed)
    ctx.strokeStyle = this.colors.laneLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 15]);
    for (let i = 1; i < this.laneCount; i++) {
      ctx.beginPath();
      ctx.moveTo(i * laneWidth, 0);
      ctx.lineTo(i * laneWidth, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Obstacles (road barriers)
    this.obstacles.forEach(o => {
      const ox = (o.lane * laneWidth) + (laneWidth - o.width) / 2;
      ctx.fillStyle = this.colors.obstacle;
      this.roundRect(ctx, ox, o.y, o.width, o.height, 8);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚧', ox + o.width / 2, o.y + o.height / 2 + 7);
    });

    // Coins (electric bolts)
    this.coins.forEach(c => {
      const cx = (c.lane * laneWidth) + laneWidth / 2;
      ctx.fillStyle = this.colors.coin;
      ctx.beginPath();
      ctx.arc(cx, c.y, c.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a0a00';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚡', cx, c.y + 5);
    });

    // Player bus
    const px = (this.lane * laneWidth) + (laneWidth - this.player.width) / 2;
    const py = H - this.player.height - 20;
    ctx.fillStyle = this.colors.player;
    this.roundRect(ctx, px, py, this.player.width, this.player.height, 10);
    ctx.fillStyle = '#fff';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚌', px + this.player.width / 2, py + this.player.height / 2 + 7);

    // Speed indicator top-right
    ctx.fillStyle = this.colors.dim;
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`SPD ${this.speed.toFixed(1)}`, W - 8, 18);

    // Paused overlay
    if (this.paused) {
      ctx.fillStyle = 'rgba(8,13,29,0.75)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = this.colors.text;
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', W / 2, H / 2 - 10);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = this.colors.dim;
      ctx.fillText(this.pauseReason || 'Press Space or Pause button to resume', W / 2, H / 2 + 20);
    }
  },

  drawGameOver() {
    const ctx = this.ctx;
    const W = this.canvasWidth;
    const H = this.canvasHeight;

    ctx.fillStyle = 'rgba(8,13,29,0.92)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';

    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 60);

    ctx.fillStyle = this.colors.text;
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`Score: ${this.score}`, W / 2, H / 2 - 20);

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('ebus_busrush_hi', this.highScore);
      ctx.fillStyle = this.colors.coin;
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('🏆 New High Score!', W / 2, H / 2 + 15);
    }

    ctx.fillStyle = this.colors.dim;
    ctx.font = '14px sans-serif';
    ctx.fillText('Best: ' + this.highScore, W / 2, H / 2 + 40);

    ctx.fillStyle = this.colors.player;
    ctx.font = '15px sans-serif';
    ctx.fillText('Tap/Click to restart', W / 2, H / 2 + 80);

    this.canvas.onclick = () => this.restart();
    this.canvas.ontouchend = () => this.restart();
  },

  // -----------------------------------------------------------------------
  // CONTROLS
  // -----------------------------------------------------------------------
  moveLane(dir) {
    if (this.paused || this.gameOver) return;
    this.lane = Math.max(0, Math.min(this.laneCount - 1, this.lane + dir));
  },

  togglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused;
    this.pauseReason = '';
    const btn = document.getElementById('busrush-pause');
    if (btn) btn.textContent = this.paused ? '▶ Resume' : '⏸ Pause';
  },

  // -----------------------------------------------------------------------
  // AUTO-PAUSE when bus is approaching (ETA ≤ 3 minutes) — Section 18
  // -----------------------------------------------------------------------
  checkBusApproaching() {
    // Check if any tracked bus has ETA ≤ 3 minutes
    const nearBus = State.fleet.find(b => b.status === 'in-service' && b.etaMinutes <= 3);
    if (nearBus && !this.paused) {
      this.paused = true;
      this.pauseReason = `Your bus (${nearBus.displayNumber}) is approaching! Get ready to board.`;
      App.showToast('Bus Approaching 🚌', `${nearBus.displayNumber} is ~${nearBus.etaMinutes} min away! Bus Rush paused.`, 'warning');
    }
  },

  resumeFromAlert() {
    this.paused = false;
    this.pauseReason = '';
    const overlay = document.getElementById('busrush-alert-overlay');
    if (overlay) overlay.style.display = 'none';
  },

  // -----------------------------------------------------------------------
  // RESTART
  // -----------------------------------------------------------------------
  restart() {
    this.canvas.onclick = null;
    this.canvas.ontouchend = null;
    this.score = 0;
    this.gameOver = false;
    this.obstacles = [];
    this.coins = [];
    this.lane = 1;
    this.speed = 3;
    this.frameCount = 0;
    this.paused = false;
    const scoreEl = document.getElementById('busrush-score');
    if (scoreEl) scoreEl.textContent = '0';
    const hiEl = document.getElementById('busrush-hi');
    if (hiEl) hiEl.textContent = this.highScore;
  },

  handleGameOver() {
    this.gameOver = true;
  },

  // Utility: rounded rect fill
  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }
};
