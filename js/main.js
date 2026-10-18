// ==========================================
// KICKOFF FOOTBALL — PLAYABLE FOUNDATION
// ==========================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const minimap = document.getElementById("minimap");
const minimapCtx = minimap.getContext("2d");

const menuScreen = document.getElementById("menuScreen");
const matchScreen = document.getElementById("matchScreen");

const playButton = document.getElementById("playButton");
const menuButton = document.getElementById("menuButton");
const resetButton = document.getElementById("resetButton");
const pauseButton = document.getElementById("pauseButton");
const resumeButton = document.getElementById("resumeButton");
const cameraButton = document.getElementById("cameraButton");
const grassButton = document.getElementById("grassButton");

const passButton = document.getElementById("passButton");
const shootButton = document.getElementById("shootButton");
const sprintButton = document.getElementById("sprintButton");

const blueScoreElement = document.getElementById("blueScore");
const redScoreElement = document.getElementById("redScore");
const matchBlueScoreElement = document.getElementById("matchBlueScore");
const matchRedScoreElement = document.getElementById("matchRedScore");

const matchStatus = document.getElementById("matchStatus");
const liveMatchStatus = document.getElementById("liveMatchStatus");
const pauseOverlay = document.getElementById("pauseOverlay");
const goalBanner = document.getElementById("goalBanner");
const goalText = document.getElementById("goalText");

// World
const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1400;

const FIELD = {
  x: 60,
  y: 60,
  width: 2280,
  height: 1280
};

const CENTER_X = WORLD_WIDTH / 2;
const CENTER_Y = WORLD_HEIGHT / 2;

const COLORS = {
  grass: "#347b3e",
  grassLight: "#3b8545",
  lines: "rgba(255,255,255,0.82)",
  blue: "#36a5ff",
  blueDark: "#1474d1",
  red: "#ff5358",
  redDark: "#c92f3c"
};

let blueScore = 0;
let redScore = 0;

let running = false;
let paused = false;
let cameraEnabled = true;
let stripesEnabled = true;

let lastFrameTime = 0;
let goalTimer = 0;
let kickoffTimer = 0;

const keys = new Set();
const touchDirections = new Set();

const blue = {
  x: CENTER_X - 130,
  y: CENTER_Y,
  vx: 0,
  vy: 0,
  radius: 25,
  speed: 310,
  color: COLORS.blue,
  number: 10,
  team: "blue"
};

const red = {
  x: CENTER_X + 150,
  y: CENTER_Y,
  vx: 0,
  vy: 0,
  radius: 25,
  speed: 225,
  color: COLORS.red,
  number: 9,
  team: "red"
};

const ball = {
  x: CENTER_X,
  y: CENTER_Y,
  vx: 0,
  vy: 0,
  radius: 14
};

const camera = {
  x: CENTER_X,
  y: CENTER_Y,
  zoom: 1.18
};

// ==========================================
// UTILITIES
// ==========================================

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function normalize(x, y) {
  const length = Math.hypot(x, y);
  if (length === 0) return { x: 0, y: 0 };
  return { x: x / length, y: y / length };
}

function setStatus(message) {
  matchStatus.textContent = message;
  liveMatchStatus.textContent = message;
}

function updateScoreboard() {
  blueScoreElement.textContent = blueScore;
  redScoreElement.textContent = redScore;
  matchBlueScoreElement.textContent = blueScore;
  matchRedScoreElement.textContent = redScore;
}

function hideGoalBanner() {
  goalBanner.hidden = true;
}

function showGoalBanner(message) {
  goalText.textContent = message;
  goalBanner.hidden = false;
}

// ==========================================
// RESET AND SCORING
// ==========================================

function resetPositions() {
  blue.x = CENTER_X - 130;
  blue.y = CENTER_Y;
  blue.vx = blue.vy = 0;

  red.x = CENTER_X + 150;
  red.y = CENTER_Y;
  red.vx = red.vy = 0;

  ball.x = CENTER_X;
  ball.y = CENTER_Y;
  ball.vx = ball.vy = 0;

  camera.x = CENTER_X;
  camera.y = CENTER_Y;

  kickoffTimer = 0.8;
}

function resetMatch() {
  blueScore = 0;
  redScore = 0;
  paused = false;
  goalTimer = 0;

  pauseOverlay.hidden = true;
  pauseButton.textContent = "PAUSE";

  hideGoalBanner();
  resetPositions();
  updateScoreboard();
  setStatus("READY FOR KICKOFF");
}

