import * as THREE from "three";
import { FACE_BY_AXIS, HALF_PI, SPACING, clamp } from "../config.js";
import { computeLayout } from "./layout.js";
import { createMechanism } from "./mechanism.js";
import { buildCube, buildStage, createStudioEnvironment } from "./parts.js";

const Y_AXIS = new THREE.Vector3(0, 1, 0);

export class CubeExperience {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.onFrame = options.onFrame || null;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this._introLocked = !this.reducedMotion;
    this._introBoosting = false;
    this._userOrbited = false;
    this._userZoomed = false;
    this._hoverDirty = true;
    this._paused = false;
    this._disposed = false;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.99;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.environment = createStudioEnvironment(this.renderer);
    if ("environmentIntensity" in this.scene) {
      this.scene.environmentIntensity = 0.92;
    }

    this.camera = new THREE.PerspectiveCamera(
      34,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );

    this.stage = new THREE.Group();
    this.stage.name = "stage";
    this.scene.add(this.stage);

    this.stageEnvironment = buildStage(this.stage);
    const cube = buildCube();
    this.cubeRoot = cube.cubeRoot;
    this.cubies = cube.cubies;
    this.pickables = cube.pickables;
    this.stickerGroups = cube.stickerGroups;
    this.stage.add(this.cubeRoot);
    this.mechanism = createMechanism(cube);

    this._addLights();

    this.layout = null;
    this.view = {
      yaw: 0,
      pitch: 0,
      distance: 0,
      targetYaw: 0,
      targetPitch: 0,
      targetDistance: 0,
      minDistance: 0,
      maxDistance: 0,
    };

    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2();
    this._tempQuaternion = new THREE.Quaternion();
    this._tempVector = new THREE.Vector3();

