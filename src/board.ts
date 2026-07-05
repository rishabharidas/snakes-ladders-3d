import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TILE_SIZE, BOARD_SIZE, TOTAL_TILES, JUMPS, SNAKE_COLORS } from "./constants";

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1e293b);

export const camera = new THREE.PerspectiveCamera(
  window.innerWidth <= 768 ? 75 : 60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);

if (window.innerWidth <= 768) {
  camera.position.set(-10, 40, 60);
} else {
  camera.position.set(0, 40, 40);
}
camera.lookAt(0, 0, 0);

export const renderer = new THREE.WebGLRenderer({
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

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.1;
controls.minDistance = 10;
controls.maxDistance = 100;

// ── Board Tiles ───────────────────────────────────────────────────────────────
export const tilePositions: THREE.Vector3[] = [new THREE.Vector3()]; // 1-indexed
export const boardGroup = new THREE.Group();
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
export interface LadderInfo {
  group: THREE.Group;
  axis: THREE.Vector3;
  midPoint: THREE.Vector3;
}
export const ladders: LadderInfo[] = [];
export const snakePaths: Record<number, THREE.CatmullRomCurve3> = {};
export const snakeHeads: {
  mesh: THREE.Group;
  baseRotation: THREE.Euler;
  baseY: number;
}[] = [];
export const snakeBodySegs: {
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

    lg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const mid = bot.clone().add(top).multiplyScalar(0.5);
    lg.position.copy(mid);
    lg.castShadow = true;
    boardGroup.add(lg);

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
    hg.lookAt(curve.getPoint(0.05));
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
