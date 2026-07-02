import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// ── Game Configuration ────────────────────────────────────────────────────────
const TILE_SIZE = 4;
const BOARD_SIZE = 10;
const TOTAL_TILES = BOARD_SIZE * BOARD_SIZE;

const JUMPS: Record<number, number> = {
  // Ladders
  4: 14,
  9: 31,
  20: 38,
  28: 84,
  40: 59,
  51: 67,
  63: 81,
  71: 91,
  // Snakes
  17: 7,
  54: 34,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  99: 78,
};

const PLAYER_COLORS = [0xef4444, 0x3b82f6, 0x22c55e, 0xeab308];
const PLAYER_COLORS_CSS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];

const SNAKE_COLORS: [number, number][] = [
  [0x4a7c59, 0xb8d4c8],
  [0x7a4e2d, 0xd4a882],
  [0x5c4a7f, 0xc2b0e8],
  [0x8b5e3c, 0xe0c9b4],
  [0x3a6b6e, 0xa8cdd0],
  [0x6b4e71, 0xd4b8d9],
  [0x4e6741, 0xb5c9a8],
  [0x7a3b3b, 0xd9a8a8],
];

// ── Player Class ──────────────────────────────────────────────────────────────
class Player {
  id: number;
  name: string;
  color: number;
  mesh: THREE.Group;
  currentTile = 1;
  moveQueue: number[] = [];
  isMoving = false;
  currentJump: "climb" | "slide" | null = null;
  jumpProgress = 0;
  targetPosition = new THREE.Vector3();
  hopProgress = 0;
  startHopPosition = new THREE.Vector3();

  constructor(
    id: number,
    name: string,
    color: number,
    s: THREE.Scene,
    startPos: THREE.Vector3,
  ) {
    this.id = id;
    this.name = name;
    this.color = color;
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.2,
    });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.5, 16), mat);
    body.position.y = 0.75;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), mat);
    head.position.y = 1.7;
    head.castShadow = true;
    group.add(body, head);
    this.mesh = group;
    const ox = (id % 2 === 0 ? 1 : -1) * 0.8;
    const oz = (id < 2 ? 1 : -1) * 0.8;
    this.mesh.position.set(startPos.x + ox, startPos.y, startPos.z + oz);
    s.add(this.mesh);
  }
}

// ── Board Scene ───────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1e293b);

const camera = new THREE.PerspectiveCamera(
  window.innerWidth <= 768 ? 75 : 60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);

if (window.innerWidth <= 768) {
  camera.position.set(0, 72, 0);
} else {
  camera.position.set(0, 40, 40);
}
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("game-canvas") as HTMLCanvasElement,
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(20, 50, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(4096, 4096);
dirLight.shadow.camera.left = -25;
dirLight.shadow.camera.right = 25;
dirLight.shadow.camera.top = 25;
dirLight.shadow.camera.bottom = -25;
scene.add(dirLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.1;
controls.minDistance = 10;
controls.maxDistance = 100;

// ── Board Tiles ───────────────────────────────────────────────────────────────
const tilePositions: THREE.Vector3[] = [new THREE.Vector3()]; // 1-indexed
const boardGroup = new THREE.Group();
scene.add(boardGroup);

const tileGeo = new THREE.BoxGeometry(TILE_SIZE * 0.95, 0.5, TILE_SIZE * 0.95);
const matEven = new THREE.MeshStandardMaterial({ color: 0x4f46e5 });
const matOdd = new THREE.MeshStandardMaterial({ color: 0x34d399 });

for (let i = 0; i < TOTAL_TILES; i++) {
  const num = i + 1;
  const row = Math.floor(i / BOARD_SIZE);
  let col = i % BOARD_SIZE;
  if (row % 2 !== 0) col = BOARD_SIZE - 1 - col;
  const x = (col - BOARD_SIZE / 2 + 0.5) * TILE_SIZE;
  const z = (BOARD_SIZE / 2 - row - 0.5) * TILE_SIZE;

  const tile = new THREE.Mesh(tileGeo, num % 2 === 0 ? matEven : matOdd);
  tile.position.set(x, 0, z);
  tile.receiveShadow = true;

  const tc = document.createElement("canvas");
  tc.width = tc.height = 128;
  const tctx = tc.getContext("2d")!;
  tctx.fillStyle = "white";
  tctx.font = "bold 64px Outfit, sans-serif";
  tctx.textAlign = "center";
  tctx.textBaseline = "middle";
  tctx.fillText(String(num), 64, 64);
  const tp = new THREE.Mesh(
    new THREE.PlaneGeometry(TILE_SIZE * 0.5, TILE_SIZE * 0.5),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(tc),
      transparent: true,
      opacity: 0.8,
    }),
  );
  tp.rotation.x = -Math.PI / 2;
  tp.position.set(0, 0.26, 0);
  tile.add(tp);
  boardGroup.add(tile);
  tilePositions[num] = new THREE.Vector3(x, 0.25, z);
}

