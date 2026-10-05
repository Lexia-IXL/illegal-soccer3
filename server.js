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

const FIELD_WIDTH = 120;
const FIELD_LENGTH = 200;

const MAX_PLAYERS = 8;
const MIN_PLAYERS_FOR_BOTS = 2;

const TICK_RATE = 30;
const DT = 1 / TICK_RATE;

const players = new Map();

let nextPlayerId = 1;

let score = {
  blue: 0,
  red: 0
};

let matchTime = 180;

let lastBotCheck = 0;

const POWERUPS = [
  "speed",
  "superkick",
  "shield",
  "giantball"
];

let powerups = [];

let ball = {
  x: 0,
  y: 1.2,
  z: 0,

  vx: 0,
  vy: 0,
  vz: 0,

  owner: null,

  radius: 1.1
};


/* ------------------------------------------------ */
/* WEB SERVER */
/* ------------------------------------------------ */

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

app.get("/health", (req, res) => {
  res.json({
    online: true,
    humans: [...players.values()]
      .filter(p => !p.bot).length,

    bots: [...players.values()]
      .filter(p => p.bot).length
  });
});


/* ------------------------------------------------ */
/* HELPERS */
/* ------------------------------------------------ */

function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}


function distance3D(a, b) {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) +
    Math.pow(a.y - b.y, 2) +
    Math.pow(a.z - b.z, 2)
  );
}


function humans() {
  return [...players.values()]
    .filter(player => !player.bot);
}


function bots() {
  return [...players.values()]
    .filter(player => player.bot);
}


function send(ws, data) {
  if (
    ws &&
    ws.readyState === 1
  ) {
    ws.send(
      JSON.stringify(data)
    );
  }
}


function broadcast(data) {
  const message =
    JSON.stringify(data);

  for (
    const player of
    players.values()
  ) {
    if (
      !player.bot &&
      player.ws &&
      player.ws.readyState === 1
    ) {
      player.ws.send(message);
    }
  }
}


/* ------------------------------------------------ */
/* PLAYER CREATION */
/* ------------------------------------------------ */

function createPlayer(ws, bot = false) {

  const id =
    String(nextPlayerId++);

  const blue =
    [...players.values()]
      .filter(p => p.team === "blue")
      .length;

  const red =
    [...players.values()]
      .filter(p => p.team === "red")
      .length;

  const team =
    blue <= red
      ? "blue"
      : "red";


  const startX =
    team === "blue"
      ? -35
      : 35;


  const player = {

    id,

    ws,

    bot,

    name:
      bot
        ? `Bot ${id}`
        : `Player ${id}`,

    team,

    x: startX,

    y: 0,

    z:
      (Math.random() - 0.5) *
      30,

    vx: 0,

    vy: 0,

    vz: 0,

    rotationY:
      team === "blue"
        ? 0
        : Math.PI,

    input: {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      dribble: false
    },

    power: null,

    powerUntil: 0,

    actionCooldown: 0,

    tackleUntil: 0,

    shieldUntil: 0
  };


  players.set(
    id,
    player
  );

  return player;
}


/* ------------------------------------------------ */
/* RESET MATCH */
/* ------------------------------------------------ */

function resetPositions() {

  for (
    const player of
    players.values()
  ) {

    player.x =
      player.team === "blue"
        ? -35
        : 35;

    player.z =
      (Math.random() - 0.5) *
      35;

    player.y = 0;

    player.vx = 0;
    player.vy = 0;
    player.vz = 0;

    player.power = null;

    player.powerUntil = 0;
  }


  ball.x = 0;
  ball.y = 1.2;
  ball.z = 0;

  ball.vx = 0;
  ball.vy = 0;
  ball.vz = 0;

  ball.owner = null;
}


/* ------------------------------------------------ */
/* POWERUPS */
/* ------------------------------------------------ */

function spawnPowerup() {

  if (powerups.length >= 4) {
    return;
  }


  const type =
    POWERUPS[
      Math.floor(
        Math.random() *
        POWERUPS.length
      )
    ];


  powerups.push({

    id:
      Math.random()
        .toString(36)
        .slice(2),

    type,

    x:
      (Math.random() - 0.5) *
      80,

    y: 1.5,

    z:
      (Math.random() - 0.5) *
      110

  });
}


/* ------------------------------------------------ */
/* ACTIONS */
/* ------------------------------------------------ */

