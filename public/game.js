import * as THREE from
  "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";


/* ================================================= */
/* VARIABLES */
/* ================================================= */

let scene;
let camera;
let renderer;

let socket;

let myId = null;

let gameState = null;

let clock =
  new THREE.Clock();


const playerMeshes =
  new Map();


const powerMeshes =
  new Map();


let ballMesh;

let stadium;

let cameraYaw = 0;

let cameraPitch = 0.45;

let keys = {};


let mouseDown = false;


/* ================================================= */
/* DOM */
/* ================================================= */

const menu =
  document.getElementById(
    "menu"
  );


const loading =
  document.getElementById(
    "loading"
  );


const playerName =
  document.getElementById(
    "playerName"
  );


const playButton =
  document.getElementById(
    "playButton"
  );


/* ================================================= */
/* THREE SETUP */
/* ================================================= */

function init3D() {

  scene =
    new THREE.Scene();


  scene.background =
    new THREE.Color(
      0x07140d
    );


  scene.fog =
    new THREE.Fog(
      0x07140d,
      100,
      300
    );


  camera =
    new THREE.PerspectiveCamera(
      70,
      innerWidth / innerHeight,
      0.1,
      500
    );


  renderer =
    new THREE.WebGLRenderer({
      antialias: true
    });


  renderer.setPixelRatio(
    Math.min(
      devicePixelRatio,
      2
    )
  );


  renderer.setSize(
    innerWidth,
    innerHeight
  );


  renderer.shadowMap.enabled =
    true;


  renderer.shadowMap.type =
    THREE.PCFSoftShadowMap;


  document.body.appendChild(
    renderer.domElement
  );


  window.addEventListener(
    "resize",
    resize
  );


  createLighting();

  createStadium();

  createBall();


  animate();
}


/* ================================================= */
/* LIGHTING */
/* ================================================= */

function createLighting() {

  const ambient =
    new THREE.HemisphereLight(
      0xffffff,
      0x203020,
      2
    );


  scene.add(
    ambient
  );


  const sun =
    new THREE.DirectionalLight(
      0xffffff,
      3
    );


  sun.position.set(
    0,
    100,
    40
  );


  sun.castShadow = true;


  sun.shadow.mapSize.width =
    2048;


  sun.shadow.mapSize.height =
    2048;


  sun.shadow.camera.left =
    -150;


  sun.shadow.camera.right =
    150;


  sun.shadow.camera.top =
    150;


  sun.shadow.camera.bottom =
    -150;


  scene.add(
    sun
  );


  const lights = [];


  for (
    let i = -1;
    i <= 1;
    i += 2
  ) {

    const light =
      new THREE.PointLight(
        0xffffff,
        50,
        180
      );


    light.position.set(
      i * 75,
      45,
      0
    );


    scene.add(
      light
    );

    lights.push(light);
  }
}


/* ================================================= */
/* STADIUM */
/* ================================================= */

function createStadium() {

  stadium =
    new THREE.Group();


  scene.add(
    stadium
  );


  /* FIELD */

  const fieldGeometry =
    new THREE.BoxGeometry(
      120,
      0.5,
      200
    );


  const fieldMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x26753c,
      roughness: 0.9
    });


  const field =
    new THREE.Mesh(
      fieldGeometry,
      fieldMaterial
    );


  field.receiveShadow =
    true;


  field.position.y =
    -0.25;


  stadium.add(
    field
  );


  /* FIELD LINES */

  createFieldLines();


  /* GOALS */

  createGoal(
    -1
  );

  createGoal(
    1
  );


  /* STANDS */

  createStands();


  /* LIGHT TOWERS */

  createLightTowers();
}


/* ================================================= */
/* FIELD LINES */
/* ================================================= */