// ── Snakes & Ladders ──────────────────────────────────────────────────────────
interface LadderInfo {
  group: THREE.Group;
  axis: THREE.Vector3;
  midPoint: THREE.Vector3;
}
const ladders: LadderInfo[] = [];
const snakePaths: Record<number, THREE.CatmullRomCurve3> = {};
const snakeHeads: {
  mesh: THREE.Group;
  baseRotation: THREE.Euler;
  baseY: number;
}[] = [];
const snakeBodySegs: {
  mesh: THREE.Mesh;
  basePos: THREE.Vector3;
  side: THREE.Vector3;
  t: number;
  length: number;
}[] = [];

const ladderMat = new THREE.MeshStandardMaterial({
  color: 0xd97706,
  roughness: 0.8,
  metalness: 0.1,
});
const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const eyeBlackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
const tongueMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

function createTextSprite(text: string, clr: string): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = clr;
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 32);
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c),
      depthTest: false,
    }),
  );
  sp.scale.set(3, 0.75, 1);
  return sp;
}

let snakeColorIdx = 0;
for (const [startStr, endStr] of Object.entries(JUMPS)) {
  const start = Number(startStr);
  const end = Number(endStr);

  const startPos = tilePositions[start];
  const endPos = tilePositions[end];

  if (start < end) {
    /* ── LADDER ── */
    const bot = startPos.clone();
    bot.y += 0.3;
    const top = endPos.clone();
    top.y += 0.3;
    const dir = top.clone().sub(bot);
    const dist = dir.length();
    dir.normalize();

    const lg = new THREE.Group();
    const railGeo = new THREE.CylinderGeometry(0.15, 0.15, dist, 8);
    const lRail = new THREE.Mesh(railGeo, ladderMat);
    lRail.position.x = -0.4;
    const rRail = new THREE.Mesh(railGeo, ladderMat);
    rRail.position.x = 0.4;
    lg.add(lRail, rRail);

    const rungCount = Math.floor(dist * 1.2);
    const rungGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8);
    for (let r = 1; r < rungCount; r++) {
      const rung = new THREE.Mesh(rungGeo, ladderMat);
      rung.position.y = -dist / 2 + dist * (r / rungCount);
      rung.rotation.z = Math.PI / 2;
      lg.add(rung);
    }

    // Base orientation: local Y → ladder direction (billboard overrides each frame)
    lg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const mid = bot.clone().add(top).multiplyScalar(0.5);
    lg.position.copy(mid);
    lg.castShadow = true;
    boardGroup.add(lg);

    // Store for per-frame billboard update
    ladders.push({ group: lg, axis: dir.clone(), midPoint: mid.clone() });

    const lSpr = createTextSprite(`Ladder to ${end}`, "#fef08a");
    lSpr.position.copy(startPos);
    lSpr.position.y += 1.5;
    boardGroup.add(lSpr);
  } else {
    /* ── SNAKE ── */
    const [sc, bc] = SNAKE_COLORS[snakeColorIdx++ % SNAKE_COLORS.length];
    const skinMat = new THREE.MeshStandardMaterial({
      color: sc,
      roughness: 0.5,
    });
    const bellyMat = new THREE.MeshStandardMaterial({
      color: bc,
      roughness: 0.5,
    });

    const diff = new THREE.Vector3().subVectors(endPos, startPos);
    const len = diff.length();
    diff.normalize();
    const side = new THREE.Vector3()
      .crossVectors(diff, new THREE.Vector3(0, 1, 0))
      .normalize();

    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const pt = new THREE.Vector3().lerpVectors(startPos, endPos, t);
      pt.y += Math.sin(t * Math.PI) * len * 0.2;
      pts.push(pt);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    snakePaths[start] = curve;

    const sg = new THREE.Group();
    const numSegs = Math.floor(len * 4);
    for (let i = 0; i <= numSegs; i++) {
      const t = i / numSegs;
      const pt = curve.getPoint(t);
      let r = 0.45;
      if (t > 0.3) r = 0.45 - ((t - 0.3) / 0.7) * 0.4;
      const seg = new THREE.Mesh(
        new THREE.SphereGeometry(r, 12, 12),
        i % 3 === 0 ? bellyMat : skinMat,
      );
      seg.position.copy(pt);
      seg.castShadow = true;
      sg.add(seg);
      snakeBodySegs.push({
        mesh: seg,
        basePos: pt.clone(),
        side,
        t,
        length: len,
      });
    }

    // Head
    const hg = new THREE.Group();
    const headPt = curve.getPoint(0);
    hg.position.copy(headPt);
    hg.lookAt(curve.getPoint(0.05)); // face toward body (end tile direction)
    snakeHeads.push({
      mesh: hg,
      baseRotation: hg.rotation.clone(),
      baseY: headPt.y,
    });

    const hMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 16, 16),
      skinMat,
    );
    hMesh.scale.set(1, 0.7, 1.2);
    hg.add(hMesh);

    const snout = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 16, 16),
      bellyMat,
    );
    snout.position.set(0, -0.2, 0.3);
    snout.scale.set(1.2, 0.5, 1);
    hg.add(snout);

    const eGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const pGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const lEye = new THREE.Mesh(eGeo, eyeWhiteMat);
    lEye.position.set(-0.3, 0.3, 0.3);
    hg.add(lEye);
    const lPup = new THREE.Mesh(pGeo, eyeBlackMat);
    lPup.position.set(-0.3, 0.35, 0.42);
    hg.add(lPup);
    const rEye = new THREE.Mesh(eGeo, eyeWhiteMat);
    rEye.position.set(0.3, 0.3, 0.3);
    hg.add(rEye);
    const rPup = new THREE.Mesh(pGeo, eyeBlackMat);
    rPup.position.set(0.3, 0.35, 0.42);
    hg.add(rPup);

    const tongue = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.6), tongueMat);
    tongue.position.set(0, -0.1, 0.8);
    tongue.rotation.x = Math.PI / 2;
    hg.add(tongue);

    sg.add(hg);
    boardGroup.add(sg);

    const sSpr = createTextSprite(`Snake to ${end}`, "#fca5a5");
    sSpr.position.copy(startPos);
    sSpr.position.y += 2.0;
    boardGroup.add(sSpr);
  }
}