function action(player, type) {

  const now =
    Date.now();


  if (
    player.actionCooldown >
    now
  ) {
    return;
  }


  /* KICK */

  if (type === "kick") {

    if (
      ball.owner === player.id ||
      distance3D(player, ball) < 5
    ) {

      ball.owner = null;

      const direction =
        player.team === "blue"
          ? 1
          : -1;


      let power = 55;


      if (
        player.power === "superkick" &&
        player.powerUntil > now
      ) {
        power = 100;
      }


      ball.vx =
        direction * power;

      ball.vy =
        10 +
        Math.random() * 5;

      ball.vz =
        player.vz * 0.15;


      player.actionCooldown =
        now + 450;
    }
  }


  /* PASS */

  else if (type === "pass") {

    if (
      ball.owner === player.id ||
      distance3D(player, ball) < 5
    ) {

      ball.owner = null;

      const direction =
        player.team === "blue"
          ? 1
          : -1;


      ball.vx =
        direction * 32;

      ball.vy = 5;

      ball.vz =
        player.vz * 0.5;


      player.actionCooldown =
        now + 300;
    }
  }


  /* TACKLE */

  else if (type === "tackle") {

    if (
      player.actionCooldown >
      now
    ) {
      return;
    }


    player.tackleUntil =
      now + 400;


    player.actionCooldown =
      now + 900;


    for (
      const opponent of
      players.values()
    ) {

      if (
        opponent.id === player.id
      ) {
        continue;
      }


      if (
        opponent.team ===
        player.team
      ) {
        continue;
      }


      if (
        distance3D(
          player,
          opponent
        ) < 5
      ) {

        if (
          opponent.shieldUntil >
          now
        ) {
          continue;
        }


        opponent.vx +=
          player.team === "blue"
            ? 20
            : -20;


        if (
          ball.owner ===
          opponent.id
        ) {
          ball.owner = null;

          ball.vx =
            player.team === "blue"
              ? 25
              : -25;
        }
      }
    }
  }


  /* DASH */

  else if (type === "dash") {

    if (
      player.power === "speed" &&
      player.powerUntil > now
    ) {

      player.vx +=
        player.team === "blue"
          ? 35
          : -35;

    } else {

      player.vx +=
        player.team === "blue"
          ? 20
          : -20;
    }


    player.actionCooldown =
      now + 1000;
  }
}


/* ------------------------------------------------ */
/* BOT AI */
/* ------------------------------------------------ */

function updateBot(player) {

  let target = ball;


  if (ball.owner) {

    const owner =
      players.get(
        ball.owner
      );

    if (owner) {
      target = owner;
    }
  }


  const dx =
    target.x - player.x;

  const dz =
    target.z - player.z;


  player.input.forward =
    Math.abs(dx) > 2 &&
    (
      player.team === "blue"
        ? dx > 0
        : dx < 0
    );


  player.input.backward =
    false;


  player.input.left =
    dz < -2;


  player.input.right =
    dz > 2;


  player.input.sprint =
    true;


  if (
    distance3D(
      player,
      ball
    ) < 5
  ) {

    action(
      player,
      "kick"
    );
  }


  if (
    ball.owner
  ) {

    const owner =
      players.get(
        ball.owner
      );


    if (
      owner &&
      owner.team !== player.team &&
      distance3D(
        player,
        owner
      ) < 5
    ) {

      action(
        player,
        "tackle"
      );
    }
  }
}


/* ------------------------------------------------ */
/* PHYSICS */
/* ------------------------------------------------ */