function scoreGoal(team) {
  if (goalTimer > 0) return;

  if (team === "blue") {
    blueScore++;
    showGoalBanner("BLUE FC SCORES!");
  } else {
    redScore++;
    showGoalBanner("RED UNITED SCORES!");
  }

  updateScoreboard();
  setStatus("GOAL!");

  goalTimer = 1.6;
  kickoffTimer = 2.2;

  blue.vx = blue.vy = 0;
  red.vx = red.vy = 0;
  ball.vx = ball.vy = 0;
}

// ==========================================
// INPUT
// ==========================================

function isDown(...names) {
  return names.some(name => keys.has(name) || touchDirections.has(name));
}

function getMovement() {
  let x = 0;
  let y = 0;

  if (isDown("a", "arrowleft", "left")) x--;
  if (isDown("d", "arrowright", "right")) x++;
  if (isDown("w", "arrowup", "up")) y--;
  if (isDown("s", "arrowdown", "down")) y++;

  return normalize(x, y);
}

function updateBlue(dt) {
  const movement = getMovement();
  const sprinting = isDown("shift", "sprint");
  const speed = blue.speed * (sprinting ? 1.45 : 1);

  blue.vx = movement.x * speed;
  blue.vy = movement.y * speed;

  blue.x += blue.vx * dt;
  blue.y += blue.vy * dt;

  blue.x = clamp(blue.x, FIELD.x + blue.radius, FIELD.x + FIELD.width - blue.radius);
  blue.y = clamp(blue.y, FIELD.y + blue.radius, FIELD.y + FIELD.height - blue.radius);
}

// ==========================================
// RED AI
// ==========================================

function updateRed(dt) {
  const dist = distance(red, ball);
  let direction = { x: 0, y: 0 };

  if (dist > red.radius + ball.radius + 3) {
    direction = normalize(ball.x - red.x, ball.y - red.y);
  }

  red.vx = direction.x * red.speed;
  red.vy = direction.y * red.speed;

  red.x += red.vx * dt;
  red.y += red.vy * dt;

  red.x = clamp(red.x, FIELD.x + red.radius, FIELD.x + FIELD.width - red.radius);
  red.y = clamp(red.y, FIELD.y + red.radius, FIELD.y + FIELD.height - red.radius);
}

// ==========================================
// PLAYER COLLISION
// ==========================================

function resolvePlayerCollision() {
  const dx = red.x - blue.x;
  const dy = red.y - blue.y;
  const dist = Math.hypot(dx, dy);
  const minimum = blue.radius + red.radius;

  if (dist >= minimum) return;

  const normal = dist === 0
    ? { x: 1, y: 0 }
    : { x: dx / dist, y: dy / dist };

  const overlap = minimum - dist;

  blue.x -= normal.x * overlap / 2;
  blue.y -= normal.y * overlap / 2;
  red.x += normal.x * overlap / 2;
  red.y += normal.y * overlap / 2;

  const relative =
    (red.vx - blue.vx) * normal.x +
    (red.vy - blue.vy) * normal.y;

  if (relative < 0) {
    const impulse = -relative * 0.55;
    blue.vx -= impulse * normal.x;
    blue.vy -= impulse * normal.y;
    red.vx += impulse * normal.x;
    red.vy += impulse * normal.y;
  }
}

// ==========================================
// BALL PHYSICS
// ==========================================

function pushBallFromPlayer(player, dt) {
  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const dist = Math.hypot(dx, dy);
  const minimum = player.radius + ball.radius;

  if (dist >= minimum) return;

  const normal = dist === 0
    ? { x: player.team === "blue" ? 1 : -1, y: 0 }
    : { x: dx / dist, y: dy / dist };

  const overlap = minimum - dist;
  ball.x += normal.x * overlap;
  ball.y += normal.y * overlap;

  ball.vx += player.vx * dt * 1.8;
  ball.vy += player.vy * dt * 1.8;

  const inward = ball.vx * normal.x + ball.vy * normal.y;

  if (inward < 0) {
    ball.vx -= inward * normal.x;
    ball.vy -= inward * normal.y;
  }
}