// ── Physical Dice ─────────────────────────────────────────────────────────────

/** Draw a die face with N pips onto a canvas texture */
function createDiceFaceTexture(num: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;

  // Ivory background with rounded rect
  ctx.fillStyle = "#f0ede8";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(5, 5, 246, 246, 26);
  } else {
    ctx.rect(5, 5, 246, 246);
  }
  ctx.fill();
  ctx.strokeStyle = "#cdc8c0";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Pip layout per face value
  const pipMap: Record<number, [number, number][]> = {
    1: [[128, 128]],
    2: [
      [82, 82],
      [174, 174],
    ],
    3: [
      [82, 82],
      [128, 128],
      [174, 174],
    ],
    4: [
      [82, 82],
      [174, 82],
      [82, 174],
      [174, 174],
    ],
    5: [
      [82, 82],
      [174, 82],
      [128, 128],
      [82, 174],
      [174, 174],
    ],
    6: [
      [82, 82],
      [174, 82],
      [82, 128],
      [174, 128],
      [82, 174],
      [174, 174],
    ],
  };

  ctx.fillStyle = "#1a1a2e";
  (pipMap[num] ?? []).forEach(([px, py]) => {
    ctx.beginPath();
    ctx.arc(px, py, 19, 0, Math.PI * 2);
    ctx.fill();
  });
  return new THREE.CanvasTexture(c);
}

