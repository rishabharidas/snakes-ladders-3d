# 🎲 3D Snakes & Ladders - P2P Online Multiplayer

A real-time, serverless 3D Snakes & Ladders board game built with **Three.js (WebGL)**, **TypeScript**, and **PeerJS (WebRTC)**. Players can roll a physics-simulated 3D die, climb ladders, slide down snakes, and play together either locally or online via shareable peer-to-peer room links.

---

## 🌟 Key Features

*   **Stunning 3D Visuals**: Fully interactive 3D board scene with lighting, soft shadows, slithering snakes, bobbing snake heads, and cylindrical billboard ladders that always face the camera viewport.
*   **Physics-Simulated Die**: A 3D die that responds to click-and-drag flicks or quick taps with realistic gravity, bouncing, wall boundaries, and damping forces.
*   **P2P Online Multiplayer**: Zero server costs! Connect directly browser-to-browser with up to 4 players using **WebRTC Data Channels (via PeerJS)**.
*   **Optimized Low-Latency Roll Syncing**: Dice rolls are pre-generated and broadcasted instantly upon throw release, prompting all connected peers to simulate the physical roll concurrently and snap to the same number within a snappy **1.2-second limit**.
*   **Dedicated Room Routing**: Hosts can copy a room invitation link (`?room=ROOM_ID`) that automatically drops joining guests straight into the correct lobby.
*   **Graceful Disconnect Recovery**: Connection listeners watch for dropouts and alert players if a connection is severed during active gameplay.
*   **Modular Architecture**: Re-engineered with a clean separation of concerns for components, rendering engines, and network layers.

---

## 📂 Codebase Architecture

The project has been separated into clean modules for scalability and readability:

```text
src/
├── constants.ts     # Game metrics (sizes, color tokens, normals, jumps)
├── state.ts         # Shared global state context (Peer connection records, turn state)
├── player.ts        # Player pawn constructors and Three.js geometry shapes
├── board.ts         # Main Three.js board scene rendering, camera, lighting, and grid layouts
├── dice.ts          # Dice physics engine, canvas canvas textures, and interaction hooks
├── multiplayer.ts   # PeerJS WebRTC signaling, network packets, and lobby sync
└── main.ts          # Orchestrator, entry point, DOM click listeners, and clock loops
```

---

## 🛠️ Tech Stack

*   **Core**: HTML5, CSS3 (Vanilla), TypeScript
*   **3D Graphics**: Three.js (WebGL)
*   **Orbit Controls**: OrbitControls (Camera tracking)
*   **Real-time Communication**: PeerJS (WebRTC wrapper)
*   **Bundler & Dev Server**: Vite

---

## 🚀 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) and your preferred package manager (e.g. `pnpm`, `npm`, or `yarn`) installed.

### Installation

1. Clone or open the project folder.
2. Install the required dependencies:
   ```bash
   pnpm install
   # or npm install
   ```

### Running Locally

1. Launch the development server:
   ```bash
   pnpm run dev
   # or npm run dev
   ```
2. Open the URL printed in the terminal (usually `http://localhost:5173/`).

### Production Build

To build the static assets for deployment:
```bash
pnpm run build
# or npm run build
```
The output directory will be `dist/`.

---

## 🎮 How to Play

### Local Play
1. Enter the player names in the **Local Play** panel.
2. Click **Start Game**.
3. Take turns clicking, holding, and flicking the dice canvas in the bottom-left corner!

### Online Multiplayer (Host & Guest)
1. Navigate to the **Online Play** tab.
2. **Host a Game**:
   - Select **Host a New Game**, enter your name, and click **Create Lobby**.
   - Copy the room invitation link or share the **Room Code** with other players.
3. **Join a Game**:
   - Navigate to the invitation link directly, or select **Join with Room Code** to enter a room ID.
   - Enter your name and click **Join**.
4. Once all players are connected in the Host's lobby, the Host can click **Start Game** to launch the 3D board scene!
