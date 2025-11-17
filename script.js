const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const GRAVITY = 0.35;
const JUMP_FORCE = -7.2;
const PIPE_GAP = 150;
const PIPE_WIDTH = 60;
const PIPE_INTERVAL = 1450; // ms
const GROUND_HEIGHT = 70;
const BIRD_RADIUS = 16;

let bird;
let pipes = [];
let clouds = [];
let particles = [];
let lastPipeTime = 0;
let score = 0;
let bestScore = 0;
let isRunning = false;
let lastTime = 0;
let soundOn = true;
let gameState = "menu"; // "menu" | "playing" | "gameover"

const scoreEl = document.getElementById("score");
const startBtn = document.getElementById("startBtn");
const soundBtn = document.getElementById("soundBtn");
const mainMenu = document.getElementById("mainMenu");
const menuPlayBtn = document.getElementById("menuPlayBtn");

const sfxFlap = document.getElementById("sfx-flap");
const sfxScore = document.getElementById("sfx-score");
const sfxHit = document.getElementById("sfx-hit");

function playSfx(audioEl) {
  if (!soundOn || !audioEl) return;
  try {
    const clone = audioEl.cloneNode();
    clone.currentTime = 0;
    clone.play();
  } catch (e) {
    // ignore autoplay issues
  }
}

function initClouds() {
  clouds = [];
  for (let i = 0; i < 4; i++) {
    clouds.push({
      x: Math.random() * canvas.width,
      y: 40 + Math.random() * 130,
      w: 70 + Math.random() * 60,
      h: 25 + Math.random() * 12,
      speed: 0.3 + Math.random() * 0.3
    });
  }
}

function spawnParticles(x, y, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 2.5,
      vy: (Math.random() - 0.7) * 2.5,
      life: 400 + Math.random() * 200,
      age: 0
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.008 * dt / 16;
  }
}