// ── Dice Scene ────────────────────────────────────────────────────────────────
const diceCanvasEl = document.getElementById(
  "dice-canvas",
) as HTMLCanvasElement;
const diceRenderer = new THREE.WebGLRenderer({
  canvas: diceCanvasEl,
  antialias: true,
  alpha: true,
});

const isMobile = window.innerWidth <= 768;
const diceSize = isMobile ? 110 : 220;
diceRenderer.setSize(diceSize, diceSize);

diceRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
diceRenderer.shadowMap.enabled = true;

const diceScene = new THREE.Scene();
const diceCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
diceCamera.position.set(0, 4, 7);
diceCamera.lookAt(0, 0, 0);

diceScene.add(new THREE.AmbientLight(0xffffff, 0.65));
const diceDirL = new THREE.DirectionalLight(0xffffff, 2.0);
diceDirL.position.set(4, 8, 5);
diceDirL.castShadow = true;
diceScene.add(diceDirL);
// Cool rim light from behind
const diceRimL = new THREE.PointLight(0x6080ff, 0.4, 20);
diceRimL.position.set(-4, 3, -3);
diceScene.add(diceRimL);
// Landing glow (starts off, fires on snap)
const diceLandGlow = new THREE.PointLight(0xfff0cc, 0, 12);
diceLandGlow.position.set(0, 2, 0);
diceScene.add(diceLandGlow);

// Floor disc
const diceFloor = new THREE.Mesh(
  new THREE.CylinderGeometry(3.5, 3.5, 0.15, 40),
  new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.95 }),
);
diceFloor.position.y = -1.075;
diceFloor.receiveShadow = true;
diceScene.add(diceFloor);

/*
 * BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
 * Standard die (opposite faces sum to 7):
 *   +Y=1, -Y=6,  +Z=2, -Z=5,  +X=3, -X=4
 */
const DICE_FACE_VALUES = [3, 4, 1, 6, 2, 5]; // per face-index
const FACE_NORMALS = [
  new THREE.Vector3(1, 0, 0), // +X → 3
  new THREE.Vector3(-1, 0, 0), // -X → 4
  new THREE.Vector3(0, 1, 0), // +Y → 1
  new THREE.Vector3(0, -1, 0), // -Y → 6
  new THREE.Vector3(0, 0, 1), // +Z → 2
  new THREE.Vector3(0, 0, -1), // -Z → 5
];

const diceMats = DICE_FACE_VALUES.map(
  (v) =>
    new THREE.MeshStandardMaterial({
      map: createDiceFaceTexture(v),
      roughness: 0.22,
      metalness: 0.03,
    }),
);
const diceMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), diceMats);
diceMesh.castShadow = true;
diceScene.add(diceMesh);

// ── Dice Physics State ────────────────────────────────────────────────────────
type DiceState = "idle" | "held" | "flying" | "done";
let diceState: DiceState = "idle";

const diceVelocity = new THREE.Vector3();
const diceAngularVelocity = new THREE.Vector3();

const DICE_GRAVITY = -28; // Snappier, faster gravity fall
const FLOOR_CONTACT_Y = 0;
const DICE_RESTITUTION = 0.35; // Slightly lower bounce to prevent infinite micro-bouncing

let diceIdleTime = 0;
let isHoldingDice = false;
let lastMouseX = 0,
  lastMouseY = 0;
let throwVX = 0,
  throwVZ = 0;
let throwAngX = 0,
  throwAngY = 0;

