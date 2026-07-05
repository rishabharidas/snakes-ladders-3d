import * as THREE from "three";
import { TOTAL_TILES, JUMPS, PLAYER_COLORS, PLAYER_COLORS_CSS } from "./constants";
import { state } from "./state";
import { Player } from "./player";
import {
  scene,
  camera,
  renderer,
  controls,
  tilePositions,
  snakePaths,
  snakeBodySegs,
  snakeHeads,
  ladders,
} from "./board";
import {
  diceCanvasEl,
  diceRenderer,
  diceScene,
  diceCamera,
  diceState,
  updateDicePhysics,
  registerOnDiceResult,
  setDiceState,
  setDiceIdleTime,
} from "./dice";
import {
  generateRoomId,
  setupHostPeer,
  setupClientPeer,
  leaveLobby,
  startOnlineGame,
  registerMultiplayerUIUpdate,
  registerMultiplayerRestart,
} from "./multiplayer";

// ── Setup Screen DOM References ───────────────────────────────────────────────
const setupScreen = document.getElementById("setup-screen")!;
const playerInputsEl = document.getElementById("player-inputs")!;
const addPlayerBtn = document.getElementById("add-player-btn") as HTMLButtonElement;
const startGameBtn = document.getElementById("start-game-btn") as HTMLButtonElement;

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

  // Clean up any existing players from the scene
  state.players.forEach((p) => scene.remove(p.mesh));

  state.players = names.map(
    (name, i) => new Player(i, name, PLAYER_COLORS[i], scene, tilePositions[1]),
  );

  setupScreen.classList.add("hidden");
  state.gameStarted = true;
  setDiceState("idle");
  updateUI();
});

// Render initial 2-player setup
renderSetupInputs();

// ── Multiplayer DOM Tab Selectors ─────────────────────────────────────────────
const tabLocal = document.getElementById("tab-local")!;
const tabOnline = document.getElementById("tab-online")!;
const panelLocal = document.getElementById("panel-local")!;
const panelOnline = document.getElementById("panel-online")!;

const onlineMenu = document.getElementById("online-menu")!;
const onlineHostSetup = document.getElementById("online-host-setup")!;
const onlineJoinSetup = document.getElementById("online-join-setup")!;
const onlineLobby = document.getElementById("online-lobby")!;

const btnHostChoice = document.getElementById("btn-host-choice")!;
const btnJoinChoice = document.getElementById("btn-join-choice")!;
const btnBackHost = document.getElementById("btn-back-host")!;
const btnBackJoin = document.getElementById("btn-back-join")!;

const btnCreateLobby = document.getElementById("btn-create-lobby")!;
const hostPlayerNameInput = document.getElementById("host-player-name") as HTMLInputElement;

const btnJoinLobby = document.getElementById("btn-join-lobby")!;
const joinRoomIdInput = document.getElementById("join-room-id") as HTMLInputElement;
const joinPlayerNameInput = document.getElementById("join-player-name") as HTMLInputElement;

const btnStartOnlineGame = document.getElementById("btn-start-online-game") as HTMLButtonElement;
const btnLeaveLobby = document.getElementById("btn-leave-lobby")!;
const btnCopyLink = document.getElementById("btn-copy-link")!;

tabLocal.addEventListener("click", () => {
  tabLocal.classList.add("active");
  tabOnline.classList.remove("active");
  panelLocal.classList.add("active");
  panelOnline.classList.remove("active");
});

tabOnline.addEventListener("click", () => {
  tabOnline.classList.add("active");
  tabLocal.classList.remove("active");
  panelOnline.classList.add("active");
  panelLocal.classList.remove("active");
});

btnHostChoice.addEventListener("click", () => {
  onlineMenu.classList.add("hidden");
  onlineHostSetup.classList.remove("hidden");
});

btnJoinChoice.addEventListener("click", () => {
  onlineMenu.classList.add("hidden");
  onlineJoinSetup.classList.remove("hidden");
});

btnBackHost.addEventListener("click", () => {
  onlineHostSetup.classList.add("hidden");
  onlineMenu.classList.remove("hidden");
});

