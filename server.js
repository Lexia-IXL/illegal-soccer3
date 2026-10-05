const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  path: "/ws"
});

const PORT = process.env.PORT || 10000;

const WORLD_WIDTH = 1800;
const WORLD_HEIGHT = 1000;

const GOAL_Y = 330;
const GOAL_HEIGHT = 340;

const MAX_PLAYERS = 8;
const MIN_HUMANS = 2;

const TICK_RATE = 30;
const TICK = 1000 / TICK_RATE;

const players = new Map();

let nextId = 1;

let score = [0, 0];
let round = 1;
let roundClock = 180;

let lastBotFill = Date.now();

const POWER_TYPES = [
  "speed",
  "superkick",
  "giantball",
  "shield"
];

let powerups = [];

let ball = {
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2,
  vx: 0,
  vy: 0,
  owner: null,
  lastTouch: null
};

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    players: humans().length,
    bots: bots().length
  });
});

function humans() {
  return [...players.values()].filter(player => !player.bot);
}

function bots() {
  return [...players.values()].filter(player => player.bot);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function send(ws, message) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

function broadcast(message) {
  const data = JSON.stringify(message);

  for (const player of players.values()) {
    if (!player.bot && player.ws && player.ws.readyState === 1) {
      player.ws.send(data);
    }
  }
}

function createPlayer(ws, bot = false) {
  const id = String(nextId++);

  const blueCount = [...players.values()]
    .filter(player => player.team === 0).length;

  const redCount = [...players.values()]
    .filter(player => player.team === 1).length;

  const team = blueCount <= redCount ? 0 : 1;

  const player = {
    id,
    ws,
    bot,

    name: bot ? `Bot ${id}` : `Player ${id}`,

    team,

    x: team === 0 ? 360 : WORLD_WIDTH - 360,
    y: WORLD_HEIGHT / 2,

    vx: 0,
    vy: 0,

    facing: team === 0 ? 1 : -1,

    input: {},

    cooldown: 0,

    tackleUntil: 0,

    power: null,
    powerUntil: 0
  };

  players.set(id, player);

  return player;
}

function spawnPowerup() {
  const type =
    POWER_TYPES[
      Math.floor(Math.random() * POWER_TYPES.length)
    ];

  powerups.push({
    id: Math.random().toString(36).slice(2),
    type,

    x: 250 + Math.random() * (WORLD_WIDTH - 500),
    y: 170 + Math.random() * (WORLD_HEIGHT - 340)
  });
}

function resetBall(teamScored = null) {
  ball = {
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2,

    vx:
      teamScored === null
        ? 0
        : teamScored === 0
          ? 180
          : -180,

    vy: 0,

    owner: null,
    lastTouch: null
  };

  for (const player of players.values()) {
    player.x =
      player.team === 0
        ? 360
        : WORLD_WIDTH - 360;

    player.y =
      WORLD_HEIGHT / 2 +
      (Math.random() - 0.5) * 250;

    player.cooldown = 0;
  }
}

function useAction(player, action) {
  const now = Date.now();

  if (player.cooldown > now) {
    return;
  }

  if (
    action === "kick" ||
    action === "pass" ||
    action === "flick" ||
    action === "lob"
  ) {
    if (
      distance(player, ball) < 105 ||
      ball.owner === player.id
    ) {
      ball.owner = null;
      ball.lastTouch = player.id;

      const angle = Math.atan2(
        ball.y - player.y,
        ball.x - player.x
      );

      let power =
        action === "kick"
          ? 820
          : action === "pass"
            ? 520
            : action === "flick"
              ? 650
              : 480;

      if (
        player.power === "superkick" &&
        player.powerUntil > now &&
        action === "kick"
      ) {
        power *= 1.7;
      }

      if (action === "flick" || action === "lob") {
        ball.vy +=
          (player.team === 0 ? -1 : 1) * 140;
      }

      ball.vx =
        Math.cos(angle) * power +
        player.facing * 100;

      ball.vy += Math.sin(angle) * power;

      player.cooldown = now + 300;
    }
  }

  else if (action === "tackle") {
    player.tackleUntil = now + 260;

    player.cooldown = now + 650;

    for (const target of players.values()) {
      if (
        target.id !== player.id &&
        target.team !== player.team &&
        distance(player, target) < 85
      ) {
        target.vx += player.facing * 380;

        target.vy +=
          (Math.random() - 0.5) * 300;

        if (ball.owner === target.id) {
          ball.owner = null;
        }
      }
    }
  }
}

wss.on("connection", ws => {
  const player = createPlayer(ws);

  send(ws, {
    type: "welcome",

    id: player.id,

    world: {
      W: WORLD_WIDTH,
      H: WORLD_HEIGHT
    },

    controls: {
      move: "WASD",
      kick: "Mouse Left",
      pass: "Mouse Right",
      flick: "Q",
      tackle: "E",
      lob: "F",
      request: "R",
      dribble: "Space",
      sprint: "Shift"
    }
  });

  broadcast({
    type: "notice",
    text: `${player.name} joined the match.`
  });

  ws.on("message", raw => {
    try {
      const message = JSON.parse(raw);

      if (message.type === "input") {
        player.input = message.input || {};

        if (
          typeof message.name === "string" &&
          message.name.trim()
        ) {
          player.name =
            message.name
              .trim()
              .slice(0, 18);
        }
      }

      if (message.type === "action") {
        useAction(player, message.action);
      }

      if (message.type === "ping") {
        send(ws, {
          type: "pong",
          t: message.t
        });
      }
    }

    catch (error) {
      console.log("Invalid message.");
    }
  });

  ws.on("close", () => {
    players.delete(player.id);

    broadcast({
      type: "notice",
      text: `${player.name} left the match.`
    });
  });
});

function updateBot(player, dt) {
  let target = ball;

  if (ball.owner) {
    const owner = players.get(ball.owner);

    if (owner) {
      target = owner;
    }
  }

  const dx = target.x - player.x;
  const dy = target.y - player.y;

  const length =
    Math.hypot(dx, dy) || 1;

  player.facing =
    dx >= 0 ? 1 : -1;

  player.input = {
    up: dy / length,
    down: -dy / length,

    left: -dx / length,
    right: dx / length,

    sprint: true,
    dribble: true
  };

  if (
    distance(player, ball) < 85 &&
    !ball.owner
  ) {
    useAction(player, "kick");
  }

  if (
    ball.owner &&
    ball.owner !== player.id
  ) {
    const owner = players.get(ball.owner);

    if (
      owner &&
      owner.team !== player.team &&
      distance(player, owner) < 75
    ) {
      useAction(player, "tackle");
    }
  }
}

function updatePhysics() {
  const dt = TICK / 1000;
  const now = Date.now();

  /*
    BOT MATCHMAKING

    Once people are playing, bots fill empty
    spaces so the match doesn't feel empty.
  */

  if (now - lastBotFill > 3500) {
    lastBotFill = now;

    const humanCount = humans().length;

    const desired =
      Math.max(
        MIN_HUMANS,
        Math.min(MAX_PLAYERS, humanCount)
      );

    while (players.size < desired) {
      createPlayer(null, true);
    }

    if (
      humanCount > 0 &&
      players.size < MAX_PLAYERS
    ) {
      while (
        players.size < MAX_PLAYERS &&
        humans().length < MAX_PLAYERS - 2
      ) {
        createPlayer(null, true);
      }
    }
  }

  for (const player of players.values()) {
    if (player.bot) {
      updateBot(player, dt);
    }

    const input = player.input || {};

    let ax =
      (input.right ? 1 : 0) -
      (input.left ? 1 : 0);

    let ay =
      (input.down ? 1 : 0) -
      (input.up ? 1 : 0);

    const length =
      Math.hypot(ax, ay) || 1;

    ax /= length;
    ay /= length;

    const sprint = !!input.sprint;

    let speed =
      sprint ? 420 : 300;

    if (input.dribble) {
      speed *= 0.72;
    }

    if (
      player.power === "speed" &&
      player.powerUntil > now
    ) {
      speed *= 1.45;
    }

    player.vx +=
      ax * speed * 7 * dt;

    player.vy +=
      ay * speed * 7 * dt;

    const maxSpeed = speed;

    const currentSpeed =
      Math.hypot(
        player.vx,
        player.vy
      );

    if (currentSpeed > maxSpeed) {
      player.vx =
        (player.vx / currentSpeed) *
        maxSpeed;

      player.vy =
        (player.vy / currentSpeed) *
        maxSpeed;
    }

    player.vx *= 0.84;
    player.vy *= 0.84;

    player.x = clamp(
      player.x + player.vx * dt,
      70,
      WORLD_WIDTH - 70
    );

    player.y = clamp(
      player.y + player.vy * dt,
      70,
      WORLD_HEIGHT - 70
    );

    if (Math.abs(player.vx) > 10) {
      player.facing =
        player.vx > 0 ? 1 : -1;
    }

    if (ball.owner === player.id) {
      ball.x =
        player.x +
        player.facing * 48;

      ball.y = player.y;
    }

    else if (
      !ball.owner &&
      distance(player, ball) < 62
    ) {
      ball.owner = player.id;
      ball.lastTouch = player.id;
    }

    if (player.tackleUntil < now) {
      player.tackleUntil = 0;
    }
  }

  /*
    BALL PHYSICS
  */

  if (!ball.owner) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    ball.vx *= 0.992;
    ball.vy *= 0.992;

    if (
      ball.y < 35 ||
      ball.y > WORLD_HEIGHT - 35
    ) {
      ball.vy *= -0.78;

      ball.y = clamp(
        ball.y,
        35,
        WORLD_HEIGHT - 35
      );
    }

    /*
      BLUE SCORES
    */

    if (
      ball.x > WORLD_WIDTH &&
      ball.y > GOAL_Y &&
      ball.y < GOAL_Y + GOAL_HEIGHT
    ) {
      score[0]++;

      roundClock = 180;

      resetBall(0);
    }

    /*
      RED SCORES
    */

    else if (
      ball.x < 0 &&
      ball.y > GOAL_Y &&
      ball.y < GOAL_Y + GOAL_HEIGHT
    ) {
      score[1]++;

      roundClock = 180;

      resetBall(1);
    }

    else if (
      ball.x < 35 ||
      ball.x > WORLD_WIDTH - 35
    ) {
      ball.vx *= -0.78;

      ball.x = clamp(
        ball.x,
        35,
        WORLD_WIDTH - 35
      );
    }
  }

  /*
    POWER-UPS
  */

  for (
    let i = powerups.length - 1;
    i >= 0;
    i--
  ) {
    for (const player of players.values()) {
      if (
        distance(player, powerups[i]) < 45
      ) {
        const powerup = powerups[i];

        player.power = powerup.type;

        player.powerUntil =
          now + 9000;

        powerups.splice(i, 1);

        break;
      }
    }
  }

  if (
    powerups.length < 3 &&
    Math.random() < 0.004
  ) {
    spawnPowerup();
  }

  /*
    MATCH TIMER
  */

  roundClock -= dt;

  if (roundClock <= 0) {
    round++;

    score = [0, 0];

    roundClock = 180;

    resetBall();
  }
}

setInterval(() => {
  updatePhysics();

  const state = {
    type: "state",

    world: {
      W: WORLD_WIDTH,
      H: WORLD_HEIGHT
    },

    score,

    round,

    time: Math.max(
      0,
      Math.ceil(roundClock)
    ),

    ball: {
      x: ball.x,
      y: ball.y,
      vx: ball.vx,
      vy: ball.vy,
      owner: ball.owner
    },

    powerups,

    players: [...players.values()].map(player => ({
      id: player.id,

      name: player.name,

      bot: player.bot,

      team: player.team,

      x: player.x,
      y: player.y,

      vx: player.vx,
      vy: player.vy,

      facing: player.facing,

      power: player.power,

      powerActive:
        player.powerUntil > Date.now(),

      tackle:
        !!player.tackleUntil
    }))
  };

  broadcast(state);
}, TICK);

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Illegal Soccer server running on port ${PORT}`
    );
  }
);