function updateBall(dt) {
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  const friction = Math.exp(-1.15 * dt);
  ball.vx *= friction;
  ball.vy *= friction;

  if (Math.hypot(ball.vx, ball.vy) < 4) {
    ball.vx = 0;
    ball.vy = 0;
  }

  const top = FIELD.y + ball.radius;
  const bottom = FIELD.y + FIELD.height - ball.radius;

  if (ball.y < top) {
    ball.y = top;
    ball.vy = Math.abs(ball.vy) * 0.72;
  }

  if (ball.y > bottom) {
    ball.y = bottom;
    ball.vy = -Math.abs(ball.vy) * 0.72;
  }

  const left = FIELD.x;
  const right = FIELD.x + FIELD.width;
  const goalHeight = 220;
  const goalTop = CENTER_Y - goalHeight / 2;
  const goalBottom = CENTER_Y + goalHeight / 2;
  const inGoal = ball.y > goalTop && ball.y < goalBottom;

  if (ball.x < left + ball.radius) {
    if (inGoal) {
      scoreGoal("red");
      return;
    }

    ball.x = left + ball.radius;
    ball.vx = Math.abs(ball.vx) * 0.72;
  }

  if (ball.x > right - ball.radius) {
    if (inGoal) {
      scoreGoal("blue");
      return;
    }

    ball.x = right - ball.radius;
    ball.vx = -Math.abs(ball.vx) * 0.72;
  }

  pushBallFromPlayer(blue, dt);
  pushBallFromPlayer(red, dt);
}

// ==========================================
// SHOOTING AND PASSING
// ==========================================

function canKickBall() {
  return distance(blue, ball) <= blue.radius + ball.radius + 5;
}

function kickBall(power) {
  if (!running || paused || goalTimer > 0 || kickoffTimer > 0) return;

  if (!canKickBall()) {
    setStatus("GET CLOSER TO THE BALL");
    return;
  }

  let direction = normalize(ball.x - blue.x, ball.y - blue.y);

  if (direction.x === 0 && direction.y === 0) {
    direction = normalize(blue.vx, blue.vy);

    if (direction.x === 0 && direction.y === 0) {
      direction = { x: 1, y: 0 };
    }
  }

  ball.vx += direction.x * power;
  ball.vy += direction.y * power;

  ball.x = blue.x + direction.x * (blue.radius + ball.radius + 2);
  ball.y = blue.y + direction.y * (blue.radius + ball.radius + 2);

  setStatus(power > 650 ? "SHOT!" : "PASS!");
}

function shoot() {
  kickBall(790);
}

function pass() {
  kickBall(410);
}

// ==========================================
// CAMERA
// ==========================================

function updateCamera(dt) {
  if (!cameraEnabled) {
    camera.x = CENTER_X;
    camera.y = CENTER_Y;
    return;
  }

  const targetX = ball.x * 0.72 + blue.x * 0.28;
  const targetY = ball.y * 0.72 + blue.y * 0.28;
  const smoothing = 1 - Math.exp(-5 * dt);

  camera.x += (targetX - camera.x) * smoothing;
  camera.y += (targetY - camera.y) * smoothing;

  const halfWidth = canvas.width / (2 * camera.zoom);
  const halfHeight = canvas.height / (2 * camera.zoom);

  camera.x = clamp(camera.x, FIELD.x + halfWidth, FIELD.x + FIELD.width - halfWidth);
  camera.y = clamp(camera.y, FIELD.y + halfHeight, FIELD.y + FIELD.height - halfHeight);
}

// ==========================================
// DRAW THE PITCH
// ==========================================