btnBackJoin.addEventListener("click", () => {
  onlineJoinSetup.classList.add("hidden");
  onlineMenu.classList.remove("hidden");
});

btnLeaveLobby.addEventListener("click", () => {
  leaveLobby();
  updateUI();
});

btnCopyLink.addEventListener("click", () => {
  if (!state.currentRoomId) return;
  const link = `${window.location.origin}${window.location.pathname}?room=${state.currentRoomId}`;
  navigator.clipboard.writeText(link).then(() => {
    const originalText = btnCopyLink.innerText;
    btnCopyLink.innerText = "Copied!";
    btnCopyLink.style.borderColor = "#34d399";
    setTimeout(() => {
      btnCopyLink.innerText = originalText;
      btnCopyLink.style.borderColor = "";
    }, 2000);
  }).catch(err => {
    console.error("Failed to copy link:", err);
  });
});

btnCreateLobby.addEventListener("click", () => {
  const name = hostPlayerNameInput.value.trim() || "Host Player";
  const roomId = generateRoomId();
  
  onlineHostSetup.classList.add("hidden");
  onlineLobby.classList.remove("hidden");
  
  const roomCodeVal = document.getElementById("room-code-val")!;
  roomCodeVal.innerText = roomId;
  
  setupHostPeer(roomId, name);
});

btnJoinLobby.addEventListener("click", () => {
  const roomId = joinRoomIdInput.value.trim().toUpperCase();
  const name = joinPlayerNameInput.value.trim() || "Guest Player";
  
  if (!roomId) {
    alert("Please enter a Room Code");
    return;
  }
  
  onlineJoinSetup.classList.add("hidden");
  onlineLobby.classList.remove("hidden");
  
  const roomCodeVal = document.getElementById("room-code-val")!;
  roomCodeVal.innerText = roomId;
  
  btnStartOnlineGame.disabled = true;
  btnStartOnlineGame.innerText = "Waiting for Host...";
  
  setupClientPeer(roomId, name);
});

btnStartOnlineGame.addEventListener("click", () => {
  if (state.mpMode !== "host") return;
  
  const playersData = [
    { peerId: state.myPeerId, name: state.hostName }
  ];
  for (const peerId in state.clientConnections) {
    playersData.push({
      peerId: peerId,
      name: state.clientNames[peerId] || "Guest"
    });
  }
  
  console.log("MP LOG: Host starting online game. playersData =", playersData);
  for (const peerId in state.clientConnections) {
    try {
      state.clientConnections[peerId].send({
        type: "start_game",
        players: playersData
      });
    } catch (err) {
      console.error("MP ERROR: Host failed to send start_game to client", peerId, err);
    }
  }
  
  state.myPlayerIndex = 0;
  startOnlineGame(playersData);
});

// ── In-Game UI Updating ───────────────────────────────────────────────────────
const playersListDiv = document.getElementById("players-list")!;
const turnIndicator = document.getElementById("turn-indicator")!;
const diceResultP = document.getElementById("dice-result")!;
const diceHintEl = document.querySelector(".dice-hint") as HTMLParagraphElement;