function updateDicePhysics(dt: number) {
  dt = Math.min(dt, 0.05);

  switch (diceState) {
    case "idle":
      diceIdleTime += dt;
      diceMesh.rotation.y += dt * 0.35;
      diceMesh.position.y = 0.05 + Math.sin(diceIdleTime * 1.1) * 0.1;
      return;

    case "held":
      diceMesh.position.y = 0.4 + Math.sin(Date.now() * 0.004) * 0.06;
      return;

    case "done":
      if (diceLandGlow.intensity > 0) {
        diceLandGlow.intensity = Math.max(0, diceLandGlow.intensity - dt * 5.5);
      }
      return;

    case "flying":
      break;
  }

  // Apply gravity forces
  diceVelocity.y += DICE_GRAVITY * dt;
  diceMesh.position.addScaledVector(diceVelocity, dt);

  // Floor contact handling
  if (diceMesh.position.y < FLOOR_CONTACT_Y) {
    diceMesh.position.y = FLOOR_CONTACT_Y;

    // Dynamic bounce threshold
    if (Math.abs(diceVelocity.y) > 0.8) {
      diceVelocity.y *= -DICE_RESTITUTION;
      // Add friction scattering to make every bounce alter the rotation unpredictable
      diceVelocity.x *= 0.6;
      diceVelocity.z *= 0.6;
      diceAngularVelocity.x += (Math.random() - 0.5) * 5;
      diceAngularVelocity.z += (Math.random() - 0.5) * 5;
    } else {
      diceVelocity.y = 0;
    }
  }

  // Boundary walls
  const WALL = 2.4;
  if (Math.abs(diceMesh.position.x) > WALL) {
    diceMesh.position.x = Math.sign(diceMesh.position.x) * WALL;
    diceVelocity.x *= -0.5;
  }
  if (Math.abs(diceMesh.position.z) > WALL) {
    diceMesh.position.z = Math.sign(diceMesh.position.z) * WALL;
    diceVelocity.z *= -0.5;
  }

  // Apply rotational spinning
  const spin = diceAngularVelocity.length();
  if (spin > 0.001) {
    const q = new THREE.Quaternion().setFromAxisAngle(
      diceAngularVelocity.clone().normalize(),
      spin * dt,
    );
    diceMesh.quaternion.premultiply(q);
  }

  // Standard damping drag
  diceVelocity.multiplyScalar(0.98);
  diceAngularVelocity.multiplyScalar(0.95);

  // FIX: Raised settle threshold from 0.09 to 0.28 to stop the long delay wait
  const grounded = diceMesh.position.y <= FLOOR_CONTACT_Y + 0.05;
  if (grounded && Math.abs(diceVelocity.y) < 0.25 && spin < 0.28) {
    snapDiceToFace();
  }
}

function snapDiceToFace() {
  // FIX: Instead of aligning to absolute World Up (0,1,0), we align the winning face
  // to point directly at the camera direction slightly tilted forward for absolute clarity.
  const targetViewVector = new THREE.Vector3(0, 1, 0.4).normalize();

  let maxDot = -Infinity,
    topIdx = 2;
  FACE_NORMALS.forEach((n, i) => {
    const dot = n
      .clone()
      .applyQuaternion(diceMesh.quaternion)
      .dot(targetViewVector);
    if (dot > maxDot) {
      maxDot = dot;
      topIdx = i;
    }
  });

  const faceWorldNormal = FACE_NORMALS[topIdx]
    .clone()
    .applyQuaternion(diceMesh.quaternion);

  // Smoothly snap the face orientation to look beautifully presentation-ready to the player
  diceMesh.quaternion.premultiply(
    new THREE.Quaternion().setFromUnitVectors(
      faceWorldNormal,
      new THREE.Vector3(0, 1, 0),
    ),
  );

  // Subtle tilt toward camera viewport panel
  diceMesh.rotation.x += 0.32;

  diceMesh.position.set(0, FLOOR_CONTACT_Y, 0);
  diceVelocity.set(0, 0, 0);
  diceAngularVelocity.set(0, 0, 0);

  diceLandGlow.intensity = 4.0;
  diceState = "done";

  const result = DICE_FACE_VALUES[topIdx];
  if (gameStarted) onDiceResult(result);
}

// ── Refactored Interaction Logic ─────────────────────────────────────────────
let interactionStartTime = 0;
let interactionStartX = 0;
let interactionStartY = 0;

function startHold(clientX: number, clientY: number) {
  if (!gameStarted) return;
  if (players[currentPlayerIndex]?.isMoving) return;
  if (diceState !== "idle" && diceState !== "done") return;

  diceState = "held";
  isHoldingDice = true;
  interactionStartTime = Date.now();
  interactionStartX = clientX;
  interactionStartY = clientY;

  lastMouseX = clientX;
  lastMouseY = clientY;
  throwVX = throwVZ = throwAngX = throwAngY = 0;

  diceVelocity.set(0, 0, 0);
  diceAngularVelocity.set(0, 0, 0);

  // FIX: Scramble rotation on initial touch instantly so it can never repeat the same position state
  diceMesh.quaternion.setFromEuler(
    new THREE.Euler(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
    ),
  );

  diceCanvasEl.classList.add("grabbing");
  diceMesh.position.set(0, 0.4, 0);
}