function createFieldLines() {

  const material =
    new THREE.MeshBasicMaterial({
      color: 0xffffff
    });


  const lineHeight =
    0.04;


  function line(
    width,
    height,
    x,
    z
  ) {

    const geometry =
      new THREE.BoxGeometry(
        width,
        lineHeight,
        height
      );


    const mesh =
      new THREE.Mesh(
        geometry,
        material
      );


    mesh.position.set(
      x,
      0.03,
      z
    );


    stadium.add(
      mesh
    );
  }


  /* SIDELINES */

  line(
    0.25,
    200,
    -60,
    0
  );


  line(
    0.25,
    200,
    60,
    0
  );


  /* END LINES */

  line(
    120,
    0.25,
    0,
    -100
  );


  line(
    120,
    0.25,
    0,
    100
  );


  /* CENTER LINE */

  line(
    120,
    0.2,
    0,
    0
  );


  /* CENTER CIRCLE */

  const circle =
    new THREE.RingGeometry(
      18,
      18.3,
      64
    );


  const circleMesh =
    new THREE.Mesh(
      circle,
      material
    );


  circleMesh.rotation.x =
    -Math.PI / 2;


  circleMesh.position.y =
    0.04;


  stadium.add(
    circleMesh
  );


  /* CENTER DOT */

  const dot =
    new THREE.Mesh(
      new THREE.CircleGeometry(
        0.7,
        24
      ),
      material
    );


  dot.rotation.x =
    -Math.PI / 2;


  dot.position.y =
    0.05;


  stadium.add(
    dot
  );
}


/* ================================================= */
/* GOALS */
/* ================================================= */

function createGoal(side) {

  const group =
    new THREE.Group();


  const x =
    side * 64;


  group.position.x =
    x;


  const material =
    new THREE.MeshStandardMaterial({
      color: 0xffffff
    });


  const post1 =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.5,
        0.5,
        12,
        12
      ),
      material
    );


  post1.position.set(
    0,
    6,
    -18
  );


  group.add(
    post1
  );


  const post2 =
    post1.clone();


  post2.position.z =
    18;


  group.add(
    post2
  );


  const crossbar =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.5,
        0.5,
        36,
        12
      ),
      material
    );


  crossbar.rotation.x =
    Math.PI / 2;


  crossbar.position.y =
    12;


  group.add(
    crossbar
  );


  /* NET */

  const netMaterial =
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });


  const net =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        10,
        12,
        36
      ),
      netMaterial
    );


  net.position.x =
    side * 5;


  net.position.y =
    6;


  group.add(
    net
  );


  stadium.add(
    group
  );
}


/* ================================================= */
/* STANDS */
/* ================================================= */

function createStands() {

  const material =
    new THREE.MeshStandardMaterial({
      color: 0x20252a
    });


  for (
    let side = -1;
    side <= 1;
    side += 2
  ) {

    const stand =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          18,
          18,
          230
        ),
        material
      );


    stand.position.set(
      side * 78,
      9,
      0
    );


    stand.castShadow =
      true;


    stand.receiveShadow =
      true;


    stadium.add(
      stand
    );


    for (
      let z = -100;
      z <= 100;
      z += 8
    ) {

      const seat =
        new THREE.Mesh(
          new THREE.BoxGeometry(
            15,
            1.5,
            5
          ),
          new THREE.MeshStandardMaterial({
            color:
              Math.random() >
              0.5
                ? 0x333333
                : 0x555555
          })
        );


      seat.position.set(
        side * 68,
        19 +
          Math.floor(
            (z + 100) / 30
          ) * 4,
        z
      );


      stadium.add(
        seat
      );
    }
  }
}


/* ================================================= */
/* LIGHT TOWERS */
/* ================================================= */

function createLightTowers() {

  for (
    let x = -55;
    x <= 55;
    x += 55
  ) {

    for (
      let z of [-105, 105]
    ) {

      const pole =
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.8,
            1,
            45,
            12
          ),
          new THREE.MeshStandardMaterial({
            color: 0x444444
          })
        );


      pole.position.set(
        x,
        22,
        z
      );


      stadium.add(
        pole
      );


      const light =
        new THREE.PointLight(
          0xffffff,
          80,
          120
        );


      light.position.set(
        x,
        45,
        z
      );


      stadium.add(
        light
      );
    }
  }
}


/* ================================================= */
/* BALL */
/* ================================================= */

function createBall() {

  const geometry =
    new THREE.SphereGeometry(
      1.1,
      24,
      24
    );


  const material =
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4
    });


  ballMesh =
    new THREE.Mesh(
      geometry,
      material
    );


  ballMesh.castShadow =
    true;


  scene.add(
    ballMesh
  );
}