function drawParticles() {
  for (const p of particles) {
    const alpha = 1 - p.age / p.life;
    ctx.fillStyle = `rgba(248,250,252,${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBackground() {
  const w = canvas.width;
  const h = canvas.height;

  const skyGradient = ctx.createLinearGradient(0, 0, 0, h);
  skyGradient.addColorStop(0, "#38bdf8");
  skyGradient.addColorStop(0.6, "#22c55e");
  skyGradient.addColorStop(1, "#15803d");
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, w, h);

  // Clouds
  ctx.fillStyle = "rgba(248,250,252,0.9)";
  for (const c of clouds) {
    ctx.beginPath();
    const r = c.h / 2;
    ctx.ellipse(c.x, c.y, c.w / 2, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mountains
  ctx.fillStyle = "#1d3557";
  ctx.beginPath();
  ctx.moveTo(-40, h - GROUND_HEIGHT - 40);
  ctx.lineTo(120, h - GROUND_HEIGHT - 190);
  ctx.lineTo(260, h - GROUND_HEIGHT - 40);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(160, h - GROUND_HEIGHT - 30);
  ctx.lineTo(320, h - GROUND_HEIGHT - 160);
  ctx.lineTo(480, h - GROUND_HEIGHT - 30);
  ctx.closePath();
  ctx.fill();

  // Ground
  ctx.fillStyle = "#166534";
  ctx.fillRect(0, h - GROUND_HEIGHT, w, GROUND_HEIGHT);

  // Ground stripes
  ctx.strokeStyle = "rgba(15,23,42,0.35)";
  ctx.lineWidth = 2;
  for (let x = -20; x < w + 40; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, h - GROUND_HEIGHT + 6);
    ctx.lineTo(x + 30, h - 6);
    ctx.stroke();
  }
}

function resetGame() {
  bird = {
    x: canvas.width * 0.28,
    y: canvas.height / 2,
    vy: 0,
    flapPhase: 0
  };
  pipes = [];
  particles = [];
  score = 0;
  scoreEl.textContent = score;
  lastPipeTime = 0;
  lastTime = 0;
  initClouds();
}

function spawnPipe() {
  const minTop = 70;
  const maxTop = canvas.height - GROUND_HEIGHT - PIPE_GAP - 70;
  const topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;

  pipes.push({
    x: canvas.width,
    top: topHeight,
    passed: false
  });
}

function update(dt) {
  updateClouds(dt);

  if (!isRunning) {
    updateParticles(dt);
    return;
  }

  // Bird physics
  bird.vy += GRAVITY;
  bird.y += bird.vy;
  bird.flapPhase += dt * 0.02;

  // Spawn pipes
  lastPipeTime += dt;
  if (lastPipeTime > PIPE_INTERVAL) {
    spawnPipe();
    lastPipeTime = 0;
  }

  // Move pipes
  const pipeSpeed = 2.9;
  for (let i = pipes.length - 1; i >= 0; i--) {
    const p = pipes[i];
    p.x -= pipeSpeed;

    if (!p.passed && p.x + PIPE_WIDTH < bird.x) {
      p.passed = true;
      score++;
      scoreEl.textContent = score;
      spawnParticles(bird.x, bird.y, 16);
      playSfx(sfxScore);
      if (score > bestScore) bestScore = score;
    }

    if (p.x + PIPE_WIDTH < -80) {
      pipes.splice(i, 1);
    }
  }

  updateParticles(dt);

  if (checkCollision()) {
    gameOver();
  }
}

function updateClouds(dt) {
  const factor = dt / 16;
  for (const c of clouds) {
    c.x -= c.speed * factor * 2;
    if (c.x < -120) {
      c.x = canvas.width + 60;
      c.y = 40 + Math.random() * 130;
    }
  }
}

function drawBird() {
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(Math.max(-0.4, Math.min(0.5, bird.vy * 0.07)));

  const gradient = ctx.createRadialGradient(0, 0, 6, 0, 0, BIRD_RADIUS + 4);
  gradient.addColorStop(0, "#fee2e2");
  gradient.addColorStop(0.4, "#fb7185");
  gradient.addColorStop(1, "#be123c");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(254,249,195,0.95)";
  ctx.beginPath();
  ctx.arc(-3, 4, 10, 0.5 * Math.PI, 1.5 * Math.PI);
  ctx.fill();

  const wingOffset = Math.sin(bird.flapPhase) * 4;
  ctx.fillStyle = "rgba(248,250,252,0.95)";
  ctx.beginPath();
  ctx.ellipse(-6, wingOffset, 12, 7, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(7, -5, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#020617";
  ctx.beginPath();
  ctx.arc(8, -5, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.moveTo(BIRD_RADIUS, 0);
  ctx.lineTo(BIRD_RADIUS + 10, -4);
  ctx.lineTo(BIRD_RADIUS + 10, 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawPipes() {
  for (const p of pipes) {
    const topBottomY = 0;
    const bottomTopY = p.top + PIPE_GAP;

    const gradientTop = ctx.createLinearGradient(0, 0, 0, p.top);
    gradientTop.addColorStop(0, "#0f766e");
    gradientTop.addColorStop(1, "#115e59");
    ctx.fillStyle = gradientTop;
    ctx.fillRect(p.x, topBottomY, PIPE_WIDTH, p.top);

    ctx.fillStyle = "#0d9488";
    ctx.fillRect(p.x - 4, p.top - 16, PIPE_WIDTH + 8, 16);

    const bottomHeight = canvas.height - GROUND_HEIGHT - bottomTopY;
    const gradientBottom = ctx.createLinearGradient(0, bottomTopY, 0, bottomTopY + bottomHeight);
    gradientBottom.addColorStop(0, "#0f766e");
    gradientBottom.addColorStop(1, "#115e59");
    ctx.fillStyle = gradientBottom;
    ctx.fillRect(p.x, bottomTopY, PIPE_WIDTH, bottomHeight);

    ctx.fillStyle = "#0d9488";
    ctx.fillRect(p.x - 4, bottomTopY, PIPE_WIDTH + 8, 16);

    ctx.strokeStyle = "rgba(15,23,42,0.55)";
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, topBottomY, PIPE_WIDTH, p.top);
    ctx.strokeRect(p.x, bottomTopY, PIPE_WIDTH, bottomHeight);
  }
}

function drawHUD() {
  ctx.fillStyle = "rgba(15,23,42,0.25)";
  ctx.fillRect(10, 10, 135, 40);
  ctx.fillStyle = "#f9fafb";
  ctx.font = "16px system-ui";
  ctx.fillText("Score: " + score, 18, 30);

  ctx.textAlign = "right";
  ctx.fillText("Best: " + bestScore, canvas.width - 18, 30);
  ctx.textAlign = "start";
}

function checkCollision() {
  if (!bird) return false;
  if (bird.y + BIRD_RADIUS > canvas.height - GROUND_HEIGHT || bird.y - BIRD_RADIUS < 0) {
    return true;
  }
  for (const p of pipes) {
    if (bird.x + BIRD_RADIUS > p.x && bird.x - BIRD_RADIUS < p.x + PIPE_WIDTH) {
      if (bird.y - BIRD_RADIUS < p.top || bird.y + BIRD_RADIUS > p.top + PIPE_GAP) {
        return true;
      }
    }
  }
  return false;
}

let showGameOverOverlayFlag = false;

function gameOver() {
  if (!isRunning) return;
  isRunning = false;
  gameState = "gameover";
  showGameOverOverlayFlag = true;
  startBtn.textContent = "Restart";
  spawnParticles(bird.x, bird.y, 26);
  playSfx(sfxHit);
}

function drawGameOverOverlay() {
  if (!showGameOverOverlayFlag || gameState !== "gameover") return;

  ctx.fillStyle = "rgba(15,23,42,0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#f9fafb";
  ctx.textAlign = "center";
  ctx.font = "bold 32px system-ui";
  ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 30);

  ctx.font = "18px system-ui";
  ctx.fillText(`Score: ${score} • Best: ${bestScore}`, canvas.width / 2, canvas.height / 2 + 2);
  ctx.font = "15px system-ui";
  ctx.fillText("Klik START / tekan SPACE untuk main lagi", canvas.width / 2, canvas.height / 2 + 32);

  ctx.textAlign = "start";
}

function flap() {
  if (!isRunning || gameState !== "playing") return;
  bird.vy = JUMP_FORCE;
  spawnParticles(bird.x - 6, bird.y + 4, 10);
  playSfx(sfxFlap);
}

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  drawBackground();
  update(dt);
  drawPipes();
  if (bird) drawBird();
  drawParticles();
  drawHUD();
  drawGameOverOverlay();

  requestAnimationFrame(loop);
}

function startGame() {
  resetGame();
  isRunning = true;
  gameState = "playing";
  showGameOverOverlayFlag = false;
  startBtn.textContent = "Playing...";
  mainMenu.classList.add("hidden");
}

startBtn.addEventListener("click", () => {
  if (gameState === "menu") {
    startGame();
  } else if (!isRunning && gameState === "gameover") {
    startGame();
  } else if (isRunning && gameState === "playing") {
    flap();
  }
});

menuPlayBtn.addEventListener("click", () => {
  startGame();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (gameState === "menu") {
      startGame();
    } else if (!isRunning && gameState === "gameover") {
      startGame();
    } else {
      flap();
    }
  } else if (e.code === "KeyM") {
    toggleSound();
  }
});

canvas.addEventListener("pointerdown", () => {
  if (gameState === "menu") {
    startGame();
  } else if (!isRunning && gameState === "gameover") {
    startGame();
  } else {
    flap();
  }
});

function toggleSound() {
  soundOn = !soundOn;
  soundBtn.textContent = soundOn ? "🔊" : "🔇";
}

soundBtn.addEventListener("click", toggleSound);

// Init
resetGame();
requestAnimationFrame(loop);