function moveDice(clientX: number, clientY: number) {
  if (!isHoldingDice) return;
  const dx = clientX - lastMouseX,
    dy = clientY - lastMouseY;

  diceMesh.rotation.y += dx * 0.02;
  diceMesh.rotation.x += dy * 0.02;

  throwVX = throwVX * 0.5 + dx * 0.06;
  throwVZ = throwVZ * 0.5 + dy * 0.06;
  throwAngX = throwAngX * 0.5 + dy * 0.45;
  throwAngY = throwAngY * 0.5 + dx * 0.45;

  lastMouseX = clientX;
  lastMouseY = clientY;
}

function releaseDice(clientX?: number, clientY?: number) {
  if (!isHoldingDice) return;
  isHoldingDice = false;
  diceCanvasEl.classList.remove("grabbing");
  if (diceState !== "held") return;

  const clickDuration = Date.now() - interactionStartTime;
  let deltaX = 0,
    deltaY = 0;

  if (clientX !== undefined && clientY !== undefined) {
    deltaX = Math.abs(clientX - interactionStartX);
    deltaY = Math.abs(clientY - interactionStartY);
  }

  diceState = "flying";

  // FIX: If it's a tap or micro-touch, apply a high-tumbling chaotic impulse upward
  if (clickDuration < 280 && deltaX < 12 && deltaY < 12) {
    const randVX = (Math.random() - 0.5) * 7;
    const randVZ = -6 - Math.random() * 6;
    const randVY = 11 + Math.random() * 4; // Higher programmatic pop upward

    diceVelocity.set(randVX, randVY, randVZ);
    diceAngularVelocity.set(
      22 + Math.random() * 20,
      22 + Math.random() * 20,
      (Math.random() - 0.5) * 15,
    );
  } else {
    // High-fidelity dynamic manual flick roll track
    const spd = Math.sqrt(throwVX * throwVX + throwVZ * throwVZ);
    diceVelocity.set(throwVX * 3.2, 9.0 + spd * 2.5, throwVZ * 3.2);
    diceAngularVelocity.set(
      throwAngX * 5 + (Math.random() - 0.5) * 5,
      throwAngY * 5 + (Math.random() - 0.5) * 5,
      (throwAngX - throwAngY) * 3,
    );
  }
}

// Mouse mappings
diceCanvasEl.addEventListener("mousedown", (e) =>
  startHold(e.clientX, e.clientY),
);
window.addEventListener("mousemove", (e) => moveDice(e.clientX, e.clientY));
window.addEventListener("mouseup", (e) => releaseDice(e.clientX, e.clientY));

// Touch mappings (Refactored passive settings for fast action updates)
diceCanvasEl.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    const t = e.touches[0];
    startHold(t.clientX, t.clientY);
  },
  { passive: false },
);

window.addEventListener(
  "touchmove",
  (e) => {
    if (!isHoldingDice) return;
    e.preventDefault();
    const t = e.touches[0];
    moveDice(t.clientX, t.clientY);
  },
  { passive: false },
);

window.addEventListener("touchend", (e) => {
  // If multiple tracking points exist, check last change data array
  const t = e.changedTouches[0];
  releaseDice(t?.clientX, t?.clientY);
});

// ── Game State ────────────────────────────────────────────────────────────────
let players: Player[] = [];
let currentPlayerIndex = 0;
let gameStarted = false;

const playersListDiv = document.getElementById("players-list")!;
const turnIndicator = document.getElementById("turn-indicator")!;
const diceResultP = document.getElementById("dice-result")!;

function updateUI() {
  if (!gameStarted) return;
  playersListDiv.innerHTML = "";
  players.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = `player-item${i === currentPlayerIndex ? " active" : ""}`;
    div.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px">
                <div class="player-color-box" style="background:#${p.color.toString(16).padStart(6, "0")}"></div>
                <span>${p.name}</span>
            </div>
            <span>Tile ${p.currentTile}</span>
        `;
    playersListDiv.appendChild(div);
  });
  const cur = players[currentPlayerIndex];
  turnIndicator.innerText = `${cur.name}'s Turn`;
  turnIndicator.style.color = `#${cur.color.toString(16).padStart(6, "0")}`;
}