    this._applyLayout(true);
    this._bindResize();
    this._lastFrame = performance.now();
    this._animate = this._animate.bind(this);
    this._frameRequest = requestAnimationFrame(this._animate);
  }

  _addLights() {
    const hemisphere = new THREE.HemisphereLight(0xb9c4d6, 0x030405, 0.34);
    this.scene.add(hemisphere);

    const key = new THREE.DirectionalLight(0xfff7ec, 2.42);
    key.position.set(-4.8, 8.2, 5.4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -4.2;
    key.shadow.camera.right = 4.2;
    key.shadow.camera.top = 4.8;
    key.shadow.camera.bottom = -4.2;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 24;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.015;
    key.shadow.radius = 4;
    key.shadow.blurSamples = 12;
    this.stage.add(key);
    this.stage.add(key.target);
    this.keyLight = key;

    const fill = new THREE.DirectionalLight(0x9db4d4, 0.64);
    fill.position.set(5.5, 3.2, 5.8);
    this.stage.add(fill);
    this.stage.add(fill.target);

    const rim = new THREE.DirectionalLight(0xffcf9a, 1.18);
    rim.position.set(-2.5, 5.8, -6.5);
    this.stage.add(rim);
    this.stage.add(rim.target);

    const lowRim = new THREE.PointLight(0x8fb0d8, 4.6, 14, 2);
    lowRim.position.set(4.5, 0.4, -4);
    this.stage.add(lowRim);
  }

  _applyLayout(initial = false) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const layout = computeLayout(width, height);
    this.layout = layout;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = layout.fov;
    if (layout.viewOffsetX) {
      this.camera.setViewOffset(
        width,
        height,
        -layout.viewOffsetX,
        0,
        width,
        height,
      );
    } else {
      this.camera.clearViewOffset();
    }
    this.camera.updateProjectionMatrix();

    this.stage.position.x = layout.stageX;
    this.stage.position.y = layout.stageY;

    this.view.minDistance = layout.minDistance;
    this.view.maxDistance = layout.maxDistance;

    if (initial) {
      this.view.yaw = layout.yaw;
      this.view.pitch = layout.pitch;
      this.view.distance = layout.distance;
      this.view.targetYaw = layout.yaw;
      this.view.targetPitch = layout.pitch;
      this.view.targetDistance = layout.distance;

      if (!this.reducedMotion) {
        this.view.yaw -= 0.22;
        this.view.pitch += 0.075;
        this.view.distance += 2.1;
      }
    } else {
      if (!this._userOrbited) {
        this.view.targetYaw = layout.yaw;
        this.view.targetPitch = layout.pitch;
      }
      if (!this._userZoomed) {
        this.view.targetDistance = layout.distance;
      }
      this.view.targetYaw = this._nearestEquivalentAngle(this.view.targetYaw, layout.yaw);
    }

    this.view.targetDistance = clamp(
      this.view.targetDistance,
      this.view.minDistance,
      this.view.maxDistance,
    );
  }

  _nearestEquivalentAngle(angle, reference) {
    while (angle - reference > Math.PI) angle -= Math.PI * 2;
    while (angle - reference < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  beginIntro() {
    this._introLocked = false;
    if (!this.reducedMotion) {
      this._introBoosting = true;
      window.setTimeout(() => {
        this._introBoosting = false;
      }, 1900);
    }
  }

  orbitBy(deltaX, deltaY) {
    this._userOrbited = true;
    this.view.targetYaw -= deltaX * 0.0062;
    this.view.targetPitch = clamp(
      this.view.targetPitch + deltaY * 0.0046,
      0.055,
      1.08,
    );
  }

  zoomBy(delta) {
    this._userZoomed = true;
    const factor = clamp(1 + delta * 0.0012, 0.78, 1.25);
    this.view.targetDistance = clamp(
      this.view.targetDistance * factor,
      this.view.minDistance,
      this.view.maxDistance,
    );
  }

  resetView() {
    if (!this.layout) return;
    this._userOrbited = false;
    this._userZoomed = false;
    this.view.targetYaw = this.layout.yaw;
    this.view.targetPitch = this.layout.pitch;
    this.view.targetDistance = this.layout.distance;
  }

  _bindResize() {
    let scheduled = false;
    this._onResize = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        this._applyLayout(false);
      });
    };
    window.addEventListener("resize", this._onResize, { passive: true });
    window.addEventListener("orientationchange", this._onResize, { passive: true });
    document.addEventListener("visibilitychange", () => {
      this._paused = document.hidden;
      this._lastFrame = performance.now();
    });
  }

  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const intersections = this.raycaster.intersectObjects(this.pickables, false);
    if (!intersections.length) return null;

    const hit = intersections[0];
    if (!hit.face) return null;

    let normalLocal = null;

    if (hit.object.userData.isSticker) {
      // Use the tile's outward axis rather than the triangles of its rounded
      // bevel. The axis reflects the sticker's *current* position after turns,
      // which is the layer a drag must rotate (its colour may have moved).
      const inverseRoot = this.cubeRoot
        .getWorldQuaternion(this._tempQuaternion)
        .invert();
      normalLocal = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(hit.object.getWorldQuaternion(new THREE.Quaternion()))
        .applyQuaternion(inverseRoot)
        .normalize();
    } else {
      // In the narrow gaps between tiles the ray reaches the rounded body and
      // its local normal points into the gap. Classify by the closest outer
      // face of the cube instead, otherwise a drag on the front gap can turn
      // the right layer.
      const localPoint = this.cubeRoot.worldToLocal(hit.point.clone());
      const absX = Math.abs(localPoint.x);
      const absY = Math.abs(localPoint.y);
      const absZ = Math.abs(localPoint.z);

      if (absX >= absY && absX >= absZ) {
        normalLocal = new THREE.Vector3(Math.sign(localPoint.x), 0, 0);
      } else if (absY >= absX && absY >= absZ) {
        normalLocal = new THREE.Vector3(0, Math.sign(localPoint.y), 0);
      } else {
        normalLocal = new THREE.Vector3(0, 0, Math.sign(localPoint.z));
      }
    }

    const absX = Math.abs(normalLocal.x);
    const absY = Math.abs(normalLocal.y);
    const absZ = Math.abs(normalLocal.z);
    if (absX >= absY && absX >= absZ) {
      normalLocal.set(Math.sign(normalLocal.x), 0, 0);
    } else if (absY >= absX && absY >= absZ) {
      normalLocal.set(0, Math.sign(normalLocal.y), 0);
    } else {
      normalLocal.set(0, 0, Math.sign(normalLocal.z));
    }

    const key = `${normalLocal.x},${normalLocal.y},${normalLocal.z}`;
    const face = FACE_BY_AXIS[key];
    if (!face) return null;

    return {
      point: hit.point.clone(),
      normalLocal,
      normalWorld: normalLocal
        .clone()
        .applyQuaternion(this.cubeRoot.getWorldQuaternion(new THREE.Quaternion()))
        .normalize(),
      face,
      object: hit.object,
      distance: hit.distance,
    };
  }

  toScreen(point) {
    const projected = point.clone().project(this.camera);
    return {
      x: (projected.x * 0.5 + 0.5) * window.innerWidth,
      y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  measureDrag(hit, deltaX, deltaY) {
    if (!hit) return null;

    const rootQuaternion = this.cubeRoot.getWorldQuaternion(new THREE.Quaternion());
    const normal = hit.normalLocal.clone().applyQuaternion(rootQuaternion).normalize();
    const center = new THREE.Vector3();
    this.cubeRoot.getWorldPosition(center);

    const planeDistance = hit.point.clone().sub(center).dot(normal);
    const faceCenter = center.clone().addScaledVector(normal, planeDistance);
    const radial = hit.point.clone().sub(faceCenter);
    radial.addScaledVector(normal, -radial.dot(normal));

    let radius = radial.length();
    if (radius < 0.12) {
      const screenUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
      screenUp.addScaledVector(normal, -screenUp.dot(normal));
      if (screenUp.lengthSq() > 0.02) {
        radial.copy(screenUp.normalize());
      } else {
        const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        cameraRight.addScaledVector(normal, -cameraRight.dot(normal));
        radial.copy(cameraRight.normalize());
      }
      radius = 0.34;
    } else {
      radial.normalize();
    }

    // Screen-space direction of a point on this face moving clockwise when
    // seen from outside. Dragging along it winds the layer forward.
    const tangentWorld = new THREE.Vector3()
      .crossVectors(normal, radial)
      .normalize()
      .multiplyScalar(-1);
    const arc = Math.max(0.34, radius) * HALF_PI;
    const p0 = this.toScreen(hit.point);
    const p1 = this.toScreen(
      hit.point.clone().addScaledVector(tangentWorld, arc),
    );

    let tangentX = p1.x - p0.x;
    let tangentY = p1.y - p0.y;
    let pixelsPerQuarter = Math.hypot(tangentX, tangentY);

    if (pixelsPerQuarter < 34) {
      tangentX = 1;
      tangentY = 0;
    }
    pixelsPerQuarter = Math.max(pixelsPerQuarter, 88);

    const unitX = tangentX / Math.hypot(tangentX, tangentY);
    const unitY = tangentY / Math.hypot(tangentX, tangentY);
    const signedPixels = deltaX * unitX + deltaY * unitY;
    const angle = THREE.MathUtils.clamp(
      -(signedPixels / pixelsPerQuarter) * HALF_PI,
      -HALF_PI,
      HALF_PI,
    );

    return {
      face: hit.face,
      angle,
      clockwise: signedPixels >= 0,
      pixelsPerQuarter,
      tangent: { x: unitX, y: unitY },
    };
  }

  beginDragTurn(face) {
    return this.mechanism.beginPreview(face);
  }

  async turn(face, prime, duration = 180) {
    return this.mechanism.turn(face, prime, duration);
  }

  isSolved() {
    return this.mechanism.isSolved();
  }

  rebuild() {
    this.mechanism.rebuild();
  }

  get busy() {
    return this.mechanism.isBusy();
  }

  _updateCamera(delta) {
    if (!this._introLocked) {
      const speed = this._introBoosting ? 3.4 : 9;
      const damping = 1 - Math.exp(-speed * Math.max(0.001, delta));
      this.view.yaw += (this.view.targetYaw - this.view.yaw) * damping;
      this.view.pitch += (this.view.targetPitch - this.view.pitch) * damping;
      this.view.distance +=
        (this.view.targetDistance - this.view.distance) * damping;
    }

    const centerX = this.stage.position.x;
    const targetY = -0.1;
    const cosPitch = Math.cos(this.view.pitch);
    this.camera.position.set(
      centerX + this.view.distance * cosPitch * Math.sin(this.view.yaw),
      targetY + this.view.distance * Math.sin(this.view.pitch),
      this.view.distance * cosPitch * Math.cos(this.view.yaw),
    );
    this.camera.lookAt(centerX, targetY, 0);
  }

  _animate(now) {
    if (this._disposed) return;
    this._frameRequest = requestAnimationFrame(this._animate);
    if (this._paused) {
      this._lastFrame = now;
      return;
    }

    const delta = Math.min(0.06, Math.max(0, (now - this._lastFrame) / 1000));
    this._lastFrame = now;

    this._updateCamera(delta);
    if (this.onFrame) this.onFrame(now, delta);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this._disposed = true;
    cancelAnimationFrame(this._frameRequest);
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("orientationchange", this._onResize);
    this.renderer.dispose();
  }
}
