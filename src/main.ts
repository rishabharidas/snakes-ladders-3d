import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Game Configuration
const TILE_SIZE = 4;
const BOARD_SIZE = 10;
const TOTAL_TILES = BOARD_SIZE * BOARD_SIZE;

// Snakes and Ladders Mapping
const JUMPS: Record<number, number> = {
    // Ladders (Start -> End)
    4: 14,
    9: 31,
    20: 38,
    28: 84,
    40: 59,
    51: 67,
    63: 81,
    71: 91,
    // Snakes (Start -> End)
    17: 7,
    54: 34,
    62: 19,
    64: 60,
    87: 24,
    93: 73,
    95: 75,
    99: 78
};

// Player Class & Multiplayer State
class Player {
    id: number;
    name: string;
    color: number;
    mesh: THREE.Mesh;
    currentTile: number = 1;
    moveQueue: number[] = [];
    isMoving: boolean = false;
    currentJump: 'climb' | 'slide' | null = null;
    jumpProgress: number = 0;
    targetPosition: THREE.Vector3 = new THREE.Vector3();
    hopProgress: number = 0;
    startHopPosition: THREE.Vector3 = new THREE.Vector3();

    constructor(id: number, name: string, color: number, scene: THREE.Scene, startPos: THREE.Vector3) {
        this.id = id;
        this.name = name;
        this.color = color;
        
        // Pawn shape (Cone + Sphere)
        const geometry = new THREE.Group();
        const bodyGeo = new THREE.ConeGeometry(0.6, 1.5, 16);
        const headGeo = new THREE.SphereGeometry(0.5, 16, 16);
        const material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3, metalness: 0.2 });
        
        const body = new THREE.Mesh(bodyGeo, material);
        body.position.y = 0.75;
        body.castShadow = true;
        
        const head = new THREE.Mesh(headGeo, material);
        head.position.y = 1.7;
        head.castShadow = true;
        
        geometry.add(body, head);
        
        this.mesh = geometry as any; // treating group as mesh for simplicity in position
        this.mesh.position.copy(startPos);
        // Offset slightly based on id so they don't overlap completely on the same tile
        const offsetX = (id % 2 === 0 ? 1 : -1) * 0.8;
        const offsetZ = (id < 2 ? 1 : -1) * 0.8;
        this.mesh.position.x += offsetX;
        this.mesh.position.z += offsetZ;
        
        scene.add(this.mesh);
    }
}

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1e293b); // Slate background

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
// Angle camera down
camera.position.set(0, 40, 40);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas') as HTMLCanvasElement, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(20, 50, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 4096;
dirLight.shadow.mapSize.height = 4096;
const d = 25;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
scene.add(dirLight);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.1; // Don't go below ground
controls.minDistance = 10;
controls.maxDistance = 100;

// Board Generation (Flat 10x10)
const tilePositions: THREE.Vector3[] = [new THREE.Vector3()]; // 1-indexed
const boardGroup = new THREE.Group();
scene.add(boardGroup);

const tileGeometry = new THREE.BoxGeometry(TILE_SIZE * 0.95, 0.5, TILE_SIZE * 0.95);
const materialEven = new THREE.MeshStandardMaterial({ color: 0x4f46e5 });
const materialOdd = new THREE.MeshStandardMaterial({ color: 0x34d399 });

for (let i = 0; i < TOTAL_TILES; i++) {
    const tileNumber = i + 1;
    const row = Math.floor(i / BOARD_SIZE);
    let col = i % BOARD_SIZE;
    
    // Boustrophedon path
    if (row % 2 !== 0) col = BOARD_SIZE - 1 - col;
    
    const x = (col - BOARD_SIZE / 2 + 0.5) * TILE_SIZE;
    const z = (BOARD_SIZE / 2 - row - 0.5) * TILE_SIZE; 
    
    const tile = new THREE.Mesh(tileGeometry, tileNumber % 2 === 0 ? materialEven : materialOdd);
    tile.position.set(x, 0, z);
    tile.receiveShadow = true;
    
    // Number text
    const canvasText = document.createElement('canvas');
    canvasText.width = 128;
    canvasText.height = 128;
    const context = canvasText.getContext('2d')!;
    context.fillStyle = 'white';
    context.font = 'bold 64px Outfit, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(tileNumber.toString(), 64, 64);
    
    const textTexture = new THREE.CanvasTexture(canvasText);
    const textMaterial = new THREE.MeshBasicMaterial({ map: textTexture, transparent: true, opacity: 0.8 });
    const textPlane = new THREE.Mesh(new THREE.PlaneGeometry(TILE_SIZE * 0.5, TILE_SIZE * 0.5), textMaterial);
    textPlane.rotation.x = -Math.PI / 2;
    textPlane.position.set(0, 0.26, 0);
    tile.add(textPlane);
    
    boardGroup.add(tile);
    tilePositions[tileNumber] = new THREE.Vector3(x, 0.25, z);
}

