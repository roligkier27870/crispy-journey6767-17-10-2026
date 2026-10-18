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

const FORMATION_433 = [
  { number: 1, role: "GK", x: 0.045, y: 0.50 },
  { number: 2, role: "DEF", x: 0.17, y: 0.18 },
  { number: 4, role: "DEF", x: 0.19, y: 0.39 },
  { number: 5, role: "DEF", x: 0.19, y: 0.61 },
  { number: 3, role: "DEF", x: 0.17, y: 0.82 },
  { number: 6, role: "MID", x: 0.34, y: 0.28 },
  { number: 8, role: "MID", x: 0.37, y: 0.50 },
  { number: 10, role: "MID", x: 0.34, y: 0.72 },
  { number: 7, role: "FWD", x: 0.49, y: 0.22 },
  { number: 9, role: "FWD", x: 0.51, y: 0.50 },
  { number: 11, role: "FWD", x: 0.49, y: 0.78 }
];

const blueTeam = [];
const redTeam = [];

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

function makePlayer(team, data) {
  const isBlue = team === "BLUE";
  const homeX = FIELD.x + data.x * FIELD.width;
  const homeY = FIELD.y + data.y * FIELD.height;

  return {
    x: homeX,
    y: homeY,
    homeX,
    homeY,
    vx: 0,
    vy: 0,
    radius: data.role === "GK"
      ? 21
      : data.number === 10 && isBlue ? 23 : 18,
    speed: data.role === "GK"
      ? 245
      : data.role === "FWD" ? 280 : 265,
    color: isBlue ? "#40a5ff" : "#ff5d68",
    number: data.number,
    team,
    role: data.role,
    kickCooldown: Math.random() * 0.3,
    isUser: isBlue && data.number === 10,
    diveTimer: 0,
    diveDirection: 0,
    saveCooldown: 0
  };
}

function createTeams() {
  blueTeam.length = 0;
  redTeam.length = 0;

  for (const data of FORMATION_433) {
    blueTeam.push(makePlayer("BLUE", data));
    redTeam.push(makePlayer("RED", {
      ...data,
      x: 1 - data.x,
      y: data.y
    }));
  }
}

createTeams();

let blue = blueTeam.find(player => player.isUser);

const red = redTeam.find(player => player.number === 9);

const ball = {
  x: WORLD.width / 2,
  y: WORLD.height / 2,
  vx: 0,
  vy: 0,
  radius: 13
};

// Goalkeeper AI tuning.
const GK_REACTION_DISTANCE = 430;
const GK_SAVE_REACH = 43;
const GK_DIVE_REACH = 76;
const GK_DIVE_TIME = 0.48;

function allPlayers() {
  return [...blueTeam, ...redTeam];
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
  for (const player of allPlayers()) {
    player.x = player.homeX;
    player.y = player.homeY;
    player.vx = 0;
    player.vy = 0;
    player.kickCooldown = 0.3 + Math.random() * 0.3;
    player.diveTimer = 0;
    player.diveDirection = 0;
    player.saveCooldown = 0;
    player.isUser = false;
  }

  blue = blueTeam.find(player => player.number === 10);
  blue.isUser = true;
  blue.x = WORLD.width * 0.46;
  blue.y = WORLD.height / 2;

  const blueStriker = blueTeam.find(p => p.number === 9);
  blueStriker.x = WORLD.width * 0.48;
  blueStriker.y = WORLD.height / 2 + 65;

  const redStriker = redTeam.find(p => p.number === 9);
  redStriker.x = WORLD.width * 0.54;
  redStriker.y = WORLD.height / 2 - 65;

  ball.x = WORLD.width / 2;
  ball.y = WORLD.height / 2;
  ball.vx = 0;
  ball.vy = 0;

  camera.x = ball.x;
  camera.y = ball.y;
  kickoffTimer = 1.0;
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
  pauseButton.textContent = "Ⅱ PAUSE";

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

  if (keys.has("a") || keys.has("arrowleft") || touchMoves.has("left")) x--;
  if (keys.has("d") || keys.has("arrowright") || touchMoves.has("right")) x++;
  if (keys.has("w") || keys.has("arrowup") || touchMoves.has("up")) y--;
  if (keys.has("s") || keys.has("arrowdown") || touchMoves.has("down")) y++;

  return normalize(x, y);
}