function drawPitch() {
  ctx.fillStyle = "#18251a";
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(FIELD.x, FIELD.y, FIELD.width, FIELD.height);

  if (stripesEnabled) {
    const stripeCount = 12;
    const stripeWidth = FIELD.width / stripeCount;

    for (let i = 0; i < stripeCount; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = COLORS.grassLight;
        ctx.fillRect(FIELD.x + i * stripeWidth, FIELD.y, stripeWidth, FIELD.height);
      }
    }
  }

  ctx.strokeStyle = COLORS.lines;
  ctx.lineWidth = 5;

  ctx.strokeRect(FIELD.x, FIELD.y, FIELD.width, FIELD.height);

  ctx.beginPath();
  ctx.moveTo(CENTER_X, FIELD.y);
  ctx.lineTo(CENTER_X, FIELD.y + FIELD.height);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(CENTER_X, CENTER_Y, 150, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = COLORS.lines;
  ctx.beginPath();
  ctx.arc(CENTER_X, CENTER_Y, 6, 0, Math.PI * 2);
  ctx.fill();

  const penaltyWidth = 270;
  const penaltyHeight = 570;

  ctx.strokeRect(FIELD.x, CENTER_Y - penaltyHeight / 2, penaltyWidth, penaltyHeight);
  ctx.strokeRect(FIELD.x + FIELD.width - penaltyWidth, CENTER_Y - penaltyHeight / 2, penaltyWidth, penaltyHeight);

  const goalAreaWidth = 110;
  const goalAreaHeight = 300;

  ctx.strokeRect(FIELD.x, CENTER_Y - goalAreaHeight / 2, goalAreaWidth, goalAreaHeight);
  ctx.strokeRect(FIELD.x + FIELD.width - goalAreaWidth, CENTER_Y - goalAreaHeight / 2, goalAreaWidth, goalAreaHeight);

  const goalWidth = 55;
  const goalHeight = 220;

  ctx.fillStyle = "#dce5dc";
  ctx.fillRect(FIELD.x - goalWidth, CENTER_Y - goalHeight / 2, goalWidth, goalHeight);
  ctx.fillRect(FIELD.x + FIELD.width, CENTER_Y - goalHeight / 2, goalWidth, goalHeight);

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 4;
  ctx.strokeRect(FIELD.x - goalWidth, CENTER_Y - goalHeight / 2, goalWidth, goalHeight);
  ctx.strokeRect(FIELD.x + FIELD.width, CENTER_Y - goalHeight / 2, goalWidth, goalHeight);
}

// ==========================================
// DRAW PLAYERS AND BALL
// ==========================================