function onDiceResult(value: number) {
  const player = players[currentPlayerIndex];
  if (!player || player.isMoving || player.currentTile >= TOTAL_TILES) return;
  diceResultP.innerText = `${player.name} rolled ${value}!`;
  let next = player.currentTile + value;
  if (next > TOTAL_TILES) next = TOTAL_TILES;
  for (let i = player.currentTile + 1; i <= next; i++) player.moveQueue.push(i);
  player.isMoving = true;
}

function checkTurnEnd(player: Player) {
  updateUI();
  if (player.currentTile === TOTAL_TILES) {
    diceResultP.innerText = `🎉 ${player.name} Wins!`;
    player.isMoving = false;
    return;
  }
  player.isMoving = false;
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  updateUI();
  diceState = "idle";
  diceIdleTime = 0;
  diceResultP.innerText = "";
}

// ── Setup Screen ──────────────────────────────────────────────────────────────
const setupScreen = document.getElementById("setup-screen")!;
const playerInputsEl = document.getElementById("player-inputs")!;
const addPlayerBtn = document.getElementById(
  "add-player-btn",
) as HTMLButtonElement;
const startGameBtn = document.getElementById(
  "start-game-btn",
) as HTMLButtonElement;

let pendingCount = 2; // start with 2 players

function renderSetupInputs() {
  playerInputsEl.innerHTML = "";
  for (let i = 0; i < pendingCount; i++) {
    const row = document.createElement("div");
    row.className = "player-input-row";
    row.innerHTML = `
            <div class="player-color-dot" style="background:${PLAYER_COLORS_CSS[i]}"></div>
            <input
                type="text"
                placeholder="Enter name"
                value="Player ${i + 1}"
                maxlength="16"
                aria-label="Player ${i + 1} name"
            />
            ${
              i >= 2
                ? `<button class="remove-player-btn" aria-label="Remove player ${i + 1}">×</button>`
                : ""
            }
        `;
    playerInputsEl.appendChild(row);
  }

  // Bind remove buttons (only appear for players 3 & 4)
  playerInputsEl
    .querySelectorAll<HTMLButtonElement>(".remove-player-btn")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        if (pendingCount > 2) {
          pendingCount--;
          renderSetupInputs();
        }
      });
    });

  addPlayerBtn.disabled = pendingCount >= 4;
}

addPlayerBtn.addEventListener("click", () => {
  if (pendingCount < 4) {
    pendingCount++;
    renderSetupInputs();
  }
});

startGameBtn.addEventListener("click", () => {
  const inputs =
    playerInputsEl.querySelectorAll<HTMLInputElement>('input[type="text"]');
  const names: string[] = [];
  inputs.forEach((inp, i) => names.push(inp.value.trim() || `Player ${i + 1}`));

  players = names.map(
    (name, i) => new Player(i, name, PLAYER_COLORS[i], scene, tilePositions[1]),
  );

  setupScreen.classList.add("hidden");
  gameStarted = true;
  diceState = "idle";
  updateUI();
});

// Render initial 2-player setup
renderSetupInputs();

// ── Animation Loop ────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
const HOP_SPEED = 3;
const SLIDE_SPEED = 1.5;

