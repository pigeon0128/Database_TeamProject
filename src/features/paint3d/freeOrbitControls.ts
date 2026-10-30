import * as THREE from "three";

/**
 * 화면의 가로/세로 드래그로 돌리는 회전. 극점에서도 막히지 않는다.
 * object 를 주면 카메라 대신 그 물체를 화면 기준으로 돌린다 (가로 드래그 = 화면 세로축, 세로 드래그 = 화면 가로축).
 * 빙글빙글로 물체가 기울어진 뒤에도 손가락 방향 그대로 돌아가게 하려고 쓴다.
 */
export class FreeOrbitControls {
  target = new THREE.Vector3();
  enabled = true;
  /** 화면 기준으로 돌릴 물체 (없으면 카메라를 궤도로 돌린다) */
  object: THREE.Object3D | null = null;
  enableDamping = true;
  dampingFactor = 0.05;
  rotateSpeed = 1;
  enablePan = false;
  minAzimuthAngle = -Infinity;
  maxAzimuthAngle = Infinity;
  minDistance = 3.5;
  maxDistance = 11;
  mouseButtons: { LEFT: number | null; MIDDLE: number; RIGHT: number } = { LEFT: 0, MIDDLE: 1, RIGHT: 0 };
  touches: { ONE: number | null; TWO: number } = { ONE: 0, TWO: 2 };
  private pointers = new Map<number, THREE.Vector2>();
  private velocity = new THREE.Vector2();
  private initialPosition: THREE.Vector3;
  private initialUp: THREE.Vector3;
  private yaw = 0;
  private pitch = 0;
  constructor(private camera: THREE.PerspectiveCamera, private el: HTMLElement) {
    this.initialPosition = camera.position.clone();
    this.initialUp = camera.up.clone();
    this.syncAngles();
    el.addEventListener("pointerdown", this.down);
    el.addEventListener("pointermove", this.move);
    el.addEventListener("pointerup", this.up);
    el.addEventListener("pointercancel", this.up);
    el.addEventListener("wheel", this.wheel, { passive: false });
    el.addEventListener("contextmenu", this.context);
  }
  private context = (e: Event) => e.preventDefault();
  private down = (e: PointerEvent) => {
    if (!this.enabled) return;
    const mouseAction = e.button === 2 ? this.mouseButtons.RIGHT : e.button === 1 ? this.mouseButtons.MIDDLE : this.mouseButtons.LEFT;
    if (e.pointerType !== "touch" && mouseAction !== THREE.MOUSE.ROTATE) return;
    this.pointers.set(e.pointerId, new THREE.Vector2(e.clientX, e.clientY));
    if (e.pointerType !== "touch" || this.touches.ONE !== null || this.pointers.size > 1) this.el.setPointerCapture(e.pointerId);
  };
  private move = (e: PointerEvent) => {
    const previous = this.pointers.get(e.pointerId);
    if (!previous || !this.enabled) return;
    const dx = e.clientX - previous.x, dy = e.clientY - previous.y;
    previous.set(e.clientX, e.clientY);
    if (e.pointerType === "touch" && this.pointers.size === 1 && this.touches.ONE === null) return;
    const scale = 2 * Math.PI * this.rotateSpeed / Math.max(1, this.el.clientHeight);
    // 기존 OrbitControls처럼 입력량을 누적하고 매 프레임 같은 비율로 적용한다.
    this.velocity.x -= dx * scale;
    this.velocity.y -= dy * scale;
  };
  private up = (e: PointerEvent) => { this.pointers.delete(e.pointerId); };
  private wheel = (e: WheelEvent) => {
    if (!this.enabled) return;
    e.preventDefault();
    const offset = this.camera.position.clone().sub(this.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * Math.exp(e.deltaY * 0.001), this.minDistance, this.maxDistance));
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  };
  private syncAngles() {
    const offset = this.camera.position.clone().sub(this.target);
    this.yaw = Math.atan2(offset.x, offset.z);
    this.pitch = Math.atan2(-offset.y, Math.hypot(offset.x, offset.z));
  }
  private rotate(yaw: number, pitch: number) {
    this.yaw += yaw;
    this.pitch += pitch;
    const distance = this.camera.position.distanceTo(this.target);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const sp = Math.sin(this.pitch), cp = Math.cos(this.pitch);
    // 방위각과 상하 각도로 매번 재구성해 비틀림 누적을 막는다. 극점 통과는 허용한다.
    this.camera.position.set(sy * cp, -sp, cy * cp).multiplyScalar(distance).add(this.target);
    this.camera.up.set(sy * sp, cp, cy * sp);
    this.camera.lookAt(this.target);
  }

  /** 물체를 카메라의 세로·가로 축(월드 좌표)으로 돌린다. 오른쪽 드래그면 앞면이 오른쪽, 아래 드래그면 앞면이 아래로 */
  private rotateObject(object: THREE.Object3D, yaw: number, pitch: number) {
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    object.rotateOnWorldAxis(up, -yaw);
    object.rotateOnWorldAxis(right, -pitch);
    this.levelHorizon(object, right);
    object.updateMatrixWorld(true);
  }

  /**
   * 가로·세로로 번갈아 여러 번 돌리면 회전이 쌓여 물체가 옆으로 기울어진다(롤).
   * 물체의 윗방향이 화면의 좌우로 쏠린 만큼만 되돌려, 정면에서 봤을 때 항상 똑바로 서 있게 한다.
   * 물체가 옆으로 누워 윗방향이 좌우축에 거의 나란할 때는 기준이 없어서 그대로 둔다.
   */
  private levelHorizon(object: THREE.Object3D, right: THREE.Vector3) {
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(object.quaternion);
    const side = up.dot(right);
    if (Math.abs(side) < 1e-6 || Math.abs(side) > 0.98) return;
    const level = up.clone().addScaledVector(right, -side).normalize();
    object.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(up, level)).normalize();
  }

  update() {
    if (!this.enabled) return;
    const fraction = this.enableDamping ? this.dampingFactor : 1;
    if (this.object) this.rotateObject(this.object, this.velocity.x * fraction, this.velocity.y * fraction);
    else this.rotate(this.velocity.x * fraction, this.velocity.y * fraction);
    this.velocity.multiplyScalar(1 - fraction);
  }
  reset() {
    this.velocity.set(0, 0);
    this.target.set(0, 0, 0);
    this.camera.position.copy(this.initialPosition);
    this.camera.up.copy(this.initialUp);
    this.object?.quaternion.identity();
    this.object?.updateMatrixWorld(true);
    this.syncAngles();
    this.camera.lookAt(this.target);
  }
  dispose() {
    this.el.removeEventListener("pointerdown", this.down);
    this.el.removeEventListener("pointermove", this.move);
    this.el.removeEventListener("pointerup", this.up);
    this.el.removeEventListener("pointercancel", this.up);
    this.el.removeEventListener("wheel", this.wheel);
    this.el.removeEventListener("contextmenu", this.context);
  }
}