/* ================================================= */
/* PLAYER MODEL */
/* ================================================= */

function createPlayerMesh(
  player
) {

  const group =
    new THREE.Group();


  const color =
    player.team === "blue"
      ? 0x319cff
      : 0xff4757;


  const body =
    new THREE.Mesh(
      new THREE.CapsuleGeometry(
        1.15,
        2.5,
        6,
        12
      ),
      new THREE.MeshStandardMaterial({
        color
      })
    );


  body.position.y =
    2;


  body.castShadow =
    true;


  group.add(
    body
  );


  const head =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.85,
        16,
        16
      ),
      new THREE.MeshStandardMaterial({
        color: 0xf0b58a
      })
    );


  head.position.y =
    4;


  head.castShadow =
    true;


  group.add(
    head
  );


  /* LEGS */

  for (
    let side of [-1, 1]
  ) {

    const leg =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.65,
          2,
          0.7
        ),
        new THREE.MeshStandardMaterial({
          color: 0x111111
        })
      );


    leg.position.set(
      side * 0.55,
      0.2,
      0
    );


    leg.castShadow =
      true;


    group.add(
      leg
    );
  }


  /* NAME */

  const nameCanvas =
    document.createElement(
      "canvas"
    );


  nameCanvas.width =
    512;

  nameCanvas.height =
    128;


  const nameContext =
    nameCanvas.getContext(
      "2d"
    );


  nameContext.clearRect(
    0,
    0,
    512,
    128
  );


  nameContext.fillStyle =
    "white";


  nameContext.font =
    "bold 50px Arial";


  nameContext.textAlign =
    "center";


  nameContext.fillText(
    player.bot
      ? "BOT"
      : player.name,
    256,
    70
  );


  const texture =
    new THREE.CanvasTexture(
      nameCanvas
    );


  const nameMaterial =
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    });


  const label =
    new THREE.Sprite(
      nameMaterial
    );


  label.scale.set(
    8,
    2,
    1
  );


  label.position.y =
    6;


  group.add(
    label
  );


  scene.add(
    group
  );


  return group;
}


/* ================================================= */
/* POWERUP MODEL */
/* ================================================= */

function createPowerupMesh(
  powerup
) {

  const group =
    new THREE.Group();


  let color =
    0xffffff;


  if (
    powerup.type ===
    "speed"
  ) {

    color =
      0xffff00;

  }


  if (
    powerup.type ===
    "superkick"
  ) {

    color =
      0xff5500;

  }


  if (
    powerup.type ===
    "shield"
  ) {

    color =
      0x44aaff;

  }


  if (
    powerup.type ===
    "giantball"
  ) {

    color =
      0xff44ff;

  }


  const mesh =
    new THREE.Mesh(

      new THREE.OctahedronGeometry(
        1.5
      ),

      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.35
      })

    );


  mesh.position.y =
    2;


  group.add(
    mesh
  );


  scene.add(
    group
  );


  return group;
}


/* ================================================= */
/* INPUT */
/* ================================================= */

window.addEventListener(
  "keydown",
  event => {

    keys[event.code] =
      true;


    if (
      [
        "Space",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight"
      ].includes(
        event.code
      )
    ) {

      event.preventDefault();
    }


    if (
      event.code ===
      "KeyQ"
    ) {

      sendAction(
        "tackle"
      );
    }


    if (
      event.code ===
      "KeyE"
    ) {

      sendAction(
        "dash"
      );
    }
  }
);


window.addEventListener(
  "keyup",
  event => {

    keys[event.code] =
      false;
  }
);


window.addEventListener(
  "mousedown",
  event => {

    if (
      event.button === 0
    ) {

      sendAction(
        "kick"
      );
    }


    if (
      event.button === 2
    ) {

      sendAction(
        "pass"
      );
    }
  }
);


window.addEventListener(
  "contextmenu",
  event => {

    event.preventDefault();
  }
);


/* ================================================= */
/* SEND INPUT */
/* ================================================= */

