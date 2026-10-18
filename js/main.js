// ==========================================
// KICKOFF FOOTBALL — MAIN GAME
// ==========================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Screens
const menuScreen = document.getElementById("menuScreen");
const matchScreen = document.getElementById("matchScreen");

// Buttons
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

// Scoreboard
const blueScoreElement = document.getElementById("blueScore");
const redScoreElement = document.getElementById("redScore");
const matchBlueScoreElement =
  document.getElementById("matchBlueScore");
const matchRedScoreElement =
  document.getElementById("matchRedScore");

const matchStatus = document.getElementById("matchStatus");
const liveMatchStatus = document.getElementById("liveMatchStatus");
const pauseOverlay = document.getElementById("pauseOverlay");
const goalBanner = document.getElementById("goalBanner");
const goalText = document.getElementById("goalText");

// ==========================================
// GAME SETTINGS
// ==========================================

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
  lines: "rgba(255,255,255,0.78)",
  blue: "#36a5ff",
  blueDark: "#1474d1",
  red: "#ff5358",
  redDark: "#c92f3c",
  ball: "#ffffff"
};

let blueScore = 0;
let redScore = 0;

let running = false;
let paused = false;
let cameraEnabled = true;
let stripesEnabled = true;

let lastFrameTime = 0;
let goalTimer = 0;
let kickOffTimer = 0;

const keys = new Set();
const touchDirections = new Set();

// ==========================================
// PLAYERS AND BALL
// ==========================================

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
// HELPERS
// ==========================================

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function normalize(x, y) {
  const length = Math.hypot(x, y);

  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: x / length,
    y: y / length
  };
}

function setStatus(message) {
  if (matchStatus) {
    matchStatus.textContent = message;
  }

  if (liveMatchStatus) {
    liveMatchStatus.textContent = message;
  }
}

function updateScoreboard() {
  blueScoreElement.textContent = blueScore;
  redScoreElement.textContent = redScore;

  matchBlueScoreElement.textContent = blueScore;
  matchRedScoreElement.textContent = redScore;
}

function hideGoalBanner() {
  if (goalBanner) {
    goalBanner.hidden = true;
  }
}

function showGoalBanner(message) {
  if (!goalBanner || !goalText) {
    return;
  }

  goalText.textContent = message;
  goalBanner.hidden = false;
}

// ==========================================
// RESET AND KICKOFF
// ==========================================

function resetPositions() {
  blue.x = CENTER_X - 130;
  blue.y = CENTER_Y;
  blue.vx = 0;
  blue.vy = 0;

  red.x = CENTER_X + 150;
  red.y = CENTER_Y;
  red.vx = 0;
  red.vy = 0;

  ball.x = CENTER_X;
  ball.y = CENTER_Y;
  ball.vx = 0;
  ball.vy = 0;

  camera.x = CENTER_X;
  camera.y = CENTER_Y;

  kickOffTimer = 0.8;
}

function resetMatch() {
  blueScore = 0;
  redScore = 0;

  paused = false;
  goalTimer = 0;
  kickOffTimer = 0;

  if (pauseOverlay) {
    pauseOverlay.hidden = true;
  }

  hideGoalBanner();
  resetPositions();
  updateScoreboard();
  setStatus("READY FOR KICKOFF");
}

function scoreGoal(team) {
  if (goalTimer > 0) {
    return;
  }

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
  kickOffTimer = 2.2;

  blue.vx = 0;
  blue.vy = 0;
  red.vx = 0;
  red.vy = 0;
  ball.vx = 0;
  ball.vy = 0;
}

// ==========================================
// MOVEMENT INPUT
// ==========================================

function isDown(...names) {
  return names.some(name =>
    keys.has(name) || touchDirections.has(name)
  );
}

function getMovement() {
  let x = 0;
  let y = 0;

  if (isDown("a", "arrowleft", "left")) x -= 1;
  if (isDown("d", "arrowright", "right")) x += 1;
  if (isDown("w", "arrowup", "up")) y -= 1;
  if (isDown("s", "arrowdown", "down")) y += 1;

  return normalize(x, y);
}

