import { Peer, type DataConnection } from "peerjs";
import type { Player } from "./player";

export type MPMode = "local" | "host" | "client";

export const state = {
  mpMode: "local" as MPMode,
  gameStarted: false,
  players: [] as Player[],
  currentPlayerIndex: 0,
  myPlayerIndex: -1,

  // PeerJS / Network Context
  peer: null as Peer | null,
  myPeerId: "",
  currentRoomId: "",

  // Host state
  clientConnections: {} as Record<string, DataConnection>,
  clientNames: {} as Record<string, string>,
  hostName: "Host Player",

  // Client state
  hostConnection: null as DataConnection | null,

  // Sync state
  remoteTargetValue: null as number | null,

  // Audio state
  isMuted: false,
};
