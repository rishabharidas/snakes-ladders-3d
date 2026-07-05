import * as THREE from "three";
import { DICE_FACE_VALUES, FACE_NORMALS } from "./constants";
import { state } from "./state";

// ── Dice Canvas & Renderer Setup ──────────────────────────────────────────────
export const diceCanvasEl = document.getElementById("dice-canvas") as HTMLCanvasElement;
export const diceRenderer = new THREE.WebGLRenderer({
  canvas: diceCanvasEl,
  antialias: true,
  alpha: true,
});

const isMobile = window.innerWidth <= 768;
const diceSize = isMobile ? 110 : 220;
diceRenderer.setSize(diceSize, diceSize);
diceRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
diceRenderer.shadowMap.enabled = true;

export const diceScene = new THREE.Scene();
export const diceCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
diceCamera.position.set(0, 4, 7);
diceCamera.lookAt(0, 0, 0);

diceScene.add(new THREE.AmbientLight(0xffffff, 0.65));
const diceDirL = new THREE.DirectionalLight(0xffffff, 2.0);
diceDirL.position.set(4, 8, 5);
diceDirL.castShadow = true;
diceScene.add(diceDirL);

const diceRimL = new THREE.PointLight(0x6080ff, 0.4, 20);
diceRimL.position.set(-4, 3, -3);
diceScene.add(diceRimL);

export const diceLandGlow = new THREE.PointLight(0xfff0cc, 0, 12);
diceLandGlow.position.set(0, 2, 0);
diceScene.add(diceLandGlow);

const diceFloor = new THREE.Mesh(
  new THREE.CylinderGeometry(3.5, 3.5, 0.15, 40),
  new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.8,
  }),
);
diceFloor.position.y = -1;
diceFloor.receiveShadow = true;
diceScene.add(diceFloor);

// ── Dice Face Texture Generator ───────────────────────────────────────────────
function createDiceFaceTexture(num: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;

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

  const pipMap: Record<number, [number, number][]> = {
    1: [[128, 128]],
    2: [[82, 82], [174, 174]],
    3: [[82, 82], [128, 128], [174, 174]],
    4: [[82, 82], [174, 82], [82, 174], [174, 174]],
    5: [[82, 82], [174, 82], [128, 128], [82, 174], [174, 174]],
    6: [[82, 82], [174, 82], [82, 128], [174, 128], [82, 174], [174, 174]],
  };

  ctx.fillStyle = "#1a1a2e";
  (pipMap[num] ?? []).forEach(([px, py]) => {
    ctx.beginPath();
    ctx.arc(px, py, 19, 0, Math.PI * 2);
    ctx.fill();
  });
  return new THREE.CanvasTexture(c);
}

const diceMats = DICE_FACE_VALUES.map(
  (v) =>
    new THREE.MeshStandardMaterial({
      map: createDiceFaceTexture(v),
      roughness: 0.22,
      metalness: 0.03,
    }),
);

export const diceMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), diceMats);
diceMesh.castShadow = true;
diceScene.add(diceMesh);

// ── Dice Physics State & Mappings ─────────────────────────────────────────────
export type DiceState = "idle" | "held" | "flying" | "done";
export let diceState: DiceState = "idle";
export function setDiceState(val: DiceState) { diceState = val; }

export const diceVelocity = new THREE.Vector3();
export const diceAngularVelocity = new THREE.Vector3();

const DICE_GRAVITY = -28;
const FLOOR_CONTACT_Y = 0;
const DICE_RESTITUTION = 0.35;

export let diceIdleTime = 0;
export function setDiceIdleTime(val: number) { diceIdleTime = val; }

export let diceFlightTime = 0;

let isHoldingDice = false;
let lastMouseX = 0;
let lastMouseY = 0;
let throwVX = 0;
let throwVZ = 0;
let throwAngX = 0;
let throwAngY = 0;

let interactionStartTime = 0;
let interactionStartX = 0;
let interactionStartY = 0;