export function updateUI() {
  if (!state.gameStarted) return;
  playersListDiv.innerHTML = "";
  state.players.forEach((p, i) => {
    const isMe = (state.mpMode !== "local") && (i === state.myPlayerIndex);
    const div = document.createElement("div");
    div.className = `player-item${i === state.currentPlayerIndex ? " active" : ""}`;
    div.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px">
                <div class="player-color-box" style="background:#${p.color.toString(16).padStart(6, "0")}"></div>
                <span>${p.name}${isMe ? " (You)" : ""}</span>
                <span style="color: rgba(255, 255, 255, 0.5); margin-right:5px;"> | </span>
            </div>
            <span>Tile ${p.currentTile}</span>
        `;
    playersListDiv.appendChild(div);
  });
  
  const cur = state.players[state.currentPlayerIndex];
  const isOurTurn = (state.mpMode === "local") || (state.currentPlayerIndex === state.myPlayerIndex);
  
  if (state.mpMode !== "local") {
    turnIndicator.innerText = isOurTurn ? `${cur.name}'s Turn (You!)` : `${cur.name}'s Turn`;
  } else {
    turnIndicator.innerText = `${cur.name}'s Turn`;
  }
  turnIndicator.style.color = `#${cur.color.toString(16).padStart(6, "0")}`;

  if (diceHintEl) {
    if (state.mpMode !== "local") {
      diceHintEl.innerText = isOurTurn ? "Tap or Hold & Flick!" : `Waiting for ${cur.name} to roll...`;
    } else {
      diceHintEl.innerText = "Tap or Hold & Flick!";
    }
  }
}

// Bind UI Callbacks from PeerJS events
registerMultiplayerUIUpdate(updateUI);

// ── Dice Result & Rules Logic ─────────────────────────────────────────────────
function onDiceResult(value: number) {
  console.log("MP LOG: onDiceResult value =", value, "mpMode =", state.mpMode, "currentPlayerIndex =", state.currentPlayerIndex, "myPlayerIndex =", state.myPlayerIndex);
  const player = state.players[state.currentPlayerIndex];
  if (!player) {
    console.error("MP ERROR: player is undefined inside onDiceResult for currentPlayerIndex:", state.currentPlayerIndex);
    return;
  }
  if (player.isMoving || player.currentTile >= TOTAL_TILES) return;

  // Exact-win checking rule
  if (value > TOTAL_TILES - player.currentTile) {
    diceResultP.innerText = `${player.name} rolled ${value}! Need exactly ${TOTAL_TILES - player.currentTile} to win.`;
    player.isMoving = true; // Lock dice controls temporarily
    setTimeout(() => {
      player.isMoving = false;
      advanceTurn();
    }, 2000);
    return;
  }

  diceResultP.innerText = `${player.name} rolled ${value}!`;
  let next = player.currentTile + value;
  if (next > TOTAL_TILES) next = TOTAL_TILES;
  for (let i = player.currentTile + 1; i <= next; i++) player.moveQueue.push(i);
  player.isMoving = true;
}

registerOnDiceResult(onDiceResult);

function checkTurnEnd(player: Player) {
  updateUI();
  if (player.currentTile === TOTAL_TILES) {
    player.isMoving = false;
    
    player.hasFinished = true;
    const nextRank = state.players.filter(p => p.hasFinished).length;
    player.finishedRank = nextRank;
    
    showWinnerCelebration(player);
    
    setTimeout(() => {
      const winPopup = document.getElementById("winner-popup")!;
      winPopup.classList.add("hidden");
      advanceTurn();
    }, 3000);
    return;
  }
  player.isMoving = false;
  advanceTurn();
}

function advanceTurn() {
  const activePlayers = state.players.filter(p => !p.hasFinished);
  const activeCount = activePlayers.length;

  if (activeCount === 0 || (activeCount === 1 && state.players.length > 1)) {
    const lastActive = state.players.find(p => !p.hasFinished);
    if (lastActive) {
      const nextRank = state.players.filter(p => p.hasFinished).length + 1;
      lastActive.hasFinished = true;
      lastActive.finishedRank = nextRank;
    }
    showFinalRankings();
    return;
  }

  let nextIdx = state.currentPlayerIndex;
  do {
    nextIdx = (nextIdx + 1) % state.players.length;
  } while (state.players[nextIdx].hasFinished);

  state.currentPlayerIndex = nextIdx;
  updateUI();
  setDiceState("idle");
  setDiceIdleTime(0);
  diceResultP.innerText = "";
}

// ── Celebration & Modals Controller ──────────────────────────────────────────
function spawnConfetti() {
  const container = document.querySelector(".confetti-container");
  if (!container) return;
  container.innerHTML = "";
  
  const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width = `${5 + Math.random() * 8}px`;
    piece.style.height = `${10 + Math.random() * 10}px`;
    piece.style.animationDelay = `${Math.random() * 2}s`;
    piece.style.animationDuration = `${1.5 + Math.random() * 1.5}s`;
    container.appendChild(piece);
  }
}

