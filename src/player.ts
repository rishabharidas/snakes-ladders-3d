import * as THREE from "three";

export class Player {
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
  hasFinished = false;
  finishedRank = 0; // 0: active, 1: 1st, 2: 2nd, etc.

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