function updatePlayer(player, direction, dt, sprint = false) {
  const targetSpeed = player.speed * (sprint ? 1.42 : 1);
  const acceleration = 10;

  player.vx += (direction.x * targetSpeed - player.vx)
    * Math.min(1, acceleration * dt);

  player.vy += (direction.y * targetSpeed - player.vy)
    * Math.min(1, acceleration * dt);

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  clampPlayer(player);
}

function distanceBetween(a, b) {
  return length(a.x - b.x, a.y - b.y);
}

function switchControlledPlayer() {
  if (!running || paused || kickoffTimer > 0) return;

  const candidates = blueTeam
    .filter(player => player.role !== "GK")
    .sort((a, b) =>
      distanceBetween(a, ball) - distanceBetween(b, ball)
    );

  if (candidates.length < 2) return;

  const currentIndex = candidates.findIndex(player => player === blue);

  const nextIndex = currentIndex < 0
    ? 0
    : (currentIndex + 1) % candidates.length;

  if (blue) blue.isUser = false;

  blue = candidates[nextIndex];
  blue.isUser = true;

  setStatus(`CONTROLLING BLUE #${blue.number}`, 1.1);
  renderWhenIdle();
}

function nearestOutfieldPlayer(team, target) {
  let nearest = null;
  let bestDistance = Infinity;

  for (const player of team) {
    if (player.role === "GK" || player.isUser) continue;

    const distance = distanceBetween(player, target);

    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = player;
    }
  }

  return nearest;
}

// Predict the ball's vertical position at the goalkeeper's line.
function predictBallYAtX(targetX) {
  if (Math.abs(ball.vx) < 1) return ball.y;

  const time = (targetX - ball.x) / ball.vx;

  if (time <= 0 || time > 1.8) return ball.y;

  // Approximate rolling friction during the prediction.
  const predictedY = ball.y + ball.vy * time * 0.65;

  return clamp(
    predictedY,
    FIELD.y + ball.radius,
    FIELD.y + FIELD.height - ball.radius
  );
}

function getGoalkeeperTarget(keeper) {
  const isBlueTeam = keeper.team === "BLUE";
  const goalX = isBlueTeam
    ? FIELD.x
    : FIELD.x + FIELD.width;

  // Keep the keeper inside the field, just in front of the goal.
  const targetX = isBlueTeam
    ? goalX + 39
    : goalX - 39;

  const goalTop = WORLD.height / 2 - GOAL.height / 2;
  const goalBottom = WORLD.height / 2 + GOAL.height / 2;

  const movingTowardGoal = isBlueTeam
    ? ball.vx < -35
    : ball.vx > 35;

  const distanceToGoal = Math.abs(ball.x - goalX);

  let targetY;

  if (
    movingTowardGoal &&
    distanceToGoal < GK_REACTION_DISTANCE
  ) {
    targetY = predictBallYAtX(targetX);
  } else {
    // Track the ball while maintaining a central goal position.
    targetY = WORLD.height / 2
      + clamp(ball.y - WORLD.height / 2, -155, 155) * 0.68;
  }

  return {
    x: targetX,
    y: clamp(targetY, goalTop + 18, goalBottom - 18)
  };
}

function updateGoalkeeper(keeper, dt) {
  keeper.kickCooldown = Math.max(0, keeper.kickCooldown - dt);
  keeper.saveCooldown = Math.max(0, keeper.saveCooldown - dt);
  keeper.diveTimer = Math.max(0, keeper.diveTimer - dt);

  const target = getGoalkeeperTarget(keeper);

  const direction = normalize(
    target.x - keeper.x,
    target.y - keeper.y
  );

  const distance = distanceBetween(keeper, target);

  const isBlueTeam = keeper.team === "BLUE";
  const goalX = isBlueTeam ? FIELD.x : FIELD.x + FIELD.width;
  const incoming = isBlueTeam ? ball.vx < -35 : ball.vx > 35;

  // During a dive, the keeper moves faster toward the shot.
  if (keeper.diveTimer > 0) {
    const diveDirection = normalize(
      isBlueTeam ? 1 : -1,
      keeper.diveDirection
    );

    updatePlayer(keeper, diveDirection, dt, true);
  } else {
    updatePlayer(keeper, direction, dt, distance > 35);
  }

  // Start a dive when a shot is approaching and the ball is not
  // comfortably within the keeper's normal reach.
  const closeToGoal = Math.abs(ball.x - goalX) < GK_REACTION_DISTANCE;
  const predictedY = predictBallYAtX(keeper.x);
  const verticalGap = Math.abs(predictedY - keeper.y);

  if (
    incoming &&
    closeToGoal &&
    verticalGap > 22 &&
    verticalGap < GK_DIVE_REACH &&
    keeper.diveTimer <= 0 &&
    keeper.saveCooldown <= 0
  ) {
    keeper.diveTimer = GK_DIVE_TIME;
    keeper.diveDirection = Math.sign(predictedY - keeper.y);
    keeper.saveCooldown = 0.25;
  }
}