function drawPlayer(player) {
  ctx.save();

  ctx.fillStyle = "#0004";
  ctx.beginPath();
  ctx.ellipse(player.x + 3, player.y + 7, player.radius * 1.05, player.radius * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = player.team === "blue" ? COLORS.blueDark : COLORS.redDark;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius + 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff35";
  ctx.beginPath();
  ctx.arc(player.x - 6, player.y - 7, player.radius * 0.42, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(player.number), player.x, player.y + 1);

  ctx.restore();
}

function drawBall() {
  ctx.save();

  ctx.fillStyle = "#0004";
  ctx.beginPath();
  ctx.ellipse(ball.x + 3, ball.y + 6, ball.radius * 1.1, ball.radius * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#26312a";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ==========================================
// MINIMAP
// ==========================================

function drawMinimapDot(object, color, radius) {
  const x = object.x / WORLD_WIDTH * minimap.width;
  const y = object.y / WORLD_HEIGHT * minimap.height;

  minimapCtx.fillStyle = color;
  minimapCtx.beginPath();
  minimapCtx.arc(x, y, radius, 0, Math.PI * 2);
  minimapCtx.fill();
}

function drawMinimap() {
  const w = minimap.width;
  const h = minimap.height;

  const sx = w / WORLD_WIDTH;
  const sy = h / WORLD_HEIGHT;

  minimapCtx.clearRect(0, 0, w, h);
  minimapCtx.fillStyle = "#18251a";
  minimapCtx.fillRect(0, 0, w, h);

  minimapCtx.fillStyle = COLORS.grass;
  minimapCtx.fillRect(FIELD.x * sx, FIELD.y * sy, FIELD.width * sx, FIELD.height * sy);

  if (stripesEnabled) {
    for (let i = 0; i < 12; i++) {
      if (i % 2 === 0) {
        minimapCtx.fillStyle = COLORS.grassLight;
        minimapCtx.fillRect(
          (FIELD.x + FIELD.width * i / 12) * sx,
          FIELD.y * sy,
          FIELD.width / 12 * sx,
          FIELD.height * sy
        );
      }
    }
  }

  minimapCtx.strokeStyle = "#ffffffc9";
  minimapCtx.lineWidth = 1.5;

  minimapCtx.strokeRect(FIELD.x * sx, FIELD.y * sy, FIELD.width * sx, FIELD.height * sy);

  minimapCtx.beginPath();
  minimapCtx.moveTo(CENTER_X * sx, FIELD.y * sy);
  minimapCtx.lineTo(CENTER_X * sx, (FIELD.y + FIELD.height) * sy);
  minimapCtx.stroke();

  minimapCtx.beginPath();
  minimapCtx.arc(CENTER_X * sx, CENTER_Y * sy, 150 * sx, 0, Math.PI * 2);
  minimapCtx.stroke();

  drawMinimapDot(blue, COLORS.blue, 5);
  drawMinimapDot(red, COLORS.red, 5);
  drawMinimapDot(ball, "#ffffff", 3.5);

  const viewWidth = canvas.width / camera.zoom;
  const viewHeight = canvas.height / camera.zoom;

  minimapCtx.strokeStyle = "#fff";
  minimapCtx.lineWidth = 1.5;
  minimapCtx.strokeRect(
    (camera.x - viewWidth / 2) * sx,
    (camera.y - viewHeight / 2) * sy,
    viewWidth * sx,
    viewHeight * sy
  );
}

// ==========================================
// RENDER
// ==========================================

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  drawPitch();
  drawPlayer(blue);
  drawPlayer(red);
  drawBall();

  ctx.restore();

  drawMinimap();
}

// ==========================================
// GAME LOOP
// ==========================================

function update(dt) {
  if (!running || paused) return;

  if (goalTimer > 0) {
    goalTimer -= dt;

    if (goalTimer <= 0) {
      hideGoalBanner();
      resetPositions();
      setStatus("KICKOFF");
    }
    return;
  }

  if (kickoffTimer > 0) {
    kickoffTimer -= dt;
    updateCamera(dt);
    return;
  }

  updateBlue(dt);
  updateRed(dt);
  resolvePlayerCollision();
  updateBall(dt);
  updateCamera(dt);
}

function gameLoop(timestamp) {
  const dt = lastFrameTime === 0 ? 0 : Math.min((timestamp - lastFrameTime) / 1000, 0.033);
  lastFrameTime = timestamp;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

// ==========================================
// SCREEN CONTROLS
// ==========================================

function startMatch() {
  resetMatch();
  menuScreen.hidden = true;
  matchScreen.hidden = false;
  running = true;
  paused = false;
  setStatus("KICKOFF");
}

function returnToMenu() {
  running = false;
  paused = false;
  keys.clear();
  touchDirections.clear();

  menuScreen.hidden = false;
  matchScreen.hidden = true;
  pauseOverlay.hidden = true;
}

function togglePause() {
  if (!running) return;

  paused = !paused;
  pauseOverlay.hidden = !paused;
  pauseButton.textContent = paused ? "RESUME" : "PAUSE";

  keys.clear();
  touchDirections.clear();

  setStatus(paused ? "PAUSED" : "MATCH ON");
}

playButton.addEventListener("click", startMatch);
menuButton.addEventListener("click", returnToMenu);

resetButton.addEventListener("click", () => {
  resetMatch();
});

pauseButton.addEventListener("click", togglePause);
resumeButton.addEventListener("click", togglePause);

cameraButton.addEventListener("click", () => {
  cameraEnabled = !cameraEnabled;
  cameraButton.setAttribute("aria-pressed", String(cameraEnabled));
});

grassButton.addEventListener("click", () => {
  stripesEnabled = !stripesEnabled;
  grassButton.setAttribute("aria-pressed", String(stripesEnabled));
});

passButton.addEventListener("click", pass);
shootButton.addEventListener("click", shoot);

sprintButton.addEventListener("pointerdown", event => {
  event.preventDefault();
  touchDirections.add("sprint");
});

function releaseSprint() {
  touchDirections.delete("sprint");
}

sprintButton.addEventListener("pointerup", releaseSprint);
sprintButton.addEventListener("pointercancel", releaseSprint);
sprintButton.addEventListener("lostpointercapture", releaseSprint);

// Keyboard.
window.addEventListener("keydown", event => {
  const key = event.key.toLowerCase();

  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
    event.preventDefault();
  }

  keys.add(key);

  if (event.repeat) return;

  if (key === " ") shoot();
  if (key === "e") pass();
  if (key === "escape" && running) togglePause();
});

window.addEventListener("keyup", event => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("blur", () => {
  keys.clear();
  touchDirections.clear();
});

// Touch directional controls.
document.querySelectorAll("[data-move]").forEach(button => {
  const direction = button.dataset.move;

  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    touchDirections.add(direction);
  });

  function releaseDirection() {
    touchDirections.delete(direction);
  }

  button.addEventListener("pointerup", releaseDirection);
  button.addEventListener("pointercancel", releaseDirection);
  button.addEventListener("lostpointercapture", releaseDirection);
});

// Start with the menu visible.
resetMatch();
menuScreen.hidden = false;
matchScreen.hidden = true;

render();
requestAnimationFrame(gameLoop);