setInterval(
  () => {

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
          playerName.value ||
          "Player",

        input: {

          forward:
            !!keys.KeyW,

          backward:
            !!keys.KeyS,

          left:
            !!keys.KeyA,

          right:
            !!keys.KeyD,

          sprint:
            !!keys.ShiftLeft ||
            !!keys.ShiftRight,

          dribble:
            !!keys.Space

        }

      })
    );

  },

  50
);


/* ================================================= */
/* ACTION */
/* ================================================= */

function sendAction(
  action
) {

  if (
    !socket ||
    socket.readyState !== 1
  ) {

    return;
  }


  socket.send(
    JSON.stringify({

      type: "action",

      action

    })
  );
}


/* ================================================= */
/* CONNECT */
/* ================================================= */

function connect() {

  loading.style.display =
    "flex";


  const protocol =
    location.protocol ===
    "https:"
      ? "wss:"
      : "ws:";


  socket =
    new WebSocket(
      `${protocol}//${location.host}/ws`
    );


  socket.onopen =
    () => {

      loading.style.display =
        "none";

    };


  socket.onmessage =
    event => {

      const message =
        JSON.parse(
          event.data
        );


      if (
        message.type ===
        "welcome"
      ) {

        myId =
          message.id;


        menu.style.display =
          "none";

      }


      if (
        message.type ===
        "state"
      ) {

        gameState =
          message;

        updateWorld();
      }


      if (
        message.type ===
        "notice"
      ) {

        showNotice(
          message.text
        );
      }

    };


  socket.onclose =
    () => {

      loading.style.display =
        "flex";

      loading.textContent =
        "CONNECTION LOST — RECONNECTING...";


      setTimeout(
        connect,
        1500
      );
    };
}


/* ================================================= */
/* UPDATE WORLD */
/* ================================================= */

function updateWorld() {

  if (!gameState) {
    return;
  }


  updatePlayers();

  updateBall();

  updatePowerups();

  updateHUD();
}


/* ================================================= */
/* PLAYERS */
/* ================================================= */

function updatePlayers() {

  const activeIds =
    new Set();


  for (
    const player of
    gameState.players
  ) {

    activeIds.add(
      player.id
    );


    let mesh =
      playerMeshes.get(
        player.id
      );


    if (!mesh) {

      mesh =
        createPlayerMesh(
          player
        );


      playerMeshes.set(
        player.id,
        mesh
      );
    }


    mesh.position.set(
      player.x,
      player.y,
      player.z
    );


    mesh.rotation.y =
      player.rotationY;


    /* TACKLE EFFECT */

    if (
      player.tackling
    ) {

      mesh.scale.set(
        1.25,
        0.65,
        1.25
      );

    }

    else {

      mesh.scale.set(
        1,
        1,
        1
      );
    }


    /* SHIELD */

    let shield =
      mesh.userData.shield;


    if (
      player.shield
    ) {

      if (!shield) {

        shield =
          new THREE.Mesh(

            new THREE.SphereGeometry(
              3.3,
              24,
              24
            ),

            new THREE.MeshBasicMaterial({

              color: 0x44aaff,

              transparent: true,

              opacity: 0.22,

              wireframe: true

            })

          );


        mesh.add(
          shield
        );


        mesh.userData.shield =
          shield;
      }

    }

    else if (shield) {

      mesh.remove(
        shield
      );

      mesh.userData.shield =
        null;
    }
  }


  for (
    const [
      id,
      mesh
    ] of playerMeshes
  ) {

    if (
      !activeIds.has(id)
    ) {

      scene.remove(
        mesh
      );

      playerMeshes.delete(
        id
      );
    }
  }
}


/* ================================================= */
/* BALL */
/* ================================================= */

function updateBall() {

  if (!gameState) {
    return;
  }


  ballMesh.position.set(

    gameState.ball.x,

    gameState.ball.y,

    gameState.ball.z

  );


  const owner =
    gameState.ball.owner;


  if (owner) {

    ballMesh.scale.set(
      0.9,
      0.9,
      0.9
    );

  }

  else {

    ballMesh.scale.set(
      1,
      1,
      1
    );
  }
}


/* ================================================= */
/* POWERUPS */
/* ================================================= */