// Generate 3D Snakes and Ladders
const ladderMaterial = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8, metalness: 0.1 }); // Wood color
const snakeSkinMaterial = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.5 }); // Green snake
const snakeBellyMaterial = new THREE.MeshStandardMaterial({ color: 0xdcfce7, roughness: 0.5 }); // Light green belly
const eyeWhiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const eyeBlackMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
const tongueMaterial = new THREE.MeshBasicMaterial({ color: 0xef4444 });

const snakePaths: Record<number, THREE.CatmullRomCurve3> = {};
const snakeHeads: {mesh: THREE.Group, baseRotation: THREE.Euler}[] = [];
const snakeBodySegments: {mesh: THREE.Mesh, basePos: THREE.Vector3, side: THREE.Vector3, t: number, length: number}[] = [];

function createTextSprite(text: string, color: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = color;
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(3, 0.75, 1);
    return sprite;
}

for (const [startStr, endStr] of Object.entries(JUMPS)) {
    const start = parseInt(startStr);
    const end = parseInt(endStr);
    const startPos = tilePositions[start];
    const endPos = tilePositions[end];
    
    if (start < end) {
        // Real Ladder (Two side rails + rungs)
        const distance = startPos.distanceTo(endPos);
        const ladderGroup = new THREE.Group();
        
        // Side rails
        const railGeo = new THREE.CylinderGeometry(0.15, 0.15, distance, 8);
        const leftRail = new THREE.Mesh(railGeo, ladderMaterial);
        leftRail.position.x = -0.4;
        const rightRail = new THREE.Mesh(railGeo, ladderMaterial);
        rightRail.position.x = 0.4;
        ladderGroup.add(leftRail, rightRail);
        
        // Rungs
        const rungsCount = Math.floor(distance * 1.2);
        const rungGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8);
        for(let i=1; i<rungsCount; i++) {
             const rung = new THREE.Mesh(rungGeo, ladderMaterial);
             rung.position.y = -distance/2 + (distance * (i/rungsCount));
             rung.rotation.z = Math.PI/2;
             ladderGroup.add(rung);
        }
        
        // Position and orient the whole ladder
        const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
        midPoint.y += 0.5;
        ladderGroup.position.copy(midPoint);
        
        ladderGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), endPos.clone().sub(startPos).normalize());
        ladderGroup.rotateX(Math.PI/2); // lie flat along the path
        
        ladderGroup.castShadow = true;
        boardGroup.add(ladderGroup);

        // Destination Text Label
        const textSprite = createTextSprite(`Ladder to ${end}`, '#fef08a');
        textSprite.position.copy(startPos);
        textSprite.position.y += 1.5;
        boardGroup.add(textSprite);
        
    } else {
        // Realistic Curvy Snake
        const numPoints = 6;
        const points = [];
        
        // Direction vector from start to end
        const dir = new THREE.Vector3().subVectors(endPos, startPos);
        const length = dir.length();
        dir.normalize();
        
        // Orthogonal vector for the S-curves (cross product with UP)
        const up = new THREE.Vector3(0, 1, 0);
        const side = new THREE.Vector3().crossVectors(dir, up).normalize();
        
        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const pt = new THREE.Vector3().lerpVectors(startPos, endPos, t);
            
            // Add arc for Y so it doesn't clip through the board
            pt.y += Math.sin(t * Math.PI) * (length * 0.2);
            points.push(pt);
        }
        
        const curve = new THREE.CatmullRomCurve3(points);
        snakePaths[start] = curve;
        
        const snakeGroup = new THREE.Group();
        
        // Organic Tapered Body (Chain of spheres)
        const numSegments = Math.floor(length * 4); // density of spheres
        for (let i = 0; i <= numSegments; i++) {
            const t = i / numSegments;
            const pt = curve.getPoint(t);
            
            // Taper radius towards tail (t=1 is tail)
            let radius = 0.45; // Start quite thick at the neck
            if (t > 0.3) {
                // Smoothly taper down from 0.45 to 0.05
                radius = 0.45 - ((t - 0.3) / 0.7) * 0.4;
            }
            
            // Alternate colors for a banded cartoon snake look
            const mat = (i % 3 === 0) ? snakeBellyMaterial : snakeSkinMaterial;
            const segment = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 12), mat);
            segment.position.copy(pt);
            segment.castShadow = true;
            snakeGroup.add(segment);
            
            snakeBodySegments.push({mesh: segment, basePos: pt.clone(), side: side, t: t, length: length});
        }
        
        // Snake Head
        const headGroup = new THREE.Group();
        
        // Position head at the very start of the curve, seamlessly connecting
        const headPos = curve.getPoint(0);
        headGroup.position.copy(headPos);
        
        // Point head towards the next point in the curve, but slightly up
        const lookTarget = curve.getPoint(0.05);
        lookTarget.y = headPos.y + 0.5; // Look up
        headGroup.lookAt(lookTarget);
        
        // Store base rotation for emotional animation
        snakeHeads.push({mesh: headGroup, baseRotation: headGroup.rotation.clone()});
        
        // Head shape
        const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16), snakeSkinMaterial);
        headMesh.scale.set(1, 0.7, 1.2);
        headGroup.add(headMesh);
        
        // Snout
        const snoutMesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), snakeBellyMaterial);
        snoutMesh.position.set(0, -0.2, 0.3);
        snoutMesh.scale.set(1.2, 0.5, 1);
        headGroup.add(snoutMesh);
        
        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const pupilGeo = new THREE.SphereGeometry(0.08, 8, 8);
        
        const leftEye = new THREE.Mesh(eyeGeo, eyeWhiteMaterial);
        leftEye.position.set(-0.3, 0.3, 0.3);
        const leftPupil = new THREE.Mesh(pupilGeo, eyeBlackMaterial);
        leftPupil.position.set(-0.3, 0.35, 0.42);
        
        const rightEye = new THREE.Mesh(eyeGeo, eyeWhiteMaterial);
        rightEye.position.set(0.3, 0.3, 0.3);
        const rightPupil = new THREE.Mesh(pupilGeo, eyeBlackMaterial);
        rightPupil.position.set(0.3, 0.35, 0.42);
        
        headGroup.add(leftEye, leftPupil, rightEye, rightPupil);
        
        // Tongue (forked)
        const tongueGeo = new THREE.PlaneGeometry(0.2, 0.6);
        const tongue = new THREE.Mesh(tongueGeo, tongueMaterial);
        tongue.position.set(0, -0.1, 0.8);
        tongue.rotation.x = Math.PI / 2;
        headGroup.add(tongue);
        
        snakeGroup.add(headGroup);
        boardGroup.add(snakeGroup);

        // Destination Text Label
        const textSprite = createTextSprite(`Snake to ${end}`, '#fca5a5');
        textSprite.position.copy(startPos);
        textSprite.position.y += 2.0; // hover a bit higher to clear snake head
        boardGroup.add(textSprite);
    }
}