function showWinnerCelebration(player: Player) {
  const winPopup = document.getElementById("winner-popup")!;
  const msgEl = document.getElementById("winner-message")!;
  
  let rankStr = "1st";
  if (player.finishedRank === 2) rankStr = "2nd";
  if (player.finishedRank === 3) rankStr = "3rd";
  if (player.finishedRank === 4) rankStr = "4th";
  
  msgEl.innerText = `${player.name} achieved ${rankStr} Place!`;
  
  winPopup.classList.remove("hidden");
  spawnConfetti();
}

function showFinalRankings() {
  const endPopup = document.getElementById("endgame-popup")!;
  const listEl = document.getElementById("rankings-list")!;
  listEl.innerHTML = "";
  
  const sorted = [...state.players].sort((a, b) => {
    const rA = a.finishedRank || 99;
    const rB = b.finishedRank || 99;
    return rA - rB;
  });
  
  sorted.forEach((p) => {
    let rankStr = "1st";
    if (p.finishedRank === 2) rankStr = "2nd";
    if (p.finishedRank === 3) rankStr = "3rd";
    if (p.finishedRank === 4) rankStr = "4th";
    
    const row = document.createElement("div");
    row.className = `ranking-row rank-${p.finishedRank}`;
    row.innerHTML = `
      <span class="rank-num">${rankStr}</span>
      <div class="player-color-dot" style="background:#${p.color.toString(16).padStart(6, "0")}"></div>
      <span class="player-name">${p.name}</span>
      <span class="rank-tag">Rank ${p.finishedRank}</span>
    `;
    listEl.appendChild(row);
  });
  
  const restartBtn = document.getElementById("btn-endgame-restart") as HTMLButtonElement;
  if (state.mpMode === "client") {
    restartBtn.disabled = true;
    restartBtn.innerText = "Waiting for Host...";
  } else {
    restartBtn.disabled = false;
    restartBtn.innerText = "Play Again";
  }
  
  endPopup.classList.remove("hidden");
}

export function restartGameLocal() {
  const winPopup = document.getElementById("winner-popup")!;
  const endPopup = document.getElementById("endgame-popup")!;
  winPopup.classList.add("hidden");
  endPopup.classList.add("hidden");
  
  state.players.forEach((p) => {
    p.currentTile = 1;
    p.moveQueue = [];
    p.isMoving = false;
    p.currentJump = null;
    p.jumpProgress = 0;
    p.hopProgress = 0;
    
    const ox = (p.id % 2 === 0 ? 1 : -1) * 0.8;
    const oz = (p.id < 2 ? 1 : -1) * 0.8;
    p.mesh.position.set(tilePositions[1].x + ox, tilePositions[1].y, tilePositions[1].z + oz);
    
    p.hasFinished = false;
    p.finishedRank = 0;
  });
  
  state.currentPlayerIndex = 0;
  state.gameStarted = true;
  setDiceState("idle");
  setDiceIdleTime(0);
  
  updateUI();
}

registerMultiplayerRestart(restartGameLocal);

const btnEndgameRestart = document.getElementById("btn-endgame-restart")!;
const btnEndgameClose = document.getElementById("btn-endgame-close")!;

btnEndgameRestart.addEventListener("click", () => {
  if (state.mpMode === "client") return;
  
  if (state.mpMode === "host") {
    console.log("MP LOG: Host clicked restart, broadcasting restart_game...");
    for (const peerId in state.clientConnections) {
      try {
        state.clientConnections[peerId].send({
          type: "restart_game"
        });
      } catch (err) {
        console.error("MP ERROR: Host failed to broadcast restart_game:", err);
      }
    }
  }
  
  restartGameLocal();
});

btnEndgameClose.addEventListener("click", () => {
  const winPopup = document.getElementById("winner-popup")!;
  const endPopup = document.getElementById("endgame-popup")!;
  winPopup.classList.add("hidden");
  endPopup.classList.add("hidden");
  
  leaveLobby();
  updateUI();
});

