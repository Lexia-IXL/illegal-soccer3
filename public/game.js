const canvas =
  document.getElementById("game");

const ctx =
  canvas.getContext("2d");


let dpr =
  Math.min(
    devicePixelRatio || 1,
    2
  );


let me = null;

let state = null;

let socket = null;

let keys = {};

let noticeTimer = null;


function resize() {

  canvas.width =
    innerWidth * dpr;

  canvas.height =
    innerHeight * dpr;

  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );
}


addEventListener(
  "resize",
  resize
);


resize();


function connect() {

  const protocol =
    location.protocol === "https:"
      ? "wss"
      : "ws";


  socket =
    new WebSocket(
      `${protocol}://${location.host}/ws`
    );


  socket.onopen = () => {

    const savedName =
      localStorage.getItem(
        "soccerName"
      ) || "Player";


    socket.send(
      JSON.stringify({
        type: "input",

        name: savedName,

        input: {}
      })
    );
  };


  socket.onmessage = event => {

    const message =
      JSON.parse(event.data);


    if (
      message.type === "welcome"
    ) {

      me = message.id;

      show("hud");
    }


    if (
      message.type === "state"
    ) {

      state = message;
    }


    if (
      message.type === "notice"
    ) {

      notice(message.text);
    }

  };


  socket.onclose = () => {

    notice(
      "Connection lost — reconnecting..."
    );


    setTimeout(
      connect,
      1500
    );
  };

}


function show(id) {

  document
    .querySelectorAll(
      "#menu,#hud"
    )
    .forEach(element =>
      element.classList.add(
        "hidden"
      )
    );


  document
    .getElementById(id)
    .classList.remove(
      "hidden"
    );
}


function notice(text) {

  const element =
    document.getElementById(
      "notice"
    );


  element.textContent =
    text;


  clearTimeout(
    noticeTimer
  );


  noticeTimer =
    setTimeout(() => {

      element.textContent =
        "";

    }, 2500);

}


/* PLAYER NAME */

const nameInput =
  document.getElementById(
    "name"
  );


nameInput.value =
  localStorage.getItem(
    "soccerName"
  ) || "";


/* PLAY BUTTON */

document
  .getElementById("play")
  .onclick = () => {

    const name =
      nameInput.value.trim();


    localStorage.setItem(
      "soccerName",
      name || "Player"
    );


    connect();
  };


/* KEYBOARD */

addEventListener(
  "keydown",
  event => {

    keys[event.code] = true;


    if (
      [
        "Space",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight"
      ].includes(event.code)
    ) {

      event.preventDefault();
    }


    if (
      !socket ||
      socket.readyState !== 1
    ) {

      return;
    }


    const actions = {

      KeyQ: "flick",

      KeyE: "tackle",

      KeyF: "lob"

    };


    const action =
      actions[event.code];


    if (
      action &&
      !event.repeat
    ) {

      socket.send(
        JSON.stringify({
          type: "action",
          action
        })
      );
    }

  }
);


addEventListener(
  "keyup",
  event => {

    keys[event.code] =
      false;

  }
);


/* MOUSE */

canvas.addEventListener(
  "mousedown",
  event => {

    if (
      !socket ||
      socket.readyState !== 1
    ) {

      return;
    }


    const action =
      event.button === 0
        ? "kick"
        : "pass";


    socket.send(
      JSON.stringify({
        type: "action",
        action
      })
    );

  }
);


canvas.addEventListener(
  "contextmenu",
  event => {
    event.preventDefault();
  }
);


/*
  SEND PLAYER INPUT
*/

setInterval(() => {

  if (
    !socket ||
    socket.readyState !== 1
  ) {

    return;
  }


  socket.send(
    JSON.stringify({

      type: "input",

      name:
        localStorage.getItem(
          "soccerName"
        ) || "Player",

      input: {

        up:
          keys.KeyW ||
          keys.ArrowUp,

        down:
          keys.KeyS ||
          keys.ArrowDown,

        left:
          keys.KeyA ||
          keys.ArrowLeft,

        right:
          keys.KeyD ||
          keys.ArrowRight,

        sprint:
          keys.ShiftLeft ||
          keys.ShiftRight,

        dribble:
          keys.Space

      }

    })
  );

}, 50);


/*
  WORLD → SCREEN
*/

function worldToScreen(
  x,
  y,
  scale,
  offsetX,
  offsetY
) {

  return [

    x * scale + offsetX,

    y * scale + offsetY

  ];
}


/*
  DRAW GAME
*/

