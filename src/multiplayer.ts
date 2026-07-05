import { Peer } from "peerjs";
import { Player } from "./player";
import { PLAYER_COLORS, PLAYER_COLORS_CSS } from "./constants";
import { state } from "./state";
import { scene, tilePositions } from "./board";
import { triggerRemoteRoll } from "./dice";

// DOM element references needed for multiplayer UI
const onlineMenu = document.getElementById("online-menu")!;
const onlineHostSetup = document.getElementById("online-host-setup")!;
const onlineJoinSetup = document.getElementById("online-join-setup")!;
const onlineLobby = document.getElementById("online-lobby")!;
const lobbyPlayersList = document.getElementById("lobby-players-list")!;
const lobbyCount = document.getElementById("lobby-count")!;
const btnStartOnlineGame = document.getElementById("btn-start-online-game") as HTMLButtonElement;
const setupScreen = document.getElementById("setup-screen")!;

// Callback for UI updates
let updateUICallback: (() => void) | null = null;
export function registerMultiplayerUIUpdate(cb: () => void) {
  updateUICallback = cb;
}

let restartGameCallback: (() => void) | null = null;
export function registerMultiplayerRestart(cb: () => void) {
  restartGameCallback = cb;
}

export function generateRoomId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function updateHostLobby() {
  lobbyPlayersList.innerHTML = "";
  
  // Host row
  const hostRow = document.createElement("div");
  hostRow.className = "lobby-player-row is-you";
  hostRow.innerHTML = `
    <div class="player-color-dot" style="background:${PLAYER_COLORS_CSS[0]}"></div>
    <span>${state.hostName}</span>
  `;
  lobbyPlayersList.appendChild(hostRow);
  
  // Client rows
  let idx = 1;
  for (const peerId in state.clientConnections) {
    const clientName = state.clientNames[peerId] || "Guest";
    const clientRow = document.createElement("div");
    clientRow.className = "lobby-player-row";
    clientRow.innerHTML = `
      <div class="player-color-dot" style="background:${PLAYER_COLORS_CSS[idx] || "#ffffff"}"></div>
      <span>${clientName}</span>
    `;
    lobbyPlayersList.appendChild(clientRow);
    idx++;
  }
  
  const totalCount = 1 + Object.keys(state.clientConnections).length;
  lobbyCount.innerText = String(totalCount);
  
  if (totalCount >= 2) {
    btnStartOnlineGame.disabled = false;
    btnStartOnlineGame.innerText = "Start Game →";
  } else {
    btnStartOnlineGame.disabled = true;
    btnStartOnlineGame.innerText = "Waiting for players...";
  }
}

export function broadcastLobby() {
  const playersData = [
    { peerId: state.myPeerId, name: state.hostName, color: PLAYER_COLORS_CSS[0] }
  ];
  let idx = 1;
  for (const peerId in state.clientConnections) {
    playersData.push({
      peerId: peerId,
      name: state.clientNames[peerId] || "Guest",
      color: PLAYER_COLORS_CSS[idx] || "#ffffff"
    });
    idx++;
  }
  
  console.log("MP LOG: Host broadcasting lobby_update. Players =", playersData);
  for (const peerId in state.clientConnections) {
    try {
      state.clientConnections[peerId].send({
        type: "lobby_update",
        players: playersData
      });
    } catch (err) {
      console.error("MP ERROR: Host failed to send lobby_update to client", peerId, err);
    }
  }
  
  updateHostLobby();
}

export function handleLobbyUpdate(playersList: { peerId: string, name: string, color: string }[]) {
  lobbyPlayersList.innerHTML = "";
  playersList.forEach((p) => {
    const isMe = p.peerId === state.myPeerId;
    const row = document.createElement("div");
    row.className = `lobby-player-row${isMe ? " is-you" : ""}`;
    row.innerHTML = `
      <div class="player-color-dot" style="background:${p.color}"></div>
      <span>${p.name}</span>
    `;
    lobbyPlayersList.appendChild(row);
  });
  
  lobbyCount.innerText = String(playersList.length);
}