function updateBlue(dt) {
  const movement = getMovement();
  const sprinting =
    keys.has("shift") || touchDirections.has("sprint");

  const speed = blue.speed * (sprinting ? 1.45 : 1);

  blue.vx = movement.x * speed;
  blue.vy = movement.y * speed;

  blue.x += blue.vx * dt;
  blue.y += blue.vy * dt;

  blue.x = clamp(
    blue.x,
    FIELD.x + blue.radius,
    FIELD.x + FIELD.width - blue.radius
  );

  blue.y = clamp(
    blue.y,
    FIELD.y + blue.radius,
    FIELD.y + FIELD.height - blue.radius
  );
}

// ==========================================
// RED TEAM AI
// ==========================================

function updateRed(dt) {
  const target = distance(red, ball);
  let direction;

  if (target > red.radius + ball.radius + 3) {
    direction = normalize(ball.x - red.x, ball.y - red.y);
  } else {
    direction = { x: 0, y: 0 };
  }

  red.vx = direction.x * red.speed;
  red.vy = direction.y * red.speed;

  red.x += red.vx * dt;
  red.y += red.vy * dt;

  red.x = clamp(
    red.x,
    FIELD.x + red.radius,
    FIELD.x + FIELD.width - red.radius
  );

  red.y = clamp(
    red.y,
    FIELD.y + red.radius,
    FIELD.y + FIELD.height - red.radius
  );
}

// ==========================================
// PLAYER COLLISION
// ==========================================

function resolvePlayerCollision() {
  const dx = red.x - blue.x;
  const dy = red.y - blue.y;
  const dist = Math.hypot(dx, dy);
  const minimumDistance = blue.radius + red.radius;

  if (dist >= minimumDistance) {
    return;
  }

  const normal = dist === 0
    ? { x: 1, y: 0 }
    : { x: dx / dist, y: dy / dist };

  const overlap = minimumDistance - dist;

  // Separate the players so they cannot overlap.
  blue.x -= normal.x * overlap / 2;
  blue.y -= normal.y * overlap / 2;

  red.x += normal.x * overlap / 2;
  red.y += normal.y * overlap / 2;

  // Prevent them from sticking together.
  const relativeVelocity =
    (red.vx - blue.vx) * normal.x +
    (red.vy - blue.vy) * normal.y;

  if (relativeVelocity < 0) {
    const impulse = -relativeVelocity * 0.55;

    blue.vx -= impulse * normal.x;
    blue.vy -= impulse * normal.y;

    red.vx += impulse * normal.x;
    red.vy += impulse * normal.y;
  }

  blue.x = clamp(
    blue.x,
    FIELD.x + blue.radius,
    FIELD.x + FIELD.width - blue.radius
  );

  blue.y = clamp(
    blue.y,
    FIELD.y + blue.radius,
    FIELD.y + FIELD.height - blue.radius
  );

  red.x = clamp(
    red.x,
    FIELD.x + red.radius,
    FIELD.x + FIELD.width - red.radius
  );

  red.y = clamp(
    red.y,
    FIELD.y + red.radius,
    FIELD.y + FIELD.height - red.radius
  );
}

// ==========================================
// BALL PHYSICS
// ==========================================

function pushBallFromPlayer(player, dt) {
  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const dist = Math.hypot(dx, dy);
  const minimumDistance = player.radius + ball.radius;

  if (dist >= minimumDistance) {
    return;
  }

  const normal = dist === 0
    ? { x: player.team === "blue" ? 1 : -1, y: 0 }
    : { x: dx / dist, y: dy / dist };

  // Move the ball outside the player.
  const overlap = minimumDistance - dist;

  ball.x += normal.x * overlap;
  ball.y += normal.y * overlap;

  // Nudge the ball in the direction of player movement.
  const movementSpeed = Math.hypot(player.vx, player.vy);

  if (movementSpeed > 0) {
    ball.vx += player.vx * dt * 1.8;
    ball.vy += player.vy * dt * 1.8;
  }

  // Keep the ball from getting trapped inside the player.
  const inwardSpeed =
    ball.vx * normal.x + ball.vy * normal.y;

  if (inwardSpeed < 0) {
    ball.vx -= inwardSpeed * normal.x;
    ball.vy -= inwardSpeed * normal.y;
  }
}