function updatePowerups() {

  const active =
    new Set();


  for (
    const powerup of
    gameState.powerups
  ) {

    active.add(
      powerup.id
    );


    let mesh =
      powerMeshes.get(
        powerup.id
      );


    if (!mesh) {

      mesh =
        createPowerupMesh(
          powerup
        );


      powerMeshes.set(
        powerup.id,
        mesh
      );
    }


    mesh.position.set(

      powerup.x,

      powerup.y,

      powerup.z

    );


    mesh.rotation.y +=
      0.04;

  }


  for (
    const [
      id,
      mesh
    ] of powerMeshes
  ) {

    if (
      !active.has(id)
    ) {

      scene.remove(
        mesh
      );

      powerMeshes.delete(
        id
      );
    }
  }
}


/* ================================================= */
/* CAMERA */
/* ================================================= */

function updateCamera() {

  if (!gameState) {
    return;
  }


  const player =
    gameState.players.find(
      p =>
        p.id === myId
    );


  if (!player) {
    return;
  }


  const target =
    new THREE.Vector3(
      player.x,
      3,
      player.z
    );


  const distance =
    15;


  const offset =
    new THREE.Vector3(

      -Math.cos(
        player.rotationY
      ) * distance,

      8,

      -Math.sin(
        player.rotationY
      ) * distance

    );


  const desired =
    target.clone()
      .add(offset);


  camera.position.lerp(
    desired,
    0.12
  );


  camera.lookAt(
    target
  );
}


/* ================================================= */
/* HUD */
/* ================================================= */

function updateHUD() {

  document.getElementById(
    "blueScore"
  ).textContent =
    gameState.score.blue;


  document.getElementById(
    "redScore"
  ).textContent =
    gameState.score.red;


  const minutes =
    Math.floor(
      gameState.time / 60
    );


  const seconds =
    String(
      gameState.time % 60
    ).padStart(
      2,
      "0"
    );


  document.getElementById(
    "matchTime"
  ).textContent =
    `${minutes}:${seconds}`;


  const humans =
    gameState.players
      .filter(
        p => !p.bot
      ).length;


  const botCount =
    gameState.players
      .filter(
        p => p.bot
      ).length;


  document.getElementById(
    "playerCount"
  ).textContent =
    `PLAYERS: ${humans} · BOTS: ${botCount}`;


  const me =
    gameState.players.find(
      p =>
        p.id === myId
    );


  document.getElementById(
    "powerDisplay"
  ).textContent =
    `POWER: ${
      me &&
      me.powerActive
        ? me.power.toUpperCase()
        : "NONE"
    }`;
}


/* ================================================= */
/* NOTICE */
/* ================================================= */

let noticeTimeout;


function showNotice(
  message
) {

  const element =
    document.getElementById(
      "notice"
    );


  element.textContent =
    message;


  clearTimeout(
    noticeTimeout
  );


  noticeTimeout =
    setTimeout(
      () => {

        element.textContent =
          "";

      },

      2500
    );
}


/* ================================================= */
/* RESIZE */
/* ================================================= */

function resize() {

  if (!camera || !renderer) {
    return;
  }


  camera.aspect =
    innerWidth /
    innerHeight;


  camera.updateProjectionMatrix();


  renderer.setSize(
    innerWidth,
    innerHeight
  );
}


/* ================================================= */
/* GAME LOOP */
/* ================================================= */

function animate() {

  requestAnimationFrame(
    animate
  );


  const elapsed =
    clock.getElapsedTime();


  /* POWERUP ANIMATION */

  for (
    const mesh of
    powerMeshes.values()
  ) {

    mesh.children[0].rotation.y =
      elapsed * 2;


    mesh.children[0].position.y =
      2 +
      Math.sin(
        elapsed * 3
      ) *
      0.35;
  }


  updateCamera();


  renderer.render(
    scene,
    camera
  );
}


/* ================================================= */
/* PLAY */
/* ================================================= */

playButton.addEventListener(
  "click",
  () => {

    if (
      !playerName.value.trim()
    ) {

      playerName.value =
        "Player";
    }


    init3D();

    connect();

  }
);


/* ENTER TO PLAY */

playerName.addEventListener(
  "keydown",
  event => {

    if (
      event.key ===
      "Enter"
    ) {

      playButton.click();
    }
  }
);