// Multiplayer Setup
const playersData = [
    { name: "Player 1", color: 0xef4444 }, // Red
    { name: "Player 2", color: 0x3b82f6 }, // Blue
    { name: "Player 3", color: 0x22c55e }, // Green
    { name: "Player 4", color: 0xeab308 }  // Yellow
];

const players = playersData.map((data, i) => new Player(i, data.name, data.color, scene, tilePositions[1]));
let currentPlayerIndex = 0;

// UI Elements
const playersListDiv = document.getElementById('players-list')!;
const turnIndicator = document.getElementById('turn-indicator')!;
const rollButton = document.getElementById('roll-button') as HTMLButtonElement;
const diceResultP = document.getElementById('dice-result')!;

function updateUI() {
    playersListDiv.innerHTML = '';
    players.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = `player-item ${i === currentPlayerIndex ? 'active' : ''}`;
        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div class="player-color-box" style="background-color: #${p.color.toString(16).padStart(6, '0')}"></div>
                <span>${p.name}</span>
            </div>
            <span>Tile ${p.currentTile}</span>
        `;
        playersListDiv.appendChild(div);
    });
    
    turnIndicator.innerText = `${players[currentPlayerIndex].name}'s Turn`;
    turnIndicator.style.color = `#${players[currentPlayerIndex].color.toString(16).padStart(6, '0')}`;
}