// Pre-allocated reusable vectors (avoid per-frame GC pressure)
const _camPos = new THREE.Vector3();
const _toCam = new THREE.Vector3();
const _projZ = new THREE.Vector3();
const _axisX = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  controls.update();

  const time = Date.now() * 0.005;

  // ── Snake body slither ──
  snakeBodySegs.forEach((sb) => {
    const w = Math.sin(time * 0.75 - sb.t * 20) * (sb.length * 0.05);
    sb.mesh.position.copy(sb.basePos).addScaledVector(sb.side, w);
  });

  // ── Snake head bob & look ──
  snakeHeads.forEach((sh, idx) => {
    sh.mesh.position.y = sh.baseY + Math.sin(time + idx) * 0.08;
    sh.mesh.rotation.x = sh.baseRotation.x + Math.sin(time * 0.5 + idx) * 0.1;
    sh.mesh.rotation.y = sh.baseRotation.y + Math.sin(time * 0.8 + idx) * 0.15;
  });

  // ── Ladder cylindrical billboard ──
  // Each ladder rotates around its own axis so the face (rungs) always faces the camera.
  // Math: build a frame (X, axis, Z) where Z = camera direction projected ⊥ to the axis.
  camera.getWorldPosition(_camPos);
  ladders.forEach((ld) => {
    _toCam.subVectors(_camPos, ld.midPoint);
    // Project toCam perpendicular to the ladder axis
    const dot = _toCam.dot(ld.axis);
    _projZ.copy(_toCam).addScaledVector(ld.axis, -dot); // Z = toward camera, ⊥ to axis
    if (_projZ.lengthSq() < 0.01) return; // camera exactly along axis → skip
    _projZ.normalize();
    _axisX.crossVectors(ld.axis, _projZ).normalize(); // X = Y × Z (right-hand)
    _mat4.makeBasis(_axisX, ld.axis, _projZ);
    ld.group.quaternion.setFromRotationMatrix(_mat4);
  });

  // ── Player movement ──
  if (gameStarted && players.length > 0) {
    const player = players[currentPlayerIndex];

    if (player?.isMoving) {
      const ox = (player.id % 2 === 0 ? 1 : -1) * 0.8;
      const oz = (player.id < 2 ? 1 : -1) * 0.8;
      const off = (pos: THREE.Vector3) =>
        new THREE.Vector3(pos.x + ox, pos.y, pos.z + oz);

      if (player.currentJump) {
        // Sliding down snake or climbing ladder
        player.jumpProgress += delta * SLIDE_SPEED;
        if (player.jumpProgress >= 1.0) {
          player.currentTile = player.moveQueue.shift()!;
          player.mesh.position.copy(off(tilePositions[player.currentTile]));
          player.currentJump = null;
          player.jumpProgress = 0;
          checkTurnEnd(player);
        } else if (player.currentJump === "slide") {
          const curve = snakePaths[player.currentTile];
          if (curve)
            player.mesh.position.copy(off(curve.getPoint(player.jumpProgress)));
        } else {
          // climb: lerp from start tile to target (top of ladder)
          const sp = off(tilePositions[player.currentTile]);
          player.mesh.position.lerpVectors(
            sp,
            player.targetPosition,
            player.jumpProgress,
          );
        }
      } else if (player.moveQueue.length > 0) {
        const nextNum = player.moveQueue[0];
        player.targetPosition.copy(off(tilePositions[nextNum]));

        // Trigger snake/ladder jump when arriving at a jump tile
        if (
          JUMPS[player.currentTile] &&
          nextNum === JUMPS[player.currentTile]
        ) {
          player.currentJump = player.currentTile > nextNum ? "slide" : "climb";
          player.jumpProgress = 0;
          // Don't early-return — fall through to render both scenes
        } else {
          // Normal hop animation between adjacent tiles
          if (player.hopProgress === 0) {
            player.startHopPosition.copy(player.mesh.position);
          }
          player.hopProgress += delta * HOP_SPEED;

          if (player.hopProgress >= 1.0) {
            player.currentTile = player.moveQueue.shift()!;
            player.mesh.position.copy(player.targetPosition);
            player.hopProgress = 0;
            if (player.moveQueue.length === 0) {
              if (JUMPS[player.currentTile]) {
                player.moveQueue.push(JUMPS[player.currentTile]);
              } else {
                checkTurnEnd(player);
              }
            }
          } else {
            // Arc hop: linear XZ + sine Y
            player.mesh.position.lerpVectors(
              player.startHopPosition,
              player.targetPosition,
              player.hopProgress,
            );
            player.mesh.position.y +=
              Math.sin(player.hopProgress * Math.PI) * 2;
          }
        }
      }
    }
  }

  // ── Dice ──
  updateDicePhysics(delta);

  // Lock dice canvas while player pawn is moving
  const isLocked =
    !gameStarted ||
    (!!players[currentPlayerIndex]?.isMoving && diceState !== "flying");
  diceCanvasEl.classList.toggle("locked", isLocked);

  // Render both scenes
  renderer.render(scene, camera);
  diceRenderer.render(diceScene, diceCamera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  const isMobile = window.innerWidth <= 768;
  const diceSize = isMobile ? 110 : 220;
  diceRenderer.setSize(diceSize, diceSize);
});

animate();