function getAIHomeTarget(player, isBlueTeam, pressingPlayer) {
  const attackDirection = isBlueTeam ? 1 : -1;

  const ballProgress =
    (ball.x - (FIELD.x + FIELD.width / 2)) / (FIELD.width / 2);

  let targetX = player.homeX;
  let targetY = player.homeY;

  targetY += clamp(ball.y - WORLD.height / 2, -260, 260) * 0.28;

  if (player.role === "GK") {
    return getGoalkeeperTarget(player);
  }

  if (player.role === "DEF") {
    targetX += attackDirection * clamp(ballProgress * 85, -35, 85);
  }

  if (player.role === "MID") {
    targetX += attackDirection * clamp(ballProgress * 115, -55, 115);
  }

  if (player.role === "FWD") {
    targetX += attackDirection * clamp(ballProgress * 95, -45, 95);
  }

  if (player === pressingPlayer) {
    return { x: ball.x, y: ball.y };
  }

  const ballDistance = distanceBetween(player, ball);

  if (ballDistance < 260) {
    const supportOffset = player.number % 2 === 0 ? -100 : 100;
    targetY += supportOffset;
    targetX -= attackDirection * 55;
  }

  targetX = clamp(targetX, FIELD.x + 85, FIELD.x + FIELD.width - 85);
  targetY = clamp(targetY, FIELD.y + 70, FIELD.y + FIELD.height - 70);

  return { x: targetX, y: targetY };
}

function playerTouchesBall(player) {
  return distanceBetween(player, ball)
    <= player.radius + ball.radius + 7;
}

function tryAIKick(player, isBlueTeam) {
  if (
    player.role === "GK" ||
    player.kickCooldown > 0 ||
    !playerTouchesBall(player)
  ) return;

  const attackDirection = isBlueTeam ? 1 : -1;

  const goalX = isBlueTeam
    ? FIELD.x + FIELD.width + 30
    : FIELD.x - 30;

  const aimY = WORLD.height / 2
    + clamp((ball.y - WORLD.height / 2) * 0.35, -105, 105);

  let direction = normalize(goalX - ball.x, aimY - ball.y);

  const ownGoalDanger = isBlueTeam
    ? ball.x < FIELD.x + 300
    : ball.x > FIELD.x + FIELD.width - 300;

  if (ownGoalDanger && player.role !== "FWD") {
    direction = normalize(
      attackDirection,
      (player.y - WORLD.height / 2) * 0.002
    );
  }

  const power = player.role === "FWD" ? 565 : 445;

  ball.vx = direction.x * power + player.vx * 0.18;
  ball.vy = direction.y * power + player.vy * 0.18;

  player.kickCooldown = 0.8 + Math.random() * 0.5;
}

function updateTeamAI(team, isBlueTeam, dt, pressingPlayer) {
  for (const player of team) {
    if (player.isUser || player.role === "GK") continue;

    player.kickCooldown = Math.max(0, player.kickCooldown - dt);

    const target = getAIHomeTarget(
      player,
      isBlueTeam,
      pressingPlayer
    );

    const direction = normalize(
      target.x - player.x,
      target.y - player.y
    );

    const distance = distanceBetween(player, target);
    const sprint = distance > 300 || player === pressingPlayer;

    updatePlayer(player, direction, dt, sprint);
    tryAIKick(player, isBlueTeam);
  }
}

function updateAI(dt) {
  const bluePresser = nearestOutfieldPlayer(blueTeam, ball);
  const redPresser = nearestOutfieldPlayer(redTeam, ball);

  updateTeamAI(blueTeam, true, dt, bluePresser);
  updateTeamAI(redTeam, false, dt, redPresser);

  updateGoalkeeper(blueTeam.find(p => p.role === "GK"), dt);
  updateGoalkeeper(redTeam.find(p => p.role === "GK"), dt);
}

