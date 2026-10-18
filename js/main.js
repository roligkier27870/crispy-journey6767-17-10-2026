const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const minimap = document.getElementById("minimap");
const mapCtx = minimap.getContext("2d");

const menuScreen = document.getElementById("menuScreen");
const matchScreen = document.getElementById("matchScreen");
const playButton = document.getElementById("playButton");
const pauseButton = document.getElementById("pauseButton");
const resumeButton = document.getElementById("resumeButton");
const pauseOverlay = document.getElementById("pauseOverlay");
const cameraButton = document.getElementById("cameraButton");
const grassButton = document.getElementById("grassButton");
const matchStatus = document.getElementById("matchStatus");
const blueScoreText = document.getElementById("blueScore");
const redScoreText = document.getElementById("redScore");

const WORLD = { width: 2400, height: 1400 };
const FIELD = { x: 60, y: 60, width: 2280, height: 1280 };
const GOAL = { height: 250, depth: 48 };
const CAMERA_ZOOM = 1.18;

const keys = new Set();
const touchMoves = new Set();

let blueScore = 0;
let redScore = 0;
let running = false;
let paused = false;
let cameraFollow = true;
let stripedPitch = true;
let lastFrame = 0;
let kickoffTimer = 0;
let statusTimer = 0;

const camera = { x: WORLD.width / 2, y: WORLD.height / 2 };

const blue = {
  x: WORLD.width * 0.38,
  y: WORLD.height / 2,
  vx: 0, vy: 0,
  radius: 25,
  speed: 340,
  color: "#40a5ff",
  number: 10,
  team: "BLUE"
};

const red = {
  x: WORLD.width * 0.62,
  y: WORLD.height / 2,
  vx: 0, vy: 0,
  radius: 25,
  speed: 245,
  color: "#ff5d68",
  number: 9,
  team: "RED"
};