function draw() {

  requestAnimationFrame(
    draw
  );


  if (!state) {

    ctx.fillStyle =
      "#07120d";

    ctx.fillRect(
      0,
      0,
      innerWidth,
      innerHeight
    );

    return;
  }


  const scale =
    Math.min(

      (innerWidth - 30) /
        state.world.W,

      (innerHeight - 120) /
        state.world.H

    );


  const offsetX =
    (innerWidth -
      state.world.W * scale) /
    2;


  const offsetY =
    (innerHeight -
      state.world.H * scale) /
    2 +
    10;


  ctx.fillStyle =
    "#0b2516";


  ctx.fillRect(
    0,
    0,
    innerWidth,
    innerHeight
  );


  /*
    FIELD
  */

  ctx.fillStyle =
    "#20703c";


  ctx.fillRect(

    offsetX,

    offsetY,

    state.world.W * scale,

    state.world.H * scale

  );


  /*
    FIELD BORDER
  */

  ctx.strokeStyle =
    "#ffffffaa";

  ctx.lineWidth = 3;


  ctx.strokeRect(

    offsetX,

    offsetY,

    state.world.W * scale,

    state.world.H * scale

  );


  /*
    CENTER LINE
  */

  ctx.beginPath();

  ctx.moveTo(

    offsetX +
      state.world.W *
      scale /
      2,

    offsetY

  );

  ctx.lineTo(

    offsetX +
      state.world.W *
      scale /
      2,

    offsetY +
      state.world.H *
      scale

  );

  ctx.stroke();


  /*
    CENTER CIRCLE
  */

  ctx.beginPath();

  ctx.arc(

    offsetX +
      state.world.W *
      scale /
      2,

    offsetY +
      state.world.H *
      scale /
      2,

    125 * scale,

    0,

    Math.PI * 2

  );

  ctx.stroke();


  /*
    PENALTY BOXES
  */

  ctx.strokeRect(

    offsetX,

    offsetY +
      (state.world.H / 2 - 170) *
      scale,

    120 * scale,

    340 * scale

  );


  ctx.strokeRect(

    offsetX +
      (state.world.W - 120) *
      scale,

    offsetY +
      (state.world.H / 2 - 170) *
      scale,

    120 * scale,

    340 * scale

  );


  /*
    GOALS
  */

  ctx.fillStyle =
    "#dfe8ea";


  ctx.fillRect(

    offsetX - 18,

    offsetY +
      330 * scale,

    18,

    340 * scale

  );


  ctx.fillRect(

    offsetX +
      state.world.W * scale,

    offsetY +
      330 * scale,

    18,

    340 * scale

  );


  /*
    POWERUPS
  */

  for (
    const powerup of
    state.powerups
  ) {

    const [
      x,
      y
    ] =
      worldToScreen(
        powerup.x,
        powerup.y,
        scale,
        offsetX,
        offsetY
      );


    ctx.fillStyle =
      "#ffffff";


    ctx.beginPath();

    ctx.arc(
      x,
      y,
      18,
      0,
      Math.PI * 2
    );

    ctx.fill();


    const labels = {

      speed: "⚡",

      superkick: "★",

      giantball: "●",

      shield: "◆"

    };


    ctx.fillStyle =
      "#111";


    ctx.font =
      "bold 17px Arial";


    ctx.textAlign =
      "center";


    ctx.textBaseline =
      "middle";


    ctx.fillText(

      labels[powerup.type] ||
        "?",

      x,

      y

    );

  }


  /*
    PLAYERS
  */

  for (
    const player of
    state.players
  ) {

    const [
      x,
      y
    ] =
      worldToScreen(

        player.x,

        player.y,

        scale,

        offsetX,

        offsetY

      );


    ctx.save();


    ctx.translate(
      x,
      y
    );


    /*
      TEAM COLOR
    */

    ctx.fillStyle =
      player.team === 0
        ? "#42a5ff"
        : "#ff4d5d";


    ctx.beginPath();

    ctx.arc(
      0,
      0,
      24,
      0,
      Math.PI * 2
    );

    ctx.fill();


    /*
      YOUR PLAYER
    */

    if (
      player.id === me
    ) {

      ctx.strokeStyle =
        "#ffffff";

      ctx.lineWidth = 4;


      ctx.beginPath();

      ctx.arc(
        0,
        0,
        29,
        0,
        Math.PI * 2
      );

      ctx.stroke();

    }


    /*
      POWER ACTIVE
    */

    if (
      player.powerActive
    ) {

      ctx.strokeStyle =
        "#ffe66d";

      ctx.lineWidth = 4;


      ctx.beginPath();

      ctx.arc(
        0,
        0,
        34,
        0,
        Math.PI * 2
      );

      ctx.stroke();

    }


    /*
      PLAYER NAME
    */

    ctx.fillStyle =
      "#ffffff";

    ctx.font =
      "bold 12px Arial";

    ctx.textAlign =
      "center";


    ctx.fillText(

      player.bot
        ? "BOT"
        : player.name,

      0,

      -38

    );


    ctx.restore();

  }


  /*
    BALL
  */

  const [
    ballX,
    ballY
  ] =
    worldToScreen(

      state.ball.x,

      state.ball.y,

      scale,

      offsetX,

      offsetY

    );


  ctx.fillStyle =
    "#ffffff";


  ctx.beginPath();

  ctx.arc(
    ballX,
    ballY,
    11,
    0,
    Math.PI * 2
  );

  ctx.fill();


  ctx.strokeStyle =
    "#111";

  ctx.lineWidth = 2;

  ctx.stroke();


  /*
    HUD
  */

  document
    .getElementById("score")
    .textContent =
      `BLUE ${state.score[0]} — ${state.score[1]} RED`;


  const minutes =
    Math.floor(
      state.time / 60
    );


  const seconds =
    String(
      state.time % 60
    ).padStart(
      2,
      "0"
    );


  document
    .getElementById("timer")
    .textContent =
      `${minutes}:${seconds}`;


  const humanCount =
    state.players
      .filter(player =>
        !player.bot
      ).length;


  const botCount =
    state.players
      .filter(player =>
        player.bot
      ).length;


  document
    .getElementById("players")
    .textContent =
      `Players: ${humanCount} · Bots: ${botCount}`;


  const myPlayer =
    state.players.find(
      player =>
        player.id === me
    );


  document
    .getElementById("power")
    .textContent =
      `POWER: ${
        myPlayer?.powerActive
          ? (
              myPlayer.power ||
              ""
            ).toUpperCase()
          : "NONE"
      }`;

}


draw();