export function leaveLobby() {
  if (state.peer) {
    state.peer.destroy();
    state.peer = null;
  }
  state.hostConnection = null;
  state.clientConnections = {};
  state.clientNames = {};
  state.mpMode = "local";
  state.myPlayerIndex = -1;
  
  // Clean up existing players from the scene
  state.players.forEach((p) => scene.remove(p.mesh));
  state.players = [];
  state.gameStarted = false;

  onlineLobby.classList.add("hidden");
  onlineHostSetup.classList.add("hidden");
  onlineJoinSetup.classList.add("hidden");
  onlineMenu.classList.remove("hidden");

  // Hide celebration popups
  const winPopup = document.getElementById("winner-popup");
  const endPopup = document.getElementById("endgame-popup");
  if (winPopup) winPopup.classList.add("hidden");
  if (endPopup) endPopup.classList.add("hidden");
  
  const url = new URL(window.location.href);
  url.searchParams.delete("room");
  window.history.replaceState({}, document.title, url.pathname);

  // Restore tabs switcher in case it was hidden by ?room query param
  const setupTabs = document.querySelector(".setup-tabs") as HTMLDivElement;
  if (setupTabs) {
    setupTabs.classList.remove("hidden");
  }

  // Show setup screen again
  setupScreen.classList.remove("hidden");
}

export function startOnlineGame(playersData: { peerId: string, name: string }[]) {
  // Clean up any existing players from the scene
  state.players.forEach((p) => scene.remove(p.mesh));

  state.players = playersData.map(
    (pd, i) => new Player(i, pd.name, PLAYER_COLORS[i], scene, tilePositions[1])
  );
  
  setupScreen.classList.add("hidden");
  state.gameStarted = true;
  if (updateUICallback) {
    updateUICallback();
  }
}

export function setupHostPeer(roomId: string, name: string) {
  state.hostName = name;
  state.mpMode = "host";
  state.currentRoomId = roomId;

  const loader = document.getElementById("connection-loader");
  if (loader) loader.classList.remove("hidden");

  state.peer = new Peer(`sl3d-${roomId}`);

  state.peer.on("open", (id) => {
    const loader = document.getElementById("connection-loader");
    if (loader) loader.classList.add("hidden");
    state.myPeerId = id;
    state.myPlayerIndex = 0;
    updateHostLobby();
  });

  state.peer.on("error", (err: any) => {
    const loader = document.getElementById("connection-loader");
    if (loader) loader.classList.add("hidden");
    console.error("PeerJS host error:", err);
    if (err.type === "unavailable-id") {
      alert("Lobby creation failed: Room code is already in use. Please try hosting again.");
      leaveLobby();
    } else {
      console.log("MP LOG: Non-fatal host peer error. Reconnecting to signaling server...");
      if (state.peer && state.peer.disconnected) {
        state.peer.reconnect();
      }
    }
  });

  state.peer.on("disconnected", () => {
    console.log("MP LOG: Host peer disconnected from signaling server. Reconnecting...");
    if (state.peer && !state.peer.destroyed) {
      state.peer.reconnect();
    }
  });

  state.peer.on("connection", (conn) => {
    console.log("MP LOG: Host received connection from peer:", conn.peer);
    
    conn.on("open", () => {
      console.log("MP LOG: Host connection open with peer:", conn.peer);
    });
    
    conn.on("data", (data: any) => {
      if (!data || typeof data !== "object") return;
      
      console.log("MP LOG: Host received data from", conn.peer, data);
      
      if (data.type === "join") {
        if (Object.keys(state.clientConnections).length >= 3) {
          try {
            conn.send({ type: "error", message: "Lobby is full" });
          } catch (e) {}
          conn.close();
          return;
        }
        state.clientNames[conn.peer] = data.name || "Guest";
        state.clientConnections[conn.peer] = conn;
        broadcastLobby();
      } else if (data.type === "roll_dice") {
        const value = data.value;
        console.log("MP LOG: Host received roll_dice from", conn.peer, "value =", value);
        
        // Broadcast to other clients
        for (const peerId in state.clientConnections) {
          if (peerId !== conn.peer) {
            try {
              state.clientConnections[peerId].send({
                type: "sync_roll",
                currentPlayerIndex: state.currentPlayerIndex,
                value: value
              });
            } catch (err) {
              console.error("MP ERROR: Host failed to forward sync_roll to client", peerId, err);
            }
          }
        }
        
        // Roll locally on host
        triggerRemoteRoll(value);
      }
    });
    
    conn.on("close", () => {
      console.log("MP LOG: Host connection closed by peer:", conn.peer);
      delete state.clientConnections[conn.peer];
      delete state.clientNames[conn.peer];
      broadcastLobby();
      if (state.gameStarted) {
        alert("A player disconnected. Returning to lobby.");
        leaveLobby();
      }
    });
    
    conn.on("error", (err) => {
      console.error("MP ERROR: Host connection error on peer", conn.peer, err);
      delete state.clientConnections[conn.peer];
      delete state.clientNames[conn.peer];
      broadcastLobby();
      if (state.gameStarted) {
        alert("A connection error occurred with a player. Returning to lobby.");
        leaveLobby();
      }
    });
  });
}