const ball = {
  x: WORLD.width / 2,
  y: WORLD.height / 2,
  vx: 0, vy: 0,
  radius: 13
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function length(x, y) {
  return Math.hypot(x, y);
}

function normalize(x, y) {
  const magnitude = length(x, y);
  if (magnitude < 0.0001) return { x: 0, y: 0 };
  return { x: x / magnitude, y: y / magnitude };
}

function setStatus(message, duration = 1.5) {
  matchStatus.textContent = message;
  statusTimer = duration;
}

function updateScoreboard() {
  blueScoreText.textContent = blueScore;
  redScoreText.textContent = redScore;
}

function clampPlayer(player) {
  player.x = clamp(
    player.x,
    FIELD.x + player.radius,
    FIELD.x + FIELD.width - player.radius
  );
  player.y = clamp(
    player.y,
    FIELD.y + player.radius,
    FIELD.y + FIELD.height - player.radius
  );
}

function resetPositions() {
  blue.x = WORLD.width * 0.38;
  blue.y = WORLD.height / 2;
  blue.vx = 0;
  blue.vy = 0;

  red.x = WORLD.width * 0.62;
  red.y = WORLD.height / 2;
  red.vx = 0;
  red.vy = 0;

  ball.x = WORLD.width / 2;
  ball.y = WORLD.height / 2;
  ball.vx = 0;
  ball.vy = 0;

  camera.x = ball.x;
  camera.y = ball.y;
  kickoffTimer = 0.8;
}

function resetMatch() {
  blueScore = 0;
  redScore = 0;
  updateScoreboard();
  resetPositions();
  setStatus("READY FOR KICKOFF");
}

function startMatch() {
  menuScreen.hidden = true;
  matchScreen.hidden = false;
  running = true;
  paused = false;
  pauseOverlay.hidden = true;
  resetMatch();
  setStatus("KICKOFF", 1.2);
  lastFrame = performance.now();
  requestAnimationFrame(loop);
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  pauseOverlay.hidden = !paused;
  pauseButton.textContent = paused ? "▶ RESUME" : "Ⅱ PAUSE";

  if (paused) {
    setStatus("MATCH PAUSED", 9999);
  } else {
    setStatus("PLAY ON", 1);
    lastFrame = performance.now();
    requestAnimationFrame(loop);
  }
}

function getMovement() {
  let x = 0;
  let y = 0;

  if (keys.has("a") || keys.has("arrowleft") || touchMoves.has("left")) x -= 1;
  if (keys.has("d") || keys.has("arrowright") || touchMoves.has("right")) x += 1;
  if (keys.has("w") || keys.has("arrowup") || touchMoves.has("up")) y -= 1;
  if (keys.has("s") || keys.has("arrowdown") || touchMoves.has("down")) y += 1;

  return normalize(x, y);
}

function updatePlayer(player, direction, dt, sprint = false) {
  const targetSpeed = player.speed * (sprint ? 1.42 : 1);
  const acceleration = 11;
  player.vx += (direction.x * targetSpeed - player.vx) * Math.min(1, acceleration * dt);
  player.vy += (direction.y * targetSpeed - player.vy) * Math.min(1, acceleration * dt);

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  clampPlayer(player);
}

function updateAI(dt) {
  // The red player chases the ball, then attempts to move it toward the blue goal.
  const distanceToBall = length(ball.x - red.x, ball.y - red.y);
  let targetX = ball.x;
  let targetY = ball.y;

  if (distanceToBall < red.radius + ball.radius + 9) {
    targetX = FIELD.x + 90;
    targetY = WORLD.height / 2;
  }

  const direction = normalize(targetX - red.x, targetY - red.y);
  updatePlayer(red, direction, dt, distanceToBall > 500);
}

function separatePlayers() {
  const dx = red.x - blue.x;
  const dy = red.y - blue.y;
  const distance = length(dx, dy);
  const minDistance = blue.radius + red.radius;

  if (distance < minDistance && distance > 0.001) {
    const overlap = minDistance - distance;
    const nx = dx / distance;
    const ny = dy / distance;

    blue.x -= nx * overlap * 0.5;
    blue.y -= ny * overlap * 0.5;
    red.x += nx * overlap * 0.5;
    red.y += ny * overlap * 0.5;

    const relativeVelocity = (red.vx - blue.vx) * nx + (red.vy - blue.vy) * ny;

    if (relativeVelocity < 0) {
      blue.vx += nx * relativeVelocity * 0.5;
      blue.vy += ny * relativeVelocity * 0.5;
      red.vx -= nx * relativeVelocity * 0.5;
      red.vy -= ny * relativeVelocity * 0.5;
    }

    clampPlayer(blue);
    clampPlayer(red);
  }
}

function playerTouchesBall(player) {
  return length(ball.x - player.x, ball.y - player.y)
    <= player.radius + ball.radius + 7;
}

function updateBall(dt) {
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  const friction = Math.pow(0.985, dt * 60);
  ball.vx *= friction;
  ball.vy *= friction;

  if (Math.abs(ball.vx) < 2) ball.vx = 0;
  if (Math.abs(ball.vy) < 2) ball.vy = 0;

  const fieldTop = FIELD.y;
  const fieldBottom = FIELD.y + FIELD.height;
  const fieldLeft = FIELD.x;
  const fieldRight = FIELD.x + FIELD.width;
  const goalTop = WORLD.height / 2 - GOAL.height / 2;
  const goalBottom = WORLD.height / 2 + GOAL.height / 2;

  // Goals are open only in the goal-mouth area.
  if (ball.x < fieldLeft && ball.y > goalTop && ball.y < goalBottom) {
    redScore++;
    updateScoreboard();
    resetPositions();
    setStatus("GOAL FOR RED UNITED!", 2.2);
    return;
  }

  if (ball.x > fieldRight && ball.y > goalTop && ball.y < goalBottom) {
    blueScore++;
    updateScoreboard();
    resetPositions();
    setStatus("GOAL FOR BLUE FC!", 2.2);
    return;
  }

  // Outside the goal mouth, the pitch boundary reflects the ball.
  if (ball.y - ball.radius < fieldTop) {
    ball.y = fieldTop + ball.radius;
    ball.vy = Math.abs(ball.vy) * 0.78;
  }

  if (ball.y + ball.radius > fieldBottom) {
    ball.y = fieldBottom - ball.radius;
    ball.vy = -Math.abs(ball.vy) * 0.78;
  }

  if (ball.x - ball.radius < fieldLeft &&
      !(ball.y > goalTop && ball.y < goalBottom)) {
    ball.x = fieldLeft + ball.radius;
    ball.vx = Math.abs(ball.vx) * 0.78;
  }

  if (ball.x + ball.radius > fieldRight &&
      !(ball.y > goalTop && ball.y < goalBottom)) {
    ball.x = fieldRight - ball.radius;
    ball.vx = -Math.abs(ball.vx) * 0.78;
  }

  // A simple player-to-ball collision gives the ball a little forward momentum.
  for (const player of [blue, red]) {
    const dx = ball.x - player.x;
    const dy = ball.y - player.y;
    const distance = length(dx, dy);
    const minDistance = player.radius + ball.radius;

    if (distance < minDistance && distance > 0.001) {
      const nx = dx / distance;
      const ny = dy / distance;

      ball.x = player.x + nx * minDistance;
      ball.y = player.y + ny * minDistance;

      const approach = player.vx * nx + player.vy * ny;
      if (approach > 0) {
        ball.vx += nx * approach * 0.75;
        ball.vy += ny * approach * 0.75;
      }
    }
  }
}

function kickBall(player, power, actionName) {
  if (!running || paused || kickoffTimer > 0) return;

  if (!playerTouchesBall(player)) {
    setStatus("GET CLOSER TO THE BALL", 0.9);
    return;
  }

  // Aim from the player toward the ball. If perfectly aligned, use the
  // player's current movement direction, with a forward fallback.
  let direction = normalize(ball.x - player.x, ball.y - player.y);

  if (length(direction.x, direction.y) < 0.001) {
    direction = normalize(player.vx, player.vy);
  }

  if (length(direction.x, direction.y) < 0.001) {
    direction = { x: player === blue ? 1 : -1, y: 0 };
  }

  ball.vx = direction.x * power + player.vx * 0.25;
  ball.vy = direction.y * power + player.vy * 0.25;

  setStatus(actionName, 0.65);
}

function updateCamera(dt) {
  if (!cameraFollow) return;

  const targetX = (ball.x * 0.72) + (blue.x * 0.28);
  const targetY = (ball.y * 0.72) + (blue.y * 0.28);
  const smoothing = 1 - Math.exp(-4 * dt);

  camera.x += (targetX - camera.x) * smoothing;
  camera.y += (targetY - camera.y) * smoothing;

  const halfWidth = canvas.width / (2 * CAMERA_ZOOM);
  const halfHeight = canvas.height / (2 * CAMERA_ZOOM);

  camera.x = clamp(camera.x, FIELD.x + halfWidth, FIELD.x + FIELD.width - halfWidth);
  camera.y = clamp(camera.y, FIELD.y + halfHeight, FIELD.y + FIELD.height - halfHeight);
}

function drawPitch(context, x, y, width, height, stripeCount = 12) {
  context.fillStyle = "#176d3c";
  context.fillRect(x, y, width, height);

  if (stripedPitch) {
    const stripeWidth = width / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      if (i % 2 === 0) {
        context.fillStyle = "#ffffff08";
        context.fillRect(x + i * stripeWidth, y, stripeWidth, height);
      }
    }
  }

  context.strokeStyle = "#d9ffe0";
  context.lineWidth = Math.max(2, width / 600);
  context.strokeRect(x, y, width, height);

  context.beginPath();
  context.moveTo(x + width / 2, y);
  context.lineTo(x + width / 2, y + height);
  context.stroke();

  context.beginPath();
  context.arc(x + width / 2, y + height / 2, height * 0.16, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = "#e8fff0";
  context.beginPath();
  context.arc(x + width / 2, y + height / 2, Math.max(2, width / 300), 0, Math.PI * 2);
  context.fill();

  const boxWidth = width * 0.15;
  const boxHeight = height * 0.36;
  const smallBoxWidth = width * 0.055;
  const smallBoxHeight = height * 0.17;

  context.strokeRect(x, y + (height - boxHeight) / 2, boxWidth, boxHeight);
  context.strokeRect(x + width - boxWidth, y + (height - boxHeight) / 2, boxWidth, boxHeight);
  context.strokeRect(x, y + (height - smallBoxHeight) / 2, smallBoxWidth, smallBoxHeight);
  context.strokeRect(x + width - smallBoxWidth, y + (height - smallBoxHeight) / 2, smallBoxWidth, smallBoxHeight);

  // Goals.
  context.fillStyle = "#e9fff0";
  context.fillRect(x - width * 0.018, y + (height - height * 0.195) / 2, width * 0.018, height * 0.195);
  context.fillRect(x + width, y + (height - height * 0.195) / 2, width * 0.018, height * 0.195);
}

function drawPlayer(player) {
  ctx.save();

  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 7, player.radius * 0.92, player.radius * 0.67, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#00130b66";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = player.color;
  ctx.fill();

  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ffffffcc";
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 19px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(player.number), player.x, player.y + 1);

  ctx.restore();
}