updateUI();

function rollDice() {
    const player = players[currentPlayerIndex];
    if (player.isMoving || player.currentTile >= TOTAL_TILES) return;
    
    rollButton.disabled = true;
    
    const roll = Math.floor(Math.random() * 6) + 1;
    diceResultP.innerText = `Rolled a ${roll}!`;
    
    let nextTile = player.currentTile + roll;
    if (nextTile > TOTAL_TILES) {
        nextTile = TOTAL_TILES;
    }
    
    for (let i = player.currentTile + 1; i <= nextTile; i++) {
        player.moveQueue.push(i);
    }
    
    player.isMoving = true;
}

rollButton.addEventListener('click', rollDice);

// Animation Loop
const clock = new THREE.Clock();
const HOP_SPEED = 3;
const SLIDE_SPEED = 1.5;

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    controls.update();

    const time = Date.now() * 0.005;

    // Animate snake body (dynamic slithering)
    snakeBodySegments.forEach(sb => {
        // traveling sine wave along the body
        const wobble = Math.sin(time - sb.t * 20) * (sb.length * 0.05);
        sb.mesh.position.copy(sb.basePos).addScaledVector(sb.side, wobble);
    });

    // Emotional snake head animation (bobbing and looking around)
    snakeHeads.forEach((sh, index) => {
        // Slight bobbing
        sh.mesh.position.y += Math.sin(time + index) * 0.002;
        
        // Rotate head back and forth slightly
        sh.mesh.rotation.x = sh.baseRotation.x + Math.sin(time * 0.5 + index) * 0.1;
        sh.mesh.rotation.y = sh.baseRotation.y + Math.sin(time * 0.8 + index) * 0.15;
    });
    
    const player = players[currentPlayerIndex];
    
    if (player && player.isMoving) {
        // Player offset calculation
        const offsetX = (player.id % 2 === 0 ? 1 : -1) * 0.8;
        const offsetZ = (player.id < 2 ? 1 : -1) * 0.8;
        const getOffsetPos = (pos: THREE.Vector3) => new THREE.Vector3(pos.x + offsetX, pos.y, pos.z + offsetZ);
        
        if (player.currentJump) {
            // Climbing ladder or sliding snake
            player.jumpProgress += delta * SLIDE_SPEED;
            if (player.jumpProgress >= 1.0) {
                player.currentTile = player.moveQueue.shift()!;
                player.mesh.position.copy(getOffsetPos(tilePositions[player.currentTile]));
                player.currentJump = null;
                player.jumpProgress = 0;
                
                checkTurnEnd(player);
            } else {
                if (player.currentJump === 'slide') {
                    const curve = snakePaths[player.currentTile]; // start tile of snake
                    if (curve) {
                        const pt = curve.getPoint(player.jumpProgress);
                        player.mesh.position.copy(getOffsetPos(pt));
                    }
                } else {
                    const startPos = getOffsetPos(tilePositions[player.currentTile]);
                    player.mesh.position.lerpVectors(startPos, player.targetPosition, player.jumpProgress);
                }
            }
        } else if (player.moveQueue.length > 0) {
            const nextTileNumber = player.moveQueue[0];
            player.targetPosition.copy(getOffsetPos(tilePositions[nextTileNumber]));
            
            // Check if jumping
            if (JUMPS[player.currentTile] && nextTileNumber === JUMPS[player.currentTile]) {
                player.currentJump = player.currentTile > nextTileNumber ? 'slide' : 'climb';
                player.jumpProgress = 0;
                return;
            }
            
            // Hopping animation between adjacent tiles
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
                // Linear lerp + sine wave for Y to arc the hop
                player.mesh.position.lerpVectors(player.startHopPosition, player.targetPosition, player.hopProgress);
                player.mesh.position.y += Math.sin(player.hopProgress * Math.PI) * 2;
            }
        }
    }
    
    renderer.render(scene, camera);
}

function checkTurnEnd(player: Player) {
    updateUI();
    if (player.currentTile === TOTAL_TILES) {
        diceResultP.innerText = `${player.name} Wins!`;
        player.isMoving = false;
        return; // Game over
    }
    
    player.isMoving = false;
    // Next player
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    updateUI();
    rollButton.disabled = false;
    diceResultP.innerText = '';
}

// Window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
