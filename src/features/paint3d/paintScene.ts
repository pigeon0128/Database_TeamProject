// 3D 색칠하기 엔진 (three.js). 화면에 캐릭터를 띄우고, 돌려 보기와 스프레이 칠하기를 처리한다.
// 색은 모양의 꼭짓점마다 저장한다: 스프레이가 닿은 점 둘레의 꼭짓점들이 가운데일수록 진하게, 조금씩 얼룩지며 칠해진다.
// 캐릭터는 부위(뿔·몸통·팔·다리)별로 나뉘어 있고, 한 번 누른 채 칠하는 동안에는 처음 닿은 부위에만 색이 묻는다.
// 화면(React)과는 PaintScene 클래스의 메서드와 onChange 콜백으로만 주고받는다.
import * as THREE from "three";
import { FreeOrbitControls as OrbitControls } from "./freeOrbitControls";
import { BASE_COLOR, createMascot, type ModelId, type MascotModel } from "./mascotModel";
import { serializeForRoom } from "./roomExport";

export type ViewDirection = "front" | "back" | "left" | "right" | "top" | "bottom";

export type PaintMode = "spray" | "fill" | "rotate";

export type PaintState = {
  canUndo: boolean;
  /** 한 번이라도 칠한 흔적이 있는지 (저장 버튼 등) */
  painted: boolean;
  /** 지금 칠할(칠하는) 부위 이름. 캐릭터 밖이면 null */
  part: string | null;
};

/** 칠할 수 있는 모양 하나의 캐시: 세계 좌표의 꼭짓점 위치·방향과 색 버퍼 */
type PaintTarget = {
  mesh: THREE.Mesh;
  positions: Float32Array;
  normals: Float32Array;
  colors: THREE.BufferAttribute;
  bounds: THREE.Sphere;
  normalMatrix: THREE.Matrix3;
};

/** 포인터가 가리키는 캐릭터 표면: 부위, 닿은 점, 바깥 방향 */
type Hit = { target: PaintTarget; point: THREE.Vector3; normal: THREE.Vector3 };

type Snapshot ={ colors: Float32Array[]; painted: boolean };

/** 1초 동안 같은 곳을 뿌렸을 때 가운데가 덮이는 정도 */
const SPRAY_FLOW = 6;
/** 포인터가 한 번 움직일 때 더 뿌리는 양 (초 단위로 친 값) */
const MOVE_SPRAY_TIME = 0.04;
/** 되돌리기를 몇 번까지 기억할지 */
const HISTORY_LIMIT = 30;