function drawBall() {
  ctx.save();

  ctx.beginPath();
  ctx.ellipse(ball.x + 3, ball.y + 6, ball.radius * 1.05, ball.radius * 0.72, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#00130b77";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#12202d";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = "#172333";
  ctx.fill();

  ctx.restore();
}

function drawMainGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0b3b25";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.translate(-camera.x, -camera.y);

  drawPitch(ctx, FIELD.x, FIELD.y, FIELD.width, FIELD.height);

  drawPlayer(blue);
  drawPlayer(red);
  drawBall();

  ctx.restore();

  if (kickoffTimer > 0) {
    ctx.save();
    ctx.fillStyle = "#06111dcc";
    ctx.fillRect(0, canvas.height - 38, canvas.width, 38);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 13px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("KICKOFF IN PROGRESS", canvas.width / 2, canvas.height - 19);
    ctx.restore();
  }
}

function drawMinimap() {
  const w = minimap.width;
  const h = minimap.height;
  mapCtx.clearRect(0, 0, w, h);

  const pad = 9;
  const scale = Math.min(
    (w - pad * 2) / WORLD.width,
    (h - pad * 2) / WORLD.height
  );
  const pitchW = FIELD.width * scale;
  const pitchH = FIELD.height * scale;
  const pitchX = (w - pitchW) / 2;
  const pitchY = (h - pitchH) / 2;

  // Entire pitch, scaled uniformly to fit in the small tactical window.
  drawPitch(mapCtx, pitchX, pitchY, pitchW, pitchH, 12);

  function marker(player, radius) {
    const px = pitchX + (player.x - FIELD.x) * scale;
    const py = pitchY + (player.y - FIELD.y) * scale;

    mapCtx.beginPath();
    mapCtx.arc(px, py, radius, 0, Math.PI * 2);
    mapCtx.fillStyle = player.color;
    mapCtx.fill();
    mapCtx.lineWidth = 1.5;
    mapCtx.strokeStyle = "#ffffff";
    mapCtx.stroke();
  }

  // Camera viewport rectangle shows which section is visible in the main view.
  const visibleWorldWidth = canvas.width / CAMERA_ZOOM;
  const visibleWorldHeight = canvas.height / CAMERA_ZOOM;
  const viewX = pitchX + (camera.x - visibleWorldWidth / 2 - FIELD.x) * scale;
  const viewY = pitchY + (camera.y - visibleWorldHeight / 2 - FIELD.y) * scale;

  mapCtx.save();
  mapCtx.strokeStyle = "#ffffffd9";
  mapCtx.lineWidth = 1.5;
  mapCtx.setLineDash([4, 3]);
  mapCtx.strokeRect(
    viewX,
    viewY,
    visibleWorldWidth * scale,
    visibleWorldHeight * scale
  );
  mapCtx.restore();

  marker(blue, 4.5);
  marker(red, 4.5);

  const ballX = pitchX + (ball.x - FIELD.x) * scale;
  const ballY = pitchY + (ball.y - FIELD.y) * scale;

  mapCtx.save();
  mapCtx.beginPath();
  mapCtx.arc(ballX, ballY, 3.4, 0, Math.PI * 2);
  mapCtx.fillStyle = "#ffffff";
  mapCtx.fill();
  mapCtx.lineWidth = 1.5;
  mapCtx.strokeStyle = "#142536";
  mapCtx.stroke();
  mapCtx.restore();
}