function separatePlayers() {
  const players = allPlayers();

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = length(dx, dy);
      const minDistance = a.radius + b.radius;

      if (distance >= minDistance) continue;

      let nx;
      let ny;

      if (distance > 0.001) {
        nx = dx / distance;
        ny = dy / distance;
      } else {
        const fallback = normalize((i + 1) * 0.37, (j + 1) * 0.61);
        nx = fallback.x;
        ny = fallback.y;
      }

      const overlap = minDistance - distance;
      const aWeight = a.isUser ? 0.65 : 0.5;
      const bWeight = b.isUser ? 0.65 : 0.5;
      const totalWeight = aWeight + bWeight;

      a.x -= nx * overlap * (aWeight / totalWeight);
      a.y -= ny * overlap * (aWeight / totalWeight);
      b.x += nx * overlap * (bWeight / totalWeight);
      b.y += ny * overlap * (bWeight / totalWeight);

      const relativeVelocity =
        (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;

      if (relativeVelocity < 0) {
        const impulse = relativeVelocity * 0.5;
        a.vx += nx * impulse;
        a.vy += ny * impulse;
        b.vx -= nx * impulse;
        b.vy -= ny * impulse;
      }

      clampPlayer(a);
      clampPlayer(b);
    }
  }
}

// Intercept shots before the goal-line scoring checks.
// Returns true when a goalkeeper makes contact with the ball.
function tryGoalkeeperSave() {
  const goalTop = WORLD.height / 2 - GOAL.height / 2;
  const goalBottom = WORLD.height / 2 + GOAL.height / 2;

  for (const keeper of [
    blueTeam.find(p => p.role === "GK"),
    redTeam.find(p => p.role === "GK")
  ]) {
    const isBlueTeam = keeper.team === "BLUE";
    const goalX = isBlueTeam ? FIELD.x : FIELD.x + FIELD.width;

    const incoming = isBlueTeam ? ball.vx < -35 : ball.vx > 35;

    if (!incoming || keeper.saveCooldown > 0) continue;

    // The ball must be travelling through or close to the goalmouth.
    if (ball.y < goalTop - 45 || ball.y > goalBottom + 45) continue;

    const dx = ball.x - keeper.x;
    const dy = ball.y - keeper.y;
    const distance = length(dx, dy);

    const diving = keeper.diveTimer > 0;
    const reach = diving ? GK_DIVE_REACH : GK_SAVE_REACH;

    if (distance > reach) continue;

    // Deflect toward the pitch rather than back into the net.
    const direction = isBlueTeam ? 1 : -1;

    // Move the ball away from the keeper to prevent repeated contacts.
    ball.x = keeper.x + direction * (keeper.radius + ball.radius + 5);

    const impact = Math.hypot(ball.vx, ball.vy);
    const offset = clamp(
      (ball.y - keeper.y) / Math.max(keeper.radius, 1),
      -1.5,
      1.5
    );

    // Low shots are more likely to produce a rebound.
    const rebound = Math.random() < 0.35;

    if (rebound) {
      ball.vx = direction * Math.max(180, impact * 0.48);
      ball.vy = clamp(
        ball.vy * 0.45 + offset * 100,
        -260,
        260
      );
    } else {
      ball.vx = direction * Math.max(230, impact * 0.62);
      ball.vy = clamp(
        ball.vy * 0.62 + offset * 135,
        -340,
        340
      );
    }

    keeper.vx = -direction * 35;
    keeper.saveCooldown = 0.22;
    keeper.diveTimer = 0;

    setStatus(rebound ? "SAVE! REBOUND!" : "WHAT A SAVE!", 1.15);

    return true;
  }

  return false;
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

  // Goalkeepers get their chance to save before a goal is awarded.
  tryGoalkeeperSave();

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

  if (ball.y - ball.radius < fieldTop) {
    ball.y = fieldTop + ball.radius;
    ball.vy = Math.abs(ball.vy) * 0.78;
  }

  if (ball.y + ball.radius > fieldBottom) {
    ball.y = fieldBottom - ball.radius;
    ball.vy = -Math.abs(ball.vy) * 0.78;
  }

  if (
    ball.x - ball.radius < fieldLeft &&
    !(ball.y > goalTop && ball.y < goalBottom)
  ) {
    ball.x = fieldLeft + ball.radius;
    ball.vx = Math.abs(ball.vx) * 0.78;
  }

  if (
    ball.x + ball.radius > fieldRight &&
    !(ball.y > goalTop && ball.y < goalBottom)
  ) {
    ball.x = fieldRight - ball.radius;
    ball.vx = -Math.abs(ball.vx) * 0.78;
  }

  // Ball collision with all 22 players.
  for (const player of allPlayers()) {
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

// Shooting now aims toward the opponent's goal.
// Passing aims toward a nearby teammate.
function kickBall(player, power, actionName) {
  if (!running || paused || kickoffTimer > 0) return;

  if (!playerTouchesBall(player)) {
    setStatus("GET CLOSER TO THE BALL", 0.9);
    return;
  }

  const isBlueTeam = player.team === "BLUE";
  const attackDirection = isBlueTeam ? 1 : -1;

  let direction;

  if (actionName === "PASS!") {
    const teammates = isBlueTeam ? blueTeam : redTeam;

    let target = null;
    let bestScore = Infinity;

    for (const teammate of teammates) {
      if (teammate === player || teammate.role === "GK") continue;

      const forwardDistance = (teammate.x - player.x) * attackDirection;

      if (forwardDistance < -100) continue;

      const score = distanceBetween(player, teammate)
        + Math.max(0, 180 - forwardDistance) * 0.5;

      if (score < bestScore) {
        bestScore = score;
        target = teammate;
      }
    }

    direction = target
      ? normalize(
          target.x - ball.x + target.vx * 0.22,
          target.y - ball.y + target.vy * 0.22
        )
      : normalize(attackDirection, 0);
  } else {
    const goalX = isBlueTeam
      ? FIELD.x + FIELD.width + GOAL.depth
      : FIELD.x - GOAL.depth;

    // Aim toward the goal, with a small adjustment based on ball position.
    const goalY = WORLD.height / 2
      + clamp((ball.y - WORLD.height / 2) * 0.18, -55, 55);

    direction = normalize(goalX - ball.x, goalY - ball.y);

    // Moving players influence shot power slightly.
    const speed = length(player.vx, player.vy);
    power *= 1 + Math.min(speed / 1200, 0.12);
  }

  ball.vx = direction.x * power + player.vx * 0.16;
  ball.vy = direction.y * power + player.vy * 0.16;

  setStatus(actionName, 0.65);
}

function updateCamera(dt) {
  if (!cameraFollow) return;

  const targetX = ball.x * 0.72 + blue.x * 0.28;
  const targetY = ball.y * 0.72 + blue.y * 0.28;
  const smoothing = 1 - Math.exp(-4 * dt);

  camera.x += (targetX - camera.x) * smoothing;
  camera.y += (targetY - camera.y) * smoothing;

  const halfWidth = canvas.width / (2 * CAMERA_ZOOM);
  const halfHeight = canvas.height / (2 * CAMERA_ZOOM);

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
  context.arc(
    x + width / 2,
    y + height / 2,
    height * 0.16,
    0,
    Math.PI * 2
  );
  context.stroke();

  context.fillStyle = "#e8fff0";
  context.beginPath();
  context.arc(
    x + width / 2,
    y + height / 2,
    Math.max(2, width / 300),
    0,
    Math.PI * 2
  );
  context.fill();

  const boxWidth = width * 0.15;
  const boxHeight = height * 0.36;
  const smallBoxWidth = width * 0.055;
  const smallBoxHeight = height * 0.17;

  context.strokeRect(x, y + (height - boxHeight) / 2, boxWidth, boxHeight);

  context.strokeRect(
    x + width - boxWidth,
    y + (height - boxHeight) / 2,
    boxWidth,
    boxHeight
  );

  context.strokeRect(
    x,
    y + (height - smallBoxHeight) / 2,
    smallBoxWidth,
    smallBoxHeight
  );

  context.strokeRect(
    x + width - smallBoxWidth,
    y + (height - smallBoxHeight) / 2,
    smallBoxWidth,
    smallBoxHeight
  );

  context.fillStyle = "#e9fff0";

  context.fillRect(
    x - width * 0.018,
    y + (height - height * 0.195) / 2,
    width * 0.018,
    height * 0.195
  );

  context.fillRect(
    x + width,
    y + (height - height * 0.195) / 2,
    width * 0.018,
    height * 0.195
  );
}

function drawPlayer(player) {
  ctx.save();

  ctx.beginPath();
  ctx.ellipse(
    player.x,
    player.y + 6,
    player.radius * 0.92,
    player.radius * 0.67,
    0,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = "#00130b66";
  ctx.fill();

  if (player.isUser) {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 6, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff6a8";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  if (player.role === "GK") {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (player.diveTimer > 0) {
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 8, 0, Math.PI * 2);
      ctx.strokeStyle = "#fff0a8";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = player.color;
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffffffcc";
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${player.radius < 20 ? 12 : 15}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(player.number), player.x, player.y + 1);

  ctx.restore();
}

function drawBall() {
  ctx.save();

  ctx.beginPath();
  ctx.ellipse(
    ball.x + 3,
    ball.y + 6,
    ball.radius * 1.05,
    ball.radius * 0.72,
    0,
    0,
    Math.PI * 2
  );
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

  const players = allPlayers().sort((a, b) => a.y - b.y);

  for (const player of players) drawPlayer(player);

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
    ctx.fillText(
      "KICKOFF IN PROGRESS",
      canvas.width / 2,
      canvas.height - 19
    );
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

  drawPitch(mapCtx, pitchX, pitchY, pitchW, pitchH, 12);

  for (const player of allPlayers()) {
    const px = pitchX + (player.x - FIELD.x) * scale;
    const py = pitchY + (player.y - FIELD.y) * scale;

    mapCtx.beginPath();
    mapCtx.arc(px, py, player.isUser ? 4.5 : 3.1, 0, Math.PI * 2);
    mapCtx.fillStyle = player.color;
    mapCtx.fill();

    mapCtx.lineWidth = player.isUser ? 1.5 : 0.8;
    mapCtx.strokeStyle = player.isUser ? "#fff6a8" : "#ffffffcc";
    mapCtx.stroke();
  }

  const visibleWorldWidth = canvas.width / CAMERA_ZOOM;
  const visibleWorldHeight = canvas.height / CAMERA_ZOOM;

  const viewX = pitchX
    + (camera.x - visibleWorldWidth / 2 - FIELD.x) * scale;

  const viewY = pitchY
    + (camera.y - visibleWorldHeight / 2 - FIELD.y) * scale;

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

    if (statusTimer <= 0 && !paused) {
      matchStatus.textContent = "MATCH IN PLAY";
    }
  }

  if (kickoffTimer > 0) {
    kickoffTimer -= dt;

    for (const player of allPlayers()) {
      player.vx = 0;
      player.vy = 0;
    }

    ball.vx = 0;
    ball.vy = 0;

    updateCamera(dt);
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

  cameraButton.textContent = cameraFollow
    ? "CAMERA: FOLLOW"
    : "CAMERA: FIXED";

  setStatus(cameraFollow ? "FOLLOW CAMERA" : "FIXED CAMERA", 1);
});

grassButton.addEventListener("click", () => {
  stripedPitch = !stripedPitch;

  grassButton.textContent = stripedPitch
    ? "PITCH: STRIPES"
    : "PITCH: PLAIN";

  renderWhenIdle();
});

window.addEventListener("keydown", event => {
  const key = event.key.toLowerCase();

  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
    event.preventDefault();
  }

  if ((key === "q" || key === "tab") && !event.repeat) {
    event.preventDefault();
    switchControlledPlayer();
    return;
  }

  keys.add(key);

  if (key === " " && !event.repeat) {
    kickBall(blue, 720, "SHOT!");
  }

  if (key === "e" && !event.repeat) {
    kickBall(blue, 390, "PASS!");
  }

  if (key === "escape" && !event.repeat) {
    togglePause();
  }
});

window.addEventListener("keyup", event => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("blur", () => {
  keys.clear();
  touchMoves.clear();
});

document.querySelectorAll("[data-move]").forEach(button => {
  const direction = button.dataset.move;

  button.addEventListener("pointerdown", event => {
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
  if (!button) return;

  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    action();
  });
}

bindActionButton("mobileShoot", () => kickBall(blue, 720, "SHOT!"));
bindActionButton("mobilePass", () => kickBall(blue, 390, "PASS!"));

const sprintButton = document.getElementById("mobileSprint");

if (sprintButton) {
  sprintButton.addEventListener("pointerdown", event => {
    event.preventDefault();
    touchMoves.add("sprint");
  });

  ["pointerup", "pointercancel", "lostpointercapture"].forEach(name => {
    sprintButton.addEventListener(name, () => touchMoves.delete("sprint"));
  });
}

resetPositions();
render();