export class PaintScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private controls: OrbitControls;
  private targets: PaintTarget[];
  private modelId: ModelId = "monster";
  private models = new Map<ModelId, { model: MascotModel; targets: PaintTarget[]; history: Snapshot[]; painted: boolean }>();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerInside = false;
  private cursor: THREE.Mesh;
  private observer: ResizeObserver;
  private frame = 0;
  private lastTime = 0;
  private spinning = false;
  private spinSpeed = 4;
  private spinDirection = 1;
  private spinAxis = new THREE.Vector3(0, 1, 0);
  private turntable = new THREE.Group();

  private mode: PaintMode = "spray";
  private color = new THREE.Color("#1e82dc");
  private radius = 0.22;
  private strength = 1;
  private sprayPointer: number | null = null;
  private touches = new Set<number>();
  private strokeChanged = false;
  /** 이번 획이 칠하고 있는 부위. 획 하나는 처음 닿은 부위만 칠한다 */
  private strokeTarget: PaintTarget | null = null;
  private part: string | null = null;
  private history: Snapshot[] = [];
  private painted = false;

  constructor(
    private container: HTMLElement,
    private onChange: (state: PaintState) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.style.touchAction = "none";
    this.renderer.domElement.style.display = "block";
    container.appendChild(this.renderer.domElement);

    // 빛: 전체를 고르게 밝히는 빛 + 보는 쪽에서 비추는 빛 (어느 방향으로 돌려도 칠하는 면이 밝다)
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#cfe6fa", 1.1));
    const keyLight = new THREE.DirectionalLight("#ffffff", 1.3);
    keyLight.position.set(2, 3, 4);
    this.camera.add(keyLight);
    this.scene.add(this.camera);
    this.camera.position.set(0, 0.4, 6.5);

    const mascot = createMascot();
    this.scene.add(this.turntable);
    this.turntable.add(mascot.group);
    this.targets = mascot.paintables.map((mesh) => this.cacheTarget(mesh));
    this.models.set(this.modelId, { model: mascot, targets: this.targets, history: this.history, painted: false });

    // 스프레이가 닿을 자리를 보여 주는 고리
    this.cursor = new THREE.Mesh(
      new THREE.RingGeometry(0.88, 1, 48),
      new THREE.MeshBasicMaterial({ color: "#363636", transparent: true, opacity: 0.7, depthTest: false, side: THREE.DoubleSide }),
    );
    this.cursor.renderOrder = 1;
    this.cursor.visible = false;
    this.scene.add(this.cursor);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    // 드래그는 카메라가 아니라 캐릭터(turntable)를 화면 기준으로 돌린다 (빙글빙글 뒤에도 손가락 방향 그대로)
    this.controls.object = this.turntable;
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minAzimuthAngle = -Infinity;
    this.controls.maxAzimuthAngle = Infinity;
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 11;
    this.applyMode();

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.handleDown);
    el.addEventListener("pointermove", this.handleMove);
    el.addEventListener("pointerup", this.handleUp);
    el.addEventListener("pointercancel", this.handleUp);
    el.addEventListener("pointerleave", this.handleLeave);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.frame = requestAnimationFrame(this.tick);
  }

  setModel(id: ModelId) {
    if (id === this.modelId) return;
    this.endStroke();
    const previous = this.models.get(this.modelId)!;
    previous.painted = this.painted;
    previous.model.group.visible = false;
    let next = this.models.get(id);
    if (!next) {
      const model = createMascot(id);
      this.turntable.add(model.group);
      this.turntable.updateMatrixWorld(true);
      next = { model, targets: model.paintables.map((mesh) => this.cacheTarget(mesh)), history: [], painted: false };
      this.models.set(id, next);
    }
    next.model.group.visible = true;
    this.modelId = id;
    this.targets = next.targets;
    this.history = next.history;
    this.painted = next.painted;
    this.part = null;
    this.pointerInside = false;
    this.cursor.visible = false;
    this.controls.reset();
    this.emit();
  }

  setMode(mode: PaintMode) {
    this.endStroke();
    this.mode = mode;
    this.applyMode();
  }

  setColor(hex: string) {
    this.color.set(hex);
  }

  /** 스프레이 반지름 (캐릭터 몸 반지름이 1) */
  setRadius(radius: number) {
    this.radius = radius;
  }

  setStrength(strength: number) {
    this.strength = strength;
  }

  setRotationAxis(axis: "x" | "y" | "z") {
    const wasSpinning = this.spinning;
    this.setView("front");
    this.spinning = wasSpinning;
    this.endStroke();
    // 같은 축을 다시 눌러도 이전 회전을 없애고 기본 자세에서 시작한다.
    this.turntable.quaternion.identity();
    this.turntable.updateMatrixWorld(true);
    this.spinDirection = 1;
    this.pointerInside = false;
    this.cursor.visible = false;
    this.spinAxis.set(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0);
  }

  setRotationSpeed(speed: number) {
    this.spinSpeed = speed;
  }

  setAutoRotate(on: boolean) {
    // 시작할 때만 정면으로 맞춘다. 정지할 때 자세와 드래그 관성은 유지한다.
    if (on && !this.spinning) this.setView("front");
    this.spinning = on;
  }

  /** 처음 방향(정면)으로 되돌린다 */
  resetView() {
    this.setView("front");
  }

  setView(view: ViewDirection) {
    this.spinning = false;
    this.endStroke();
    this.turntable.quaternion.identity();
    this.turntable.updateMatrixWorld(true);
    const distance = this.camera.position.distanceTo(this.controls.target);

    this.controls.dispose();
    const directions: Record<ViewDirection, [number, number, number]> = {
      front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0],
      right: [1, 0, 0], top: [0, 1, 0.001], bottom: [0, -1, 0.001],
    };
    // 보기 버튼은 카메라 위치만 바꾼다. 모든 방향에서 드래그 기준은 동일한 월드 Y축이다.
    // 위/아래는 극점의 회전 특이점을 피하도록 아주 조금 기울인다.
    this.camera.up.set(0, 1, 0);
    // 자동 회전은 보기 방향과 무관하게 정면을 기준으로 시작한다.
    this.spinDirection = 1;
    this.camera.position.set(...directions[view]).normalize().multiplyScalar(distance);
    this.camera.lookAt(0, 0, 0);
    // 이전 드래그의 관성만 지우고 동일한 회전 설정으로 다시 구성한다.
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    // 드래그는 카메라가 아니라 캐릭터(turntable)를 화면 기준으로 돌린다 (빙글빙글 뒤에도 손가락 방향 그대로)
    this.controls.object = this.turntable;
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minAzimuthAngle = -Infinity;
    this.controls.maxAzimuthAngle = Infinity;
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 11;
    this.applyMode();
    this.controls.update();
    this.pointerInside = false;
  }

  undo() {
    const snapshot = this.history.pop();
    if (!snapshot) return;
    this.restore(snapshot);
    this.emit();
  }

  /** 모든 색을 지우고 흰색으로 (되돌리기 가능) */
  clear() {
    this.pushHistory();
    const base = new THREE.Color(BASE_COLOR);
    for (const t of this.targets) {
      const arr = t.colors.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) base.toArray(arr, i);
      t.colors.needsUpdate = true;
    }
    this.painted = false;
    this.emit();
  }

  /** 지금 보이는 방향 그대로 PNG data URL로 (고리는 빼고) */
  exportImage() {
    const cursorVisible = this.cursor.visible;
    this.cursor.visible = false;
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL("image/png");
    this.cursor.visible = cursorVisible;
    return url;
  }

  /**
   * 수납함 미리보기용: 사용자가 돌려 둔 각도와 상관없이 오브젝트를 똑바로 정면에서 찍는다 (방에 놓였을 때와 같은 자세).
   * 화면은 잠깐 바꿨다가 그대로 되돌린다.
   */
  exportFrontImage(size = 320) {
    const group = this.models.get(this.modelId)!.model.group;
    const saved = {
      turntable: this.turntable.quaternion.clone(),
      rotation: group.rotation.clone(),
      position: group.position.clone(),
      cursor: this.cursor.visible,
      width: this.renderer.domElement.clientWidth,
      height: this.renderer.domElement.clientHeight,
    };
    // 시안용 비틀림을 빼고 가운데에 맞춘다
    this.turntable.quaternion.identity();
    group.rotation.set(0, 0, 0);
    group.position.set(0, 0, 0);
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    group.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-1);
    group.updateMatrixWorld(true);
    this.cursor.visible = false;
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0.4, 6.5);
    camera.lookAt(0, 0, 0);
    this.renderer.setSize(size, size, false);
    this.renderer.render(this.scene, camera);
    const url = this.renderer.domElement.toDataURL("image/png");
    // 원래대로
    this.turntable.quaternion.copy(saved.turntable);
    group.rotation.copy(saved.rotation);
    group.position.copy(saved.position);
    group.updateMatrixWorld(true);
    this.cursor.visible = saved.cursor;
    this.renderer.setSize(saved.width, saved.height);
    this.renderer.render(this.scene, this.camera);
    return url;
  }

  /** 마이룸 수납함으로 보낼 모양 정보 (지금 선택한 모델) */
  exportRoomObject() {
    return { sourceModel: this.modelId, spec: serializeForRoom(this.models.get(this.modelId)!.model.group) };
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---- 내부 ----

  private cacheTarget(mesh: THREE.Mesh): PaintTarget {
    const geometry = mesh.geometry;
    const pos = geometry.getAttribute("position");
    const nor = geometry.getAttribute("normal");
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const positions = new Float32Array(pos.count * 3);
    const normals = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).toArray(positions, i * 3);
      v.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize().toArray(normals, i * 3);
    }
    geometry.computeBoundingSphere();
    const bounds = geometry.boundingSphere!.clone().applyMatrix4(mesh.matrixWorld);
    return { mesh, positions, normals, colors: geometry.getAttribute("color") as THREE.BufferAttribute, bounds, normalMatrix };
  }

  private applyMode() {
    const spray = this.mode !== "rotate";
    // 왼쪽 클릭은 색칠, 오른쪽 드래그는 모든 도구에서 회전한다.
    this.controls.enabled = true;
    // 스프레이 모드: 왼쪽 버튼(한 손가락)은 칠하기, 오른쪽 버튼(두 손가락)으로 돌리기
    this.controls.mouseButtons = { LEFT: spray ? null : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.touches = { ONE: spray ? null : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.renderer.domElement.style.cursor = spray ? "crosshair" : "grab";
    if (!spray) this.endStroke();
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private updatePointer(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.pointerInside = true;
  }

  private handleDown = (e: PointerEvent) => {
    this.updatePointer(e);
    if (e.pointerType === "touch") {
      this.touches.add(e.pointerId);
      // 두 번째 손가락이 닿으면 칠하기를 멈추고 돌리기로
      if (this.touches.size > 1) {
        this.endStroke();
        return;
      }
    }
    if (this.mode === "fill" && e.button === 0) {
      const hit = this.pick();
      if (!hit) return;
      this.pushHistory();
      const colors = hit.target.colors.array as Float32Array;
      for (let i = 0; i < colors.length; i += 3) this.color.toArray(colors, i);
      hit.target.colors.needsUpdate = true;
      this.painted = true;
      this.part = hit.target.mesh.name;
      this.emit();
      return;
    }
    if (this.mode !== "spray" || e.button !== 0) return;
    this.sprayPointer = e.pointerId;
    this.strokeChanged = false;
    const hit = this.pick();
    this.strokeTarget = hit?.target ?? null;
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.pushHistory();
    // 프레임 사이에 눌렀다 떼는 짧은 클릭도 반드시 한 번 찍는다.
    if (hit) this.sprayHit(hit, 0.12);
  };

  private handleMove = (e: PointerEvent) => {
    if (this.sprayPointer === null || e.pointerId === this.sprayPointer || e.pointerType !== "touch") this.updatePointer(e);
    // 빠르게 문질러도 지나간 자리에 자국이 남도록 움직일 때마다 조금씩 뿌린다
    if (e.pointerId === this.sprayPointer && this.touches.size <= 1) {
      const hit = this.pick();
      if (hit) this.sprayHit(hit, MOVE_SPRAY_TIME);
    }
  };

  private handleUp = (e: PointerEvent) => {
    if (this.renderer.domElement.hasPointerCapture(e.pointerId)) this.renderer.domElement.releasePointerCapture(e.pointerId);
    this.touches.delete(e.pointerId);
    if (e.pointerId === this.sprayPointer) this.endStroke();
    if (e.pointerType === "touch") this.pointerInside = false;
  };

  private handleLeave = (e: PointerEvent) => {
    if (e.pointerId !== this.sprayPointer) this.pointerInside = false;
  };

  private endStroke() {
    if (this.sprayPointer === null) return;
    this.sprayPointer = null;
    this.strokeTarget = null;
    // 아무 데도 칠하지 않았으면 되돌리기 기록을 남기지 않는다
    if (!this.strokeChanged) this.history.pop();
    this.emit();
  }

  private pushHistory() {
    this.history.push({ colors: this.targets.map((t) => (t.colors.array as Float32Array).slice()), painted: this.painted });
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
  }

  private restore(snapshot: Snapshot) {
    this.targets.forEach((t, i) => {
      (t.colors.array as Float32Array).set(snapshot.colors[i]);
      t.colors.needsUpdate = true;
    });
    this.painted = snapshot.painted;
  }

  private emit() {
    this.onChange({ canUndo: this.history.length > 0, painted: this.painted, part: this.part });
  }

  /** 지금 포인터가 가리키는 캐릭터 표면 (부위 + 점 + 바깥 방향) */
  private pick(): Hit | null {
    this.turntable.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.targets.map((t) => t.mesh), false)[0];
    if (!hit?.face) return null;
    const target = this.targets.find((t) => t.mesh === hit.object)!;
    // 회전된 부위의 현재 좌표로 칠하되 색 버퍼와 부위 식별은 유지한다.
    Object.assign(target, this.cacheTarget(target.mesh));
    const normal = hit.face.normal.clone().applyMatrix3(target.normalMatrix).normalize();
    return { target, point: hit.point, normal };
  }

  /** 칠하는 중이면 처음 닿은 부위를 고정하고, 그 부위 위일 때만 뿌린다 */
  private sprayHit(hit: Hit, dt: number) {
    this.strokeTarget ??= hit.target;
    if (hit.target === this.strokeTarget) this.spray(hit, dt);
  }

  /** 맞은 부위 안에서만 point 둘레를 dt초만큼 뿌린다 (옆 부위로 번지지 않는다) */
  private spray({ target: t, point, normal }: Hit, dt: number) {
    const r = this.radius;
    const r2 = r * r;
    const { r: cr, g: cg, b: cb } = this.color;
    const amount = SPRAY_FLOW * dt * this.strength;
    const p = t.positions;
    const n = t.normals;
    const c = t.colors.array as Float32Array;
    let changed = false;
    for (let i = 0; i < p.length; i += 3) {
      const dx = p[i] - point.x;
      const dy = p[i + 1] - point.y;
      const dz = p[i + 2] - point.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2) continue;
      // 반대쪽을 보는 면(뿔 뒤쪽 등)에는 묻지 않는다
      const facing = n[i] * normal.x + n[i + 1] * normal.y + n[i + 2] * normal.z;
      if (facing < 0.1) continue;
      const edge = 1 - Math.sqrt(d2) / r;
      // 가운데일수록 진하게, 점마다 조금씩 다르게 묻어 스프레이 알갱이 느낌
      const w = Math.min(1, edge * edge * amount * (0.3 + Math.random() * 1.4) * Math.min(1, facing * 2));
      c[i] += (cr - c[i]) * w;
      c[i + 1] += (cg - c[i + 1]) * w;
      c[i + 2] += (cb - c[i + 2]) * w;
      changed = true;
    }
    if (!changed) return;
    t.colors.needsUpdate = true;
    this.strokeChanged = true;
    if (!this.painted) {
      this.painted = true;
      this.emit();
    }
  }

  private updateCursor(hit: Hit | null) {
    this.cursor.visible = this.mode === "spray" && hit !== null;
    // 칠할 부위 이름 (칠하는 중이면 고정된 부위)
    const part = this.strokeTarget?.mesh.name ?? hit?.target.mesh.name ?? null;
    if (part !== this.part) {
      this.part = part;
      this.emit();
    }
    if (!hit) return;
    this.cursor.position.copy(hit.point).addScaledVector(hit.normal, 0.01);
    this.cursor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), hit.normal);
    this.cursor.scale.setScalar(this.radius);
    const material = this.cursor.material as THREE.MeshBasicMaterial;
    material.color.copy(this.color).lerp(new THREE.Color("#363636"), 0.35);
    // 칠하는 중에 다른 부위 위로 가면 고리를 흐리게 (여기는 안 칠해진다는 표시)
    material.opacity = this.strokeTarget && hit.target !== this.strokeTarget ? 0.2 : 0.7;
  }

  private tick = (time: number) => {
    this.frame = requestAnimationFrame(this.tick);
    // 탭을 오래 비웠다 돌아와도 한꺼번에 칠해지지 않도록 한 프레임은 최대 0.05초로 친다
    const dt = Math.min(0.05, (time - this.lastTime) / 1000);
    this.lastTime = time;
    // 회전 위치는 OrbitControls 한 곳에서만 계산해 프레임 간 충돌을 없앤다.
    this.controls.update();
    if (this.spinning) {
      this.turntable.rotateOnWorldAxis(this.spinAxis, Math.PI / 30 * this.spinSpeed * this.spinDirection * dt);
      this.turntable.updateMatrixWorld(true);
    }

    const hit = this.pointerInside && this.mode !== "rotate" && this.touches.size <= 1 ? this.pick() : null;
    if (hit && this.sprayPointer !== null) this.sprayHit(hit, dt);
    this.updateCursor(hit);
    this.renderer.render(this.scene, this.camera);
  };
}