// Dice Result Callback
let onDiceResultCallback: ((value: number) => void) | null = null;
export function registerOnDiceResult(cb: (value: number) => void) {
  onDiceResultCallback = cb;
}

// ── Physics Loop ──────────────────────────────────────────────────────────────
export function updateDicePhysics(dt: number) {
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
      diceFlightTime += dt;
      break;
  }

  diceVelocity.y += DICE_GRAVITY * dt;
  diceMesh.position.addScaledVector(diceVelocity, dt);

  if (diceMesh.position.y < FLOOR_CONTACT_Y) {
    diceMesh.position.y = FLOOR_CONTACT_Y;

    if (Math.abs(diceVelocity.y) > 0.8) {
      diceVelocity.y *= -DICE_RESTITUTION;
      diceVelocity.x *= 0.6;
      diceVelocity.z *= 0.6;
      diceAngularVelocity.x += (Math.random() - 0.5) * 5;
      diceAngularVelocity.z += (Math.random() - 0.5) * 5;
    } else {
      diceVelocity.y = 0;
    }
  }

  const WALL = 2.4;
  if (Math.abs(diceMesh.position.x) > WALL) {
    diceMesh.position.x = Math.sign(diceMesh.position.x) * WALL;
    diceVelocity.x *= -0.5;
  }
  if (Math.abs(diceMesh.position.z) > WALL) {
    diceMesh.position.z = Math.sign(diceMesh.position.z) * WALL;
    diceVelocity.z *= -0.5;
  }

  const spin = diceAngularVelocity.length();
  if (spin > 0.001) {
    const q = new THREE.Quaternion().setFromAxisAngle(
      diceAngularVelocity.clone().normalize(),
      spin * dt,
    );
    diceMesh.quaternion.premultiply(q);
  }

  diceVelocity.multiplyScalar(0.98);
  diceAngularVelocity.multiplyScalar(0.95);

  const grounded = diceMesh.position.y <= FLOOR_CONTACT_Y + 0.05;
  const timeLimitReached = diceFlightTime >= 1.2;
  if (timeLimitReached || (grounded && Math.abs(diceVelocity.y) < 0.25 && spin < 0.28)) {
    if (state.remoteTargetValue !== null) {
      snapDiceToValue(state.remoteTargetValue);
      state.remoteTargetValue = null;
    } else {
      snapDiceToFace();
    }
  }
}

// ── Settle & Snap ─────────────────────────────────────────────────────────────
export function snapDiceToFace() {
  const targetViewVector = new THREE.Vector3(0, 1, 0.4).normalize();

  let maxDot = -Infinity;
  let topIdx = 2;
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

  diceMesh.quaternion.premultiply(
    new THREE.Quaternion().setFromUnitVectors(
      faceWorldNormal,
      new THREE.Vector3(0, 1, 0),
    ),
  );

  diceMesh.rotation.x += 0.32;
  diceMesh.position.set(0, FLOOR_CONTACT_Y, 0);
  diceVelocity.set(0, 0, 0);
  diceAngularVelocity.set(0, 0, 0);

  diceLandGlow.intensity = 4.0;
  diceState = "done";

  const result = DICE_FACE_VALUES[topIdx];
  if (state.gameStarted && onDiceResultCallback) {
    onDiceResultCallback(result);
  }
}

export function snapDiceToValue(targetValue: number) {
  const topIdx = DICE_FACE_VALUES.indexOf(targetValue);
  if (topIdx === -1) return;

  const faceWorldNormal = FACE_NORMALS[topIdx]
    .clone()
    .applyQuaternion(diceMesh.quaternion);

  diceMesh.quaternion.premultiply(
    new THREE.Quaternion().setFromUnitVectors(
      faceWorldNormal,
      new THREE.Vector3(0, 1, 0),
    ),
  );

  diceMesh.rotation.x += 0.32;
  diceMesh.position.set(0, FLOOR_CONTACT_Y, 0);
  diceVelocity.set(0, 0, 0);
  diceAngularVelocity.set(0, 0, 0);

  diceLandGlow.intensity = 4.0;
  diceState = "done";

  if (state.gameStarted && onDiceResultCallback) {
    onDiceResultCallback(targetValue);
  }
}