// ── Auto routing from link ────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const initialRoom = urlParams.get("room");
if (initialRoom) {
  console.log("MP LOG: Routing to Join Screen for room:", initialRoom);
  
  tabOnline.classList.add("active");
  tabLocal.classList.remove("active");
  panelOnline.classList.add("active");
  panelLocal.classList.remove("active");
  
  const setupTabs = document.querySelector(".setup-tabs") as HTMLDivElement;
  if (setupTabs) {
    setupTabs.classList.add("hidden");
  }
  
  onlineMenu.classList.add("hidden");
  onlineJoinSetup.classList.remove("hidden");
  joinRoomIdInput.value = initialRoom;
}

// ── Animation Loop ────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
const HOP_SPEED = 3;
const SLIDE_SPEED = 1.5;

// Pre-allocated reusable vectors for rendering optimization
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
  camera.getWorldPosition(_camPos);
  ladders.forEach((ld) => {
    _toCam.subVectors(_camPos, ld.midPoint);
    const dot = _toCam.dot(ld.axis);
    _projZ.copy(_toCam).addScaledVector(ld.axis, -dot); // Z = camera project
    if (_projZ.lengthSq() < 0.01) return;
    _projZ.normalize();
    _axisX.crossVectors(ld.axis, _projZ).normalize();
    _mat4.makeBasis(_axisX, ld.axis, _projZ);
    ld.group.quaternion.setFromRotationMatrix(_mat4);
  });

  // ── Player movement ──
  if (state.gameStarted && state.players.length > 0) {
    const player = state.players[state.currentPlayerIndex];

    if (player?.isMoving) {
      const ox = (player.id % 2 === 0 ? 1 : -1) * 0.8;
      const oz = (player.id < 2 ? 1 : -1) * 0.8;
      const off = (pos: THREE.Vector3) =>
        new THREE.Vector3(pos.x + ox, pos.y, pos.z + oz);

      if (player.currentJump) {
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

        if (
          JUMPS[player.currentTile] &&
          nextNum === JUMPS[player.currentTile]
        ) {
          player.currentJump = player.currentTile > nextNum ? "slide" : "climb";
          player.jumpProgress = 0;
        } else {
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

  // ── Dice Physics update ──
  updateDicePhysics(delta);

  // Lock dice canvas while player pawn is moving or if it's not our turn
  const isOurTurn = (state.mpMode === "local") || (state.currentPlayerIndex === state.myPlayerIndex);
  const isLocked =
    !state.gameStarted ||
    !isOurTurn ||
    (!!state.players[state.currentPlayerIndex]?.isMoving && diceState !== "flying");
  diceCanvasEl.classList.toggle("locked", isLocked);

  // Render both scenes
  renderer.render(scene, camera);
  diceRenderer.render(diceScene, diceCamera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  const isMobileSize = window.innerWidth <= 768;
  const size = isMobileSize ? 110 : 220;
  diceRenderer.setSize(size, size);
});

// Run animation loop
animate();

// Register Service Worker for PWA installation support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL || "/";
    navigator.serviceWorker
      .register(`${base}sw.js`)
      .then((reg) => {
        console.log("MP LOG: PWA Service Worker registered scope:", reg.scope);
      })
      .catch((err) => {
        console.error("MP ERROR: PWA Service Worker registration failed:", err);
      });
  });
}

// ── Interactive PWA Install Prompt ──
let deferredPrompt: any = null;
const installBtn = document.getElementById("pwa-install-btn") as HTMLButtonElement;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // Only display the button if NOT already running inside the PWA standalone wrapper
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
  if (!isStandalone && installBtn) {
    installBtn.classList.remove("hidden");
  }
});

if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`MP LOG: PWA installation prompt outcome: ${outcome}`);
    deferredPrompt = null;
    installBtn.classList.add("hidden");
  });
}

window.addEventListener("appinstalled", () => {
  console.log("MP LOG: PWA was installed successfully!");
  if (installBtn) {
    installBtn.classList.add("hidden");
  }
  deferredPrompt = null;
});