function updateBall(dt) {
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Ball friction.
  const friction = Math.exp(-1.15 * dt);
  ball.vx *= friction;
  ball.vy *= friction;

  if (Math.hypot(ball.vx, ball.vy) < 4) {
    ball.vx = 0;
    ball.vy = 0;
  }

  // Top and bottom touchlines.
  const top = FIELD.y + ball.radius;
  const bottom =
    FIELD.y + FIELD.height - ball.radius;

  if (ball.y < top) {
    ball.y = top;
    ball.vy = Math.abs(ball.vy) * 0.72;
  }

  if (ball.y > bottom) {
    ball.y = bottom;
    ball.vy = -Math.abs(ball.vy) * 0.72;
  }

  // Left and right goals.
  const left = FIELD.x;
  const right = FIELD.x + FIELD.width;

  const goalHeight = 220;
  const goalTop = CENTER_Y - goalHeight / 2;
  const goalBottom = CENTER_Y + goalHeight / 2;

  const insideGoalMouth =
    ball.y > goalTop && ball.y < goalBottom;

  if (ball.x < left + ball.radius) {
    if (insideGoalMouth) {
      scoreGoal("red");
      return;
    }

    ball.x = left + ball.radius;
    ball.vx = Math.abs(ball.vx) * 0.72;
  }

  if (ball.x > right - ball.radius) {
    if (insideGoalMouth) {
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
  return distance(blue, ball) <=
    blue.radius + ball.radius + 5;
}

function kickBall(power, lift = 0) {
  if (!running || paused || goalTimer > 0 || kickOffTimer > 0) {
    return;
  }

  // You must be close enough to touch the ball.
  if (!canKickBall()) {
    setStatus("GET CLOSER TO THE BALL");
    return;
  }

  // Free aim: the ball travels away from your player.
  let direction = normalize(
    ball.x - blue.x,
    ball.y - blue.y
  );

  // If the player and ball centres overlap, use the
  // direction the player is facing/moving.
  if (direction.x === 0 && direction.y === 0) {
    direction = normalize(blue.vx, blue.vy);

    if (direction.x === 0 && direction.y === 0) {
      direction = { x: 1, y: 0 };
    }
  }

  ball.vx += direction.x * power;
  ball.vy += direction.y * power + lift;

  // Keep the ball outside the player's body.
  ball.x = blue.x + direction.x *
    (blue.radius + ball.radius + 2);

  ball.y = blue.y + direction.y *
    (blue.radius + ball.radius + 2);

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

  // Keep the action near the centre of the screen.
  const targetX = ball.x * 0.72 + blue.x * 0.28;
  const targetY = ball.y * 0.72 + blue.y * 0.28;

  const smoothing = 1 - Math.exp(-5 * dt);

  camera.x += (targetX - camera.x) * smoothing;
  camera.y += (targetY - camera.y) * smoothing;

  // Keep the camera within the pitch.
  const halfWidth = canvas.width / (2 * camera.zoom);
  const halfHeight = canvas.height / (2 * camera.zoom);

  camera.x = clamp(
    camera.x,
    FIELD.x + halfWidth,
    FIELD.x + FIELD.width - halfWidth
  );

  camera.y = clamp(
    camera.y,
    FIELD.y + halfHeight,
    FIELD.y + FIELD.height - halfHeight
  );
}

// ==========================================
// PITCH RENDERING
// ==========================================

function drawPitch() {
  ctx.fillStyle = "#18251a";
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(
    FIELD.x,
    FIELD.y,
    FIELD.width,
    FIELD.height
  );

  if (stripesEnabled) {
    const stripeCount = 12;
    const stripeWidth = FIELD.width / stripeCount;

    for (let i = 0; i < stripeCount; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = COLORS.grassLight;
        ctx.fillRect(
          FIELD.x + i * stripeWidth,
          FIELD.y,
          stripeWidth,
          FIELD.height
        );
      }
    }
  }

  ctx.strokeStyle = COLORS.lines;
  ctx.lineWidth = 5;

  // Outer boundary.
  ctx.strokeRect(
    FIELD.x,
    FIELD.y,
    FIELD.width,
    FIELD.height
  );

  // Halfway line.
  ctx.beginPath();
  ctx.moveTo(CENTER_X, FIELD.y);
  ctx.lineTo(CENTER_X, FIELD.y + FIELD.height);
  ctx.stroke();

  // Centre circle.
  ctx.beginPath();
  ctx.arc(CENTER_X, CENTER_Y, 150, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = COLORS.lines;
  ctx.beginPath();
  ctx.arc(CENTER_X, CENTER_Y, 6, 0, Math.PI * 2);
  ctx.fill();

  // Penalty areas.
  const penaltyWidth = 270;
  const penaltyHeight = 570;

  ctx.strokeRect(
    FIELD.x,
    CENTER_Y - penaltyHeight / 2,
    penaltyWidth,
    penaltyHeight
  );

  ctx.strokeRect(
    FIELD.x + FIELD.width - penaltyWidth,
    CENTER_Y - penaltyHeight / 2,
    penaltyWidth,
    penaltyHeight
  );

  // Goal areas.
  const goalAreaWidth = 110;
  const goalAreaHeight = 300;

  ctx.strokeRect(
    FIELD.x,
    CENTER_Y - goalAreaHeight / 2,
    goalAreaWidth,
    goalAreaHeight
  );

  ctx.strokeRect(
    FIELD.x + FIELD.width - goalAreaWidth,
    CENTER_Y - goalAreaHeight / 2,
    goalAreaWidth,
    goalAreaHeight
  );

  // Goals.
  const goalWidth = 55;
  const goalHeight = 220;

  ctx.fillStyle = "#dce5dc";
  ctx.fillRect(
    FIELD.x - goalWidth,
    CENTER_Y - goalHeight / 2,
    goalWidth,
    goalHeight
  );

  ctx.fillRect(
    FIELD.x + FIELD.width,
    CENTER_Y - goalHeight / 2,
    goalWidth,
    goalHeight
  );

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;

  ctx.strokeRect(
    FIELD.x - goalWidth,
    CENTER_Y - goalHeight / 2,
    goalWidth,
    goalHeight
  );

  ctx.strokeRect(
    FIELD.x + FIELD.width,
    CENTER_Y - goalHeight / 2,
    goalWidth,
    goalHeight
  );
}

// ==========================================
// PLAYER RENDERING
// ==========================================

function drawPlayer(player) {
  ctx.save();

  // Player shadow.
  ctx.fillStyle = "rgba(0,0,0,0.24)";
  ctx.beginPath();
  ctx.ellipse(
    player.x + 3,
    player.y + 7,
    player.radius * 1.05,
    player.radius * 0.85,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Player outline.
  ctx.fillStyle = player.team === "blue"
    ? COLORS.blueDark
    : COLORS.redDark;

  ctx.beginPath();
  ctx.arc(
    player.x,
    player.y,
    player.radius + 4,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Main jersey circle.
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(
    player.x,
    player.y,
    player.radius,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Jersey highlight.
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.beginPath();
  ctx.arc(
    player.x - 6,
    player.y - 7,
    player.radius * 0.42,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Player number.
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    String(player.number),
    player.x,
    player.y + 1
  );

  ctx.restore();
}

// ==========================================
// BALL RENDERING
// ==========================================

function drawBall() {
  ctx.save();

  // Ball shadow.
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(
    ball.x + 3,
    ball.y + 6,
    ball.radius * 1.1,
    ball.radius * 0.8,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Ball body.
  ctx.fillStyle = COLORS.ball;
  ctx.beginPath();
  ctx.arc(
    ball.x,
    ball.y,
    ball.radius,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Simple ball pattern.
  ctx.fillStyle = "#26312a";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ==========================================
// RENDER FRAME
// ==========================================

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();

  // Zoomed-in, ball-following camera.
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  drawPitch();

  drawPlayer(blue);
  drawPlayer(red);
  drawBall();

  ctx.restore();
}

// ==========================================
// GAME LOOP
// ==========================================

function update(dt) {
  if (!running || paused) {
    return;
  }

  if (goalTimer > 0) {
    goalTimer -= dt;

    if (goalTimer <= 0) {
      hideGoalBanner();
      resetPositions();
      setStatus("KICKOFF");
    }

    return;
  }

  if (kickOffTimer > 0) {
    kickOffTimer -= dt;
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
  const dt = lastFrameTime === 0
    ? 0
    : Math.min((timestamp - lastFrameTime) / 1000, 0.033);

  lastFrameTime = timestamp;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

// ==========================================
// SCREEN NAVIGATION
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

  menuScreen.hidden = false;
  matchScreen.hidden = true;

  if (pauseOverlay) {
    pauseOverlay.hidden = true;
  }

  keys.clear();
  touchDirections.clear();
}

function togglePause() {
  if (!running) {
    return;
  }

  paused = !paused;

  if (pauseOverlay) {
    pauseOverlay.hidden = !paused;
  }

  pauseButton.textContent = paused ? "RESUME" : "PAUSE";

  if (paused) {
    setStatus("PAUSED");
    keys.clear();
    touchDirections.clear();
  } else {
    setStatus("MATCH ON");
  }
}

// ==========================================
// BUTTON EVENTS
// ==========================================

playButton.addEventListener("click", startMatch);
menuButton.addEventListener("click", returnToMenu);

resetButton.addEventListener("click", () => {
  resetMatch();
  setStatus("READY FOR KICKOFF");
});

pauseButton.addEventListener("click", togglePause);
resumeButton.addEventListener("click", togglePause);

cameraButton.addEventListener("click", () => {
  cameraEnabled = !cameraEnabled;

  cameraButton.setAttribute(
    "aria-pressed",
    String(cameraEnabled)
  );
});

grassButton.addEventListener("click", () => {
  stripesEnabled = !stripesEnabled;

  grassButton.setAttribute(
    "aria-pressed",
    String(stripesEnabled)
  );
});

passButton.addEventListener("click", pass);
shootButton.addEventListener("click", shoot);

function setSprint(active) {
  if (active) {
    touchDirections.add("sprint");
  } else {
    touchDirections.delete("sprint");
  }
}

sprintButton.addEventListener("pointerdown", event => {
  event.preventDefault();
  setSprint(true);
});

function releaseSprint() {
  setSprint(false);
}

sprintButton.addEventListener("pointerup", releaseSprint);
sprintButton.addEventListener("pointercancel", releaseSprint);
sprintButton.addEventListener("lostpointercapture", releaseSprint);

// ==========================================
// KEYBOARD CONTROLS
// ==========================================

window.addEventListener("keydown", event => {
  const key = event.key.toLowerCase();

  if (
    ["w", "a", "s", "d", "arrowup", "arrowdown",
      "arrowleft", "arrowright", " "].includes(key)
  ) {
    event.preventDefault();
  }

  keys.add(key);

  if (event.repeat) {
    return;
  }

  if (key === " ") {
    shoot();
  }

  if (key === "e") {
    pass();
  }

  if (key === "escape" && running) {
    togglePause();
  }
});

window.addEventListener("keyup", event => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("blur", () => {
  keys.clear();
  touchDirections.clear();
});

// ==========================================
// MOBILE DIRECTION BUTTONS
// ==========================================

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

// ==========================================
// INITIALIZE
// ==========================================

resetMatch();
menuScreen.hidden = false;
matchScreen.hidden = true;

render();
requestAnimationFrame(gameLoop);