export function triggerRemoteRoll(value: number) {
  if (state.remoteTargetValue === value && diceState === "flying") return;
  if (diceState === "held") return;

  diceMesh.position.set(0, 0.4, 0);
  diceMesh.quaternion.setFromEuler(
    new THREE.Euler(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
    ),
  );

  diceState = "flying";
  diceFlightTime = 0;
  diceVelocity.set((Math.random() - 0.5) * 6, 12 + Math.random() * 3, -6 - Math.random() * 4);
  diceAngularVelocity.set(
    20 + Math.random() * 15,
    20 + Math.random() * 15,
    (Math.random() - 0.5) * 10
  );

  state.remoteTargetValue = value;
}

// ── Interaction Logic ─────────────────────────────────────────────────────────
function startHold(clientX: number, clientY: number) {
  if (!state.gameStarted) return;
  const isOurTurn = (state.mpMode === "local") || (state.currentPlayerIndex === state.myPlayerIndex);
  if (!isOurTurn) return;
  if (state.players[state.currentPlayerIndex]?.isMoving) return;
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
  const dx = clientX - lastMouseX;
  const dy = clientY - lastMouseY;

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
  let deltaX = 0;
  let deltaY = 0;

  if (clientX !== undefined && clientY !== undefined) {
    deltaX = Math.abs(clientX - interactionStartX);
    deltaY = Math.abs(clientY - interactionStartY);
  }

  diceState = "flying";
  diceFlightTime = 0;

  if (clickDuration < 280 && deltaX < 12 && deltaY < 12) {
    const randVX = (Math.random() - 0.5) * 7;
    const randVZ = -6 - Math.random() * 6;
    const randVY = 11 + Math.random() * 4;

    diceVelocity.set(randVX, randVY, randVZ);
    diceAngularVelocity.set(
      22 + Math.random() * 20,
      22 + Math.random() * 20,
      (Math.random() - 0.5) * 15,
    );
  } else {
    const spd = Math.sqrt(throwVX * throwVX + throwVZ * throwVZ);
    diceVelocity.set(throwVX * 3.2, 9.0 + spd * 2.5, throwVZ * 3.2);
    diceAngularVelocity.set(
      throwAngX * 5 + (Math.random() - 0.5) * 5,
      throwAngY * 5 + (Math.random() - 0.5) * 5,
      (throwAngX - throwAngY) * 3,
    );
  }

  // Pre-generate and sync dice value for online play
  if (state.mpMode !== "local" && state.currentPlayerIndex === state.myPlayerIndex) {
    const value = Math.floor(Math.random() * 6) + 1;
    state.remoteTargetValue = value;
    if (state.mpMode === "host") {
      console.log("MP LOG: Host pre-generated roll value =", value, "and is broadcasting to clients.");
      for (const peerId in state.clientConnections) {
        try {
          state.clientConnections[peerId].send({
            type: "sync_roll",
            currentPlayerIndex: state.currentPlayerIndex,
            value: value
          });
        } catch (err) {
          console.error("MP ERROR: Host failed to send sync_roll to client", peerId, err);
        }
      }
    } else if (state.mpMode === "client" && state.hostConnection) {
      console.log("MP LOG: Client pre-generated roll value =", value, "and is sending to Host.");
      try {
        state.hostConnection.send({
          type: "roll_dice",
          value: value
        });
      } catch (err) {
        console.error("MP ERROR: Client failed to send roll_dice to Host:", err);
      }
    }
  }
}

// ── Bind Event Listeners ──────────────────────────────────────────────────────
diceCanvasEl.addEventListener("mousedown", (e) => startHold(e.clientX, e.clientY));
window.addEventListener("mousemove", (e) => moveDice(e.clientX, e.clientY));
window.addEventListener("mouseup", (e) => releaseDice(e.clientX, e.clientY));

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
  const t = e.changedTouches[0];
  releaseDice(t?.clientX, t?.clientY);
});