function updatePhysics() {

  const now =
    Date.now();


  /* BOT FILL */

  if (
    now - lastBotCheck >
    3000
  ) {

    lastBotCheck = now;


    const humansCount =
      humans().length;


    if (
      humansCount >= 1
    ) {

      while (
        players.size <
        MAX_PLAYERS
      ) {

        createPlayer(
          null,
          true
        );
      }
    }

    else {

      while (
        players.size <
        MIN_PLAYERS_FOR_BOTS
      ) {

        createPlayer(
          null,
          true
        );
      }
    }
  }


  /* PLAYERS */

  for (
    const player of
    players.values()
  ) {

    if (player.bot) {
      updateBot(player);
    }


    const input =
      player.input;


    let moveX = 0;

    let moveZ = 0;


    if (input.forward) {
      moveX += 1;
    }


    if (input.backward) {
      moveX -= 1;
    }


    if (input.left) {
      moveZ -= 1;
    }


    if (input.right) {
      moveZ += 1;
    }


    const magnitude =
      Math.hypot(
        moveX,
        moveZ
      );


    if (magnitude > 0) {

      moveX /= magnitude;
      moveZ /= magnitude;


      let speed =
        input.sprint
          ? 20
          : 13;


      if (
        input.dribble
      ) {
        speed *= 0.72;
      }


      if (
        player.power === "speed" &&
        player.powerUntil > now
      ) {
        speed *= 1.6;
      }


      player.vx =
        moveX * speed;

      player.vz =
        moveZ * speed;


      player.rotationY =
        Math.atan2(
          moveZ,
          moveX
        );
    }

    else {

      player.vx *= 0.75;
      player.vz *= 0.75;
    }


    player.x +=
      player.vx * DT;


    player.z +=
      player.vz * DT;


    player.x =
      clamp(
        player.x,
        -58,
        58
      );


    player.z =
      clamp(
        player.z,
        -96,
        96
      );


    /* BALL PICKUP */

    if (
      !ball.owner &&
      distance3D(
        player,
        ball
      ) < 4
    ) {

      ball.owner =
        player.id;
    }


    /* BALL DRIBBLING */

    if (
      ball.owner ===
      player.id
    ) {

      const direction =
        player.team === "blue"
          ? 1
          : -1;


      ball.x =
        player.x +
        direction * 2.8;


      ball.y = 1.4;


      ball.z =
        player.z;
    }


    if (
      player.powerUntil <
      now
    ) {

      player.power = null;
    }
  }


  /* BALL */

  if (!ball.owner) {

    ball.x +=
      ball.vx * DT;

    ball.y +=
      ball.vy * DT;

    ball.z +=
      ball.vz * DT;


    ball.vy -=
      25 * DT;


    ball.vx *=
      0.993;

    ball.vz *=
      0.993;


    if (
      ball.y <
      ball.radius
    ) {

      ball.y =
        ball.radius;

      ball.vy *=
        -0.68;
    }


    if (
      Math.abs(ball.z) >
      98
    ) {

      ball.z =
        clamp(
          ball.z,
          -98,
          98
        );

      ball.vz *=
        -0.7;
    }


    /* BLUE GOAL */

    if (
      ball.x >
      FIELD_WIDTH / 2 + 3
    ) {

      if (
        Math.abs(ball.z) <
        18
      ) {

        score.blue++;

        resetPositions();
      }

      else {

        ball.x =
          FIELD_WIDTH / 2 + 3;

        ball.vx *= -0.7;
      }
    }


    /* RED GOAL */

    if (
      ball.x <
      -FIELD_WIDTH / 2 - 3
    ) {

      if (
        Math.abs(ball.z) <
        18
      ) {

        score.red++;

        resetPositions();
      }

      else {

        ball.x =
          -FIELD_WIDTH / 2 - 3;

        ball.vx *= -0.7;
      }
    }
  }


  /* POWERUPS */

  for (
    let i =
      powerups.length - 1;

    i >= 0;

    i--
  ) {

    const powerup =
      powerups[i];


    for (
      const player of
      players.values()
    ) {

      if (
        distance3D(
          player,
          powerup
        ) < 4
      ) {

        player.power =
          powerup.type;


        player.powerUntil =
          now + 10000;


        if (
          powerup.type ===
          "shield"
        ) {

          player.shieldUntil =
            now + 10000;
        }


        powerups.splice(
          i,
          1
        );


        break;
      }
    }
  }


  if (
    powerups.length < 4 &&
    Math.random() < 0.01
  ) {

    spawnPowerup();
  }


  /* MATCH CLOCK */

  matchTime -= DT;


  if (
    matchTime <= 0
  ) {

    matchTime = 180;

    score.blue = 0;
    score.red = 0;

    resetPositions();
  }
}


/* ------------------------------------------------ */
/* WEBSOCKET */
/* ------------------------------------------------ */

wss.on(
  "connection",
  ws => {

    const player =
      createPlayer(ws);


    send(ws, {

      type: "welcome",

      id: player.id,

      field: {
        width: FIELD_WIDTH,
        length: FIELD_LENGTH
      }

    });


    broadcast({
      type: "notice",
      text:
        `${player.name} joined the match.`
    });


    ws.on(
      "message",
      raw => {

        try {

          const message =
            JSON.parse(raw);


          if (
            message.type ===
            "input"
          ) {

            player.input =
              message.input || {};


            if (
              typeof message.name ===
              "string"
            ) {

              const name =
                message.name
                  .trim()
                  .slice(0, 18);


              if (name) {
                player.name =
                  name;
              }
            }
          }


          if (
            message.type ===
            "action"
          ) {

            action(
              player,
              message.action
            );
          }
        }

        catch {
          /* Ignore bad packets */
        }
      }
    );


    ws.on(
      "close",
      () => {

        players.delete(
          player.id
        );


        broadcast({

          type: "notice",

          text:
            `${player.name} left the match.`

        });
      }
    );
  }
);


/* ------------------------------------------------ */
/* SERVER TICK */
/* ------------------------------------------------ */

setInterval(
  () => {

    updatePhysics();


    const state = {

      type: "state",

      score,

      time:
        Math.max(
          0,
          Math.ceil(matchTime)
        ),


      ball: {
        x: ball.x,
        y: ball.y,
        z: ball.z,
        owner: ball.owner
      },


      powerups,


      players:
        [...players.values()]
          .map(player => ({

            id: player.id,

            name: player.name,

            bot: player.bot,

            team: player.team,

            x: player.x,

            y: player.y,

            z: player.z,

            rotationY:
              player.rotationY,

            power:
              player.power,

            powerActive:
              player.powerUntil >
              Date.now(),

            tackling:
              player.tackleUntil >
              Date.now(),

            shield:
              player.shieldUntil >
              Date.now()

          }))
    };


    broadcast(state);

  },

  1000 / TICK_RATE
);


/* ------------------------------------------------ */
/* START */
/* ------------------------------------------------ */

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `3D Soccer server running on ${PORT}`
    );

  }
);