export function setupClientPeer(roomId: string, name: string) {
  state.mpMode = "client";
  state.currentRoomId = roomId;

  const loader = document.getElementById("connection-loader");
  if (loader) loader.classList.remove("hidden");

  state.peer = new Peer();

  state.peer.on("open", (id) => {
    state.myPeerId = id;
    
    console.log("MP LOG: Client connecting to host: sl3d-" + roomId);
    state.hostConnection = state.peer!.connect(`sl3d-${roomId}`);
    
    state.hostConnection.on("open", () => {
      console.log("MP LOG: Client hostConnection open. Sending join name =", name);
      try {
        state.hostConnection!.send({
          type: "join",
          name: name
        });
      } catch (err) {
        console.error("MP ERROR: Client failed to send join message:", err);
      }
    });
    
    state.hostConnection.on("data", (data: any) => {
      if (!data || typeof data !== "object") return;
      
      console.log("MP LOG: Client received data from Host:", data);
      
      if (data.type === "lobby_update") {
        const loader = document.getElementById("connection-loader");
        if (loader) loader.classList.add("hidden");
        handleLobbyUpdate(data.players);
      } else if (data.type === "start_game") {
        const playersData = data.players;
        state.myPlayerIndex = playersData.findIndex((pd: any) => pd.peerId === state.myPeerId);
        console.log("MP LOG: Client starting game. myPlayerIndex =", state.myPlayerIndex);
        startOnlineGame(playersData);
      } else if (data.type === "sync_roll") {
        if (data.currentPlayerIndex !== state.myPlayerIndex) {
          console.log("MP LOG: Client received sync_roll from remote player. Value =", data.value);
          triggerRemoteRoll(data.value);
        } else {
          console.log("MP LOG: Client ignoring sync_roll because it is ours.");
        }
      } else if (data.type === "restart_game") {
        console.log("MP LOG: Client received restart_game from Host.");
        if (restartGameCallback) {
          restartGameCallback();
        }
      } else if (data.type === "error") {
        alert(data.message);
        leaveLobby();
      }
    });
    
    state.hostConnection.on("close", () => {
      const loader = document.getElementById("connection-loader");
      if (loader) loader.classList.add("hidden");
      console.log("MP LOG: Client hostConnection closed.");
      alert("Lost connection to host.");
      leaveLobby();
    });
    
    state.hostConnection.on("error", (err) => {
      const loader = document.getElementById("connection-loader");
      if (loader) loader.classList.add("hidden");
      console.error("MP ERROR: Client hostConnection error:", err);
      alert("Connection error: " + err.message);
      leaveLobby();
    });
  });
  
  state.peer.on("error", (err: any) => {
    const loader = document.getElementById("connection-loader");
    if (loader) loader.classList.add("hidden");
    console.error("PeerJS client error:", err);
    if (err.type === "peer-unavailable") {
      alert("Connection failed: Room does not exist or has inactive host.");
      leaveLobby();
    } else {
      console.log("MP LOG: Non-fatal client peer error. Reconnecting...");
      if (state.peer && state.peer.disconnected) {
        state.peer.reconnect();
      }
    }
  });

  state.peer.on("disconnected", () => {
    console.log("MP LOG: Client peer disconnected from signaling server. Reconnecting...");
    if (state.peer && !state.peer.destroyed) {
      state.peer.reconnect();
    }
  });
}

// Auto-reconnect when browser tab becomes active/visible again
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    console.log("MP LOG: Document visibility restored. Inspecting PeerJS state...");
    if (state.peer && state.peer.disconnected && !state.peer.destroyed) {
      console.log("MP LOG: Peer is disconnected. Triggering reconnect...");
      state.peer.reconnect();
    }
  }
});