function update(dt) {
  if (statusTimer > 0) {
    statusTimer -= dt;
    if (statusTimer <= 0 && !paused) matchStatus.textContent = "MATCH IN PLAY";
  }

  if (kickoffTimer > 0) {
    kickoffTimer -= dt;
    blue.vx = 0;
    blue.vy = 0;
    red.vx = 0;
    red.vy = 0;
    ball.vx = 0;
    ball.vy = 0;
    return;
  }

  const movement = getMovement();
  const sprinting = keys.has("shift") || touchMoves.has("sprint");

  updatePlayer(blue, movement, dt, sprinting);
  updateAI(dt);
  separatePlayers();
  updateBall(dt);
  updateCamera(dt);
}

function render() {
  drawMainGame();
  drawMinimap();
}

function loop(timestamp) {
  if (!running || paused) return;

  const dt = Math.min((timestamp - lastFrame) / 1000 || 0, 0.033);
  lastFrame = timestamp;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

function renderWhenIdle() {
  render();
}

playButton.addEventListener("click", startMatch);
pauseButton.addEventListener("click", togglePause);
resumeButton.addEventListener("click", togglePause);

cameraButton.addEventListener("click", () => {
  cameraFollow = !cameraFollow;
  cameraButton.textContent = cameraFollow ? "CAMERA: FOLLOW" : "CAMERA: FIXED";
  if (!cameraFollow) setStatus("FIXED CAMERA", 1);
  else setStatus("FOLLOW CAMERA", 1);
});

grassButton.addEventListener("click", () => {
  stripedPitch = !stripedPitch;
  grassButton.textContent = stripedPitch ? "PITCH: STRIPES" : "PITCH: PLAIN";
  renderWhenIdle();
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
    event.preventDefault();
  }

  keys.add(key);

  if (key === " " && !event.repeat) kickBall(blue, 720, "SHOT!");
  if (key === "e" && !event.repeat) kickBall(blue, 390, "PASS!");
  if (key === "escape" && !event.repeat) togglePause();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("blur", () => {
  keys.clear();
  touchMoves.clear();
});

document.querySelectorAll("[data-move]").forEach((button) => {
  const direction = button.dataset.move;

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    touchMoves.add(direction);
  });

  const release = () => touchMoves.delete(direction);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});

function bindActionButton(id, action) {
  const button = document.getElementById(id);
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    action();
  });
}

bindActionButton("mobileShoot", () => kickBall(blue, 720, "SHOT!"));
bindActionButton("mobilePass", () => kickBall(blue, 390, "PASS!"));

const sprintButton = document.getElementById("mobileSprint");
sprintButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  touchMoves.add("sprint");
});
["pointerup", "pointercancel", "lostpointercapture"].forEach((name) => {
  sprintButton.addEventListener(name, () => touchMoves.delete("sprint"));
});

// Initial pitch preview and minimap are drawn before the match starts.
resetPositions();
render();
