import * as THREE from "three";
import { RoundedBoxGeometry } from "../../vendor/RoundedBoxGeometry.js";
import {
  BODY_RADIUS,
  BODY_SIZE,
  FACE_COLORS,
  FLOOR_Y,
  HALF_PI,
  PLINTH_TOP,
  SPACING,
  TILE_SIZE,
} from "../config.js";

/* ------------------------------------------------------------------ *
 * Procedural textures
 * ------------------------------------------------------------------ */

function canvasTexture(size, painter) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  painter(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function makeRadialAlpha() {
  const texture = canvasTexture(512, (ctx, size) => {
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.08,
      size / 2,
      size / 2,
      size * 0.5,
    );
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.42, "rgba(255,255,255,.96)");
    gradient.addColorStop(0.7, "rgba(255,255,255,.52)");
    gradient.addColorStop(0.88, "rgba(255,255,255,.12)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function makeSurfaceBump() {
  const texture = canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, size, size);
    const image = ctx.getImageData(0, 0, size, size);
    const data = image.data;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const index = (y * size + x) * 4;
        const wave =
          Math.sin(x * 0.11 + y * 0.07) * 3.2 +
          Math.sin(x * 0.031 - y * 0.043) * 2.4;
        const grain = (Math.random() - 0.5) * 7.5;
        const value = 128 + wave + grain;
        data[index] = value;
        data[index + 1] = value;
        data[index + 2] = value;
        data[index + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function makeSoftShadow() {
  const texture = canvasTexture(512, (ctx, size) => {
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.05,
      size / 2,
      size / 2,
      size * 0.48,
    );
    gradient.addColorStop(0, "rgba(0,0,0,.82)");
    gradient.addColorStop(0.35, "rgba(0,0,0,.55)");
    gradient.addColorStop(0.65, "rgba(0,0,0,.2)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeLightPool() {
  const texture = canvasTexture(512, (ctx, size) => {
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, "rgba(212, 177, 117, .42)");
    gradient.addColorStop(0.26, "rgba(191, 156, 101, .26)");
    gradient.addColorStop(0.54, "rgba(126, 102, 69, .1)");
    gradient.addColorStop(0.8, "rgba(50, 42, 32, .025)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeLogoTexture() {
  const texture = canvasTexture(512, (ctx, size) => {
    const c = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(c, c);
    ctx.strokeStyle = "rgba(242, 211, 150, .92)";
    ctx.fillStyle = "rgba(242, 211, 150, .62)";
    ctx.lineWidth = 5;
    ctx.lineJoin = "round";

    // A quiet, four-point atelier mark.
    ctx.beginPath();
    ctx.moveTo(0, -112);
    ctx.bezierCurveTo(12, -44, 44, -12, 112, 0);
    ctx.bezierCurveTo(44, 12, 12, 44, 0, 112);
    ctx.bezierCurveTo(-12, 44, -44, 12, -112, 0);
    ctx.bezierCurveTo(-44, -12, -12, -44, 0, -112);
    ctx.closePath();
    ctx.stroke();

    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(0, 0, 160, 0, Math.PI * 2);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/* ------------------------------------------------------------------ *
 * Studio environment (reflections only)
 * ------------------------------------------------------------------ */

export function createStudioEnvironment(renderer) {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x020304);

  const backdrop = new THREE.Mesh(
    new THREE.SphereGeometry(32, 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0x0b0d10,
      side: THREE.BackSide,
    }),
  );
  envScene.add(backdrop);

  const panels = [];
  function panel(width, height, position, color, intensity) {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    envScene.add(mesh);
    panels.push(mesh);
    return mesh;
  }

  // Key softbox, warm strip, cool kicker, and overhead diffusion.
  panel(8.5, 4.2, [-6.5, 8.5, 4.2], 0xfff1dc, 4.1);
  panel(2.6, 10.5, [7.8, 3.2, 2.8], 0xffdcb4, 2.1);
  panel(2.1, 7.2, [-8.4, 1.4, -2.8], 0xc2d6f4, 1.45);
  panel(8.5, 1.25, [0, 3.4, -9], 0xffc88f, 1.15);
  panel(7.5, 7.5, [0, 10, -0.5], 0xb4b9c5, 0.52);
  panel(6.2, 3.4, [3.4, 5.6, 12.6], 0xfff6ea, 2.25);
  panel(1.5, 8, [9.5, 3, 6], 0xd7e4f4, 0.85);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  const renderTarget = pmrem.fromScene(envScene, 0.04, 0.1, 100);
  pmrem.dispose();

  panels.forEach((mesh) => {
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
  backdrop.geometry.dispose();
  backdrop.material.dispose();

  return renderTarget.texture;
}

/* ------------------------------------------------------------------ *
 * Cube geometry
 * ------------------------------------------------------------------ */

function roundedTileGeometry() {
  const width = TILE_SIZE;
  const radius = 0.085;
  const x = -width / 2;
  const y = -width / 2;
  const shape = new THREE.Shape();

  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + width - radius);
  shape.quadraticCurveTo(x + width, y + width, x + width - radius, y + width);
  shape.lineTo(x + radius, y + width);
  shape.quadraticCurveTo(x, y + width, x, y + width - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.017,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.011,
    bevelSegments: 3,
    curveSegments: 12,
    steps: 1,
  });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

const STICKER_FACES = [
  {
    label: "R",
    normal: new THREE.Vector3(1, 0, 0),
    euler: new THREE.Euler(0, HALF_PI, 0),
  },
  {
    label: "L",
    normal: new THREE.Vector3(-1, 0, 0),
    euler: new THREE.Euler(0, -HALF_PI, 0),
  },
  {
    label: "U",
    normal: new THREE.Vector3(0, 1, 0),
    euler: new THREE.Euler(-HALF_PI, 0, 0),
  },
  {
    label: "D",
    normal: new THREE.Vector3(0, -1, 0),
    euler: new THREE.Euler(HALF_PI, 0, 0),
  },
  {
    label: "F",
    normal: new THREE.Vector3(0, 0, 1),
    euler: new THREE.Euler(0, 0, 0),
  },
  {
    label: "B",
    normal: new THREE.Vector3(0, 0, -1),
    euler: new THREE.Euler(0, Math.PI, 0),
  },
];

export function buildCube() {
  const cubeRoot = new THREE.Group();
  cubeRoot.name = "cubeRoot";

  const bodyGeometry = new RoundedBoxGeometry(
    BODY_SIZE,
    BODY_SIZE,
    BODY_SIZE,
    5,
    BODY_RADIUS,
  );
  const tileGeometry = roundedTileGeometry();
  const logoTexture = makeLogoTexture();
  const surfaceBump = makeSurfaceBump();

  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x08090b,
    metalness: 0.16,
    roughness: 0.31,
    clearcoat: 1,
    clearcoatRoughness: 0.11,
    envMapIntensity: 0.82,
    bumpMap: surfaceBump,
    bumpScale: 0.0021,
  });

  const tileMaterials = {};
  Object.entries(FACE_COLORS).forEach(([face, color]) => {
    tileMaterials[face] = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.015,
      roughness: 0.265,
      clearcoat: 1,
      clearcoatRoughness: 0.065,
      envMapIntensity: 1.22,
      specularIntensity: 0.68,
      specularColor: new THREE.Color(0xfff8ea),
      bumpMap: surfaceBump,
      bumpScale: 0.0014,
    });
  });

  const cubies = [];
  const pickables = [];
  const stickerGroups = [];

  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        const cubie = new THREE.Group();
        const position = new THREE.Vector3(x * SPACING, y * SPACING, z * SPACING);
        cubie.position.copy(position);
        cubie.userData.home = position.clone();
        cubie.userData.grid = { x, y, z };

        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        body.receiveShadow = true;
        body.userData.isBody = true;
        cubie.add(body);
        pickables.push(body);

        STICKER_FACES.forEach((face) => {
          const coordinate = { x, y, z }[face.normal.x !== 0 ? "x" : face.normal.y !== 0 ? "y" : "z"];
          const sign = face.normal.x || face.normal.y || face.normal.z;
          if (coordinate !== sign) return;

          const stickerGroup = new THREE.Group();
          stickerGroup.position.copy(face.normal).multiplyScalar(BODY_SIZE / 2 + 0.006);
          stickerGroup.rotation.copy(face.euler);

          const tileMaterial = tileMaterials[face.label].clone();
          tileMaterial.color.offsetHSL(
            (Math.random() - 0.5) * 0.004,
            (Math.random() - 0.5) * 0.012,
            (Math.random() - 0.5) * 0.018,
          );
          tileMaterial.roughness = THREE.MathUtils.clamp(
            0.255 + (Math.random() - 0.5) * 0.03,
            0.22,
            0.3,
          );

          const tile = new THREE.Mesh(tileGeometry, tileMaterial);
          tile.castShadow = true;
          tile.receiveShadow = true;
          tile.rotation.z = (Math.random() - 0.5) * 0.006;
          tile.userData.isSticker = true;
          tile.userData.colorFace = face.label;
          stickerGroup.add(tile);
          pickables.push(tile);
          stickerGroups.push({ group: stickerGroup, colorFace: face.label, tile });

          if (x === 0 && y === 0 && z === 1 && face.label === "F") {
            const logo = new THREE.Mesh(
              new THREE.PlaneGeometry(0.3, 0.3),
              new THREE.MeshBasicMaterial({
                map: logoTexture,
                transparent: true,
                depthWrite: false,
                opacity: 0.72,
                color: 0xf0d7a4,
                toneMapped: true,
              }),
            );
            logo.position.z = 0.03;
            logo.renderOrder = 2;
            stickerGroup.add(logo);
          }

          cubie.add(stickerGroup);
        });

        cubeRoot.add(cubie);
        cubies.push(cubie);
      }
    }
  }

  return { cubeRoot, cubies, pickables, stickerGroups, bodyGeometry, tileGeometry };
}

/* ------------------------------------------------------------------ *
 * Pedestal, floor, practical lights
 * ------------------------------------------------------------------ */

export function buildStage(stage) {
  const floorAlpha = makeRadialAlpha();
  const shadowTexture = makeSoftShadow();

  const floorMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x030405,
    metalness: 0.22,
    roughness: 0.42,
    clearcoat: 0.88,
    clearcoatRoughness: 0.19,
    transparent: true,
    alphaMap: floorAlpha,
    opacity: 1,
    envMapIntensity: 0.16,
    depthWrite: false,
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 128), floorMaterial);
  floor.rotation.x = -HALF_PI;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  floor.renderOrder = 0;
  // The animated CSS studio already supplies the room; a physical floor only
  // added a visible horizon and a flat reflection. Keep the mesh available for
  // lighting tests, but let the object float in the dark studio instead.
  floor.visible = false;
  stage.add(floor);

  const lightPool = new THREE.Mesh(
    new THREE.PlaneGeometry(8.2, 8.2),
    new THREE.MeshBasicMaterial({
      map: makeLightPool(),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  lightPool.rotation.x = -HALF_PI;
  lightPool.position.y = FLOOR_Y + 0.001;
  lightPool.renderOrder = 0;
  stage.add(lightPool);

  const plinth = new THREE.Group();
  plinth.position.y = FLOOR_Y + 0.004;
  stage.add(plinth);

  const profile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(2.0, 0),
    new THREE.Vector2(2.07, 0.018),
    new THREE.Vector2(2.11, 0.07),
    new THREE.Vector2(2.11, 0.19),
    new THREE.Vector2(2.082, 0.24),
    new THREE.Vector2(2.032, 0.272),
    new THREE.Vector2(1.96, 0.288),
    new THREE.Vector2(0, 0.295),
  ];
  const plinthGeometry = new THREE.LatheGeometry(profile, 128);
  const plinthMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x060709,
    metalness: 0.26,
    roughness: 0.17,
    clearcoat: 1,
    clearcoatRoughness: 0.055,
    envMapIntensity: 0.5,
  });
  const plinthMesh = new THREE.Mesh(plinthGeometry, plinthMaterial);
  plinthMesh.castShadow = true;
  plinthMesh.receiveShadow = true;
  plinth.add(plinthMesh);

  const goldMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd4b274,
    metalness: 1,
    roughness: 0.23,
    envMapIntensity: 1.15,
  });
  const inlay = new THREE.Mesh(new THREE.TorusGeometry(1.885, 0.0055, 8, 160), goldMaterial);
  inlay.rotation.x = -HALF_PI;
  inlay.position.y = 0.2965;
  plinth.add(inlay);

  const outerGlint = new THREE.Mesh(
    new THREE.TorusGeometry(2.045, 0.0026, 6, 160),
    new THREE.MeshBasicMaterial({
      color: 0xc7a463,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    }),
  );
  outerGlint.rotation.x = -HALF_PI;
  outerGlint.position.y = 0.238;
  plinth.add(outerGlint);

  function shadowPlane(size, opacity, y, renderOrder) {
    const material = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
    mesh.rotation.x = -HALF_PI;
    mesh.position.y = y;
    mesh.renderOrder = renderOrder;
    stage.add(mesh);
    return mesh;
  }

  const contactShadow = shadowPlane(4.5, 0.86, PLINTH_TOP + 0.0025, 2);
  contactShadow.scale.x = 1.12;
  const floorShadow = shadowPlane(6.2, 0.62, FLOOR_Y + 0.0035, 1);
  floorShadow.scale.x = 1.16;
  floorShadow.visible = false;

  return {
    floor,
    lightPool,
    plinth,
    plinthMesh,
    plinthMaterial,
    goldMaterial,
    contactShadow,
    floorShadow,
  };
}
