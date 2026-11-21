import * as THREE from "three";
import { FACE_BY_AXIS, HALF_PI, MOVE_DEFS, SPACING } from "../config.js";

function snapCubie(cubie) {
  cubie.position.set(
    Math.round(cubie.position.x / SPACING) * SPACING,
    Math.round(cubie.position.y / SPACING) * SPACING,
    Math.round(cubie.position.z / SPACING) * SPACING,
  );

  const matrix = new THREE.Matrix4().makeRotationFromQuaternion(cubie.quaternion);
  const e = matrix.elements;
  [0, 1, 2, 4, 5, 6, 8, 9, 10].forEach((index) => {
    e[index] = Math.round(e[index]);
  });
  cubie.quaternion.setFromRotationMatrix(matrix).normalize();
  cubie.scale.set(1, 1, 1);
}

function easeTurn(t) {
  return 1 - Math.pow(1 - t, 4);
}

function animateAngle(pivot, axis, from, to, duration) {
  if (duration <= 0 || Math.abs(to - from) < 0.0001) {
    pivot.quaternion.setFromAxisAngle(axis, to);
    pivot.updateMatrixWorld(true);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const startedAt = performance.now();
    const tick = (now) => {
      const raw = Math.min(1, (now - startedAt) / duration);
      const angle = from + (to - from) * easeTurn(raw);
      pivot.quaternion.setFromAxisAngle(axis, angle);
      pivot.updateMatrixWorld(true);
      if (raw < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

export function createMechanism({ cubeRoot, cubies, stickerGroups }) {
  let busy = false;

  function selectLayer(face) {
    const definition = MOVE_DEFS[face];
    if (!definition) return { definition: null, selected: [] };
    const selected = cubies.filter((cubie) => {
      const coordinate = cubie.position[definition.axis] / SPACING;
      return Math.abs(coordinate - definition.layer) < 0.2;
    });
    return { definition, selected };
  }

  function detachLayer(face) {
    const { definition, selected } = selectLayer(face);
    if (!definition || !selected.length) return null;

    const pivot = new THREE.Group();
    pivot.name = `turn-${face}`;
    cubeRoot.add(pivot);
    selected.forEach((cubie) => pivot.attach(cubie));
    return { definition, selected, pivot };
  }

  function settleLayer(selected, pivot) {
    selected.forEach((cubie) => {
      cubeRoot.attach(cubie);
      snapCubie(cubie);
    });
    cubeRoot.remove(pivot);
    cubeRoot.updateMatrixWorld(true);
  }

  async function turn(face, prime, duration = 180) {
    if (!MOVE_DEFS[face] || busy) return false;

    const layer = detachLayer(face);
    if (!layer) return false;

    busy = true;
    cubeRoot.updateMatrixWorld(true);

    const { definition, selected, pivot } = layer;
    const axis = new THREE.Vector3(...definition.normal);
    const targetAngle = (prime ? 1 : -1) * HALF_PI;

    try {
      await animateAngle(pivot, axis, 0, targetAngle, duration);
      pivot.quaternion.setFromAxisAngle(axis, targetAngle);
      pivot.updateMatrixWorld(true);
      settleLayer(selected, pivot);
      return true;
    } finally {
      busy = false;
    }
  }

  function beginPreview(face) {
    if (!MOVE_DEFS[face] || busy) return null;

    const layer = detachLayer(face);
    if (!layer) return null;

    busy = true;
    cubeRoot.updateMatrixWorld(true);

    const { definition, selected, pivot } = layer;
    const axis = new THREE.Vector3(...definition.normal);
    let angle = 0;
    let active = true;

    function setAngle(next) {
      if (!active) return;
      angle = THREE.MathUtils.clamp(next, -HALF_PI, HALF_PI);
      pivot.quaternion.setFromAxisAngle(axis, angle);
      pivot.updateMatrixWorld(true);
    }

    async function finish(commit) {
      if (!active) return angle;
      active = false;

      const willCommit = Boolean(commit) && Math.abs(angle) > 0.035;
      const target = willCommit ? Math.sign(angle) * HALF_PI : 0;

      try {
        await animateAngle(
          pivot,
          axis,
          angle,
          target,
          willCommit ? 88 : 142,
        );
        pivot.quaternion.setFromAxisAngle(axis, target);
        pivot.updateMatrixWorld(true);
        settleLayer(selected, pivot);
      } finally {
        busy = false;
      }

      angle = target;
      return angle;
    }

    return {
      face,
      setAngle,
      getAngle: () => angle,
      finish,
      cancel: () => finish(false),
    };
  }

  function rebuild() {
    if (busy) return;
    cubeRoot.updateMatrixWorld(true);
    cubies.forEach((cubie) => {
      cubeRoot.add(cubie);
      cubie.position.copy(cubie.userData.home);
      cubie.quaternion.identity();
      cubie.scale.set(1, 1, 1);
    });
    cubeRoot.updateMatrixWorld(true);
  }

  function isSolved() {
    cubeRoot.updateMatrixWorld(true);
    const inverseRoot = new THREE.Quaternion();
    cubeRoot.getWorldQuaternion(inverseRoot).invert();
    const normal = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();

    for (const sticker of stickerGroups) {
      sticker.group.getWorldQuaternion(worldQuaternion);
      normal.set(0, 0, 1).applyQuaternion(worldQuaternion).applyQuaternion(inverseRoot);

      const absX = Math.abs(normal.x);
      const absY = Math.abs(normal.y);
      const absZ = Math.abs(normal.z);
      let key;

      if (absX >= absY && absX >= absZ) {
        key = normal.x > 0 ? "1,0,0" : "-1,0,0";
      } else if (absY >= absX && absY >= absZ) {
        key = normal.y > 0 ? "0,1,0" : "0,-1,0";
      } else {
        key = normal.z > 0 ? "0,0,1" : "0,0,-1";
      }

      if (FACE_BY_AXIS[key] !== sticker.colorFace) {
        return false;
      }
    }

    return true;
  }

  function isBusy() {
    return busy;
  }

  return { turn, beginPreview, rebuild, isSolved, isBusy };
}
