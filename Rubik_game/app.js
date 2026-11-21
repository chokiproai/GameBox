import { CubeExperience } from "./src/cube/experience.js";
import { CubeGame } from "./src/game.js";
import { SoundEngine } from "./src/sound.js";
import { UI } from "./src/ui.js";
import { FACE_KEYS } from "./src/config.js";

const canvas = document.getElementById("scene");
const loader = document.getElementById("loader");
const loaderLabel = document.getElementById("loaderLabel");
const errorPanel = document.getElementById("webglError");
const hint = document.getElementById("gestureHint");
const helpDialog = document.getElementById("helpDialog");

const controls = {
  scramble: document.getElementById("scrambleBtn"),
  reset: document.getElementById("resetBtn"),
  undo: document.getElementById("undoBtn"),
  prime: document.getElementById("primeToggle"),
  sound: document.getElementById("soundBtn"),
  help: document.getElementById("helpBtn"),
  helpClose: document.getElementById("helpClose"),
  helpOk: document.getElementById("helpOk"),
  faces: Array.from(document.querySelectorAll(".face-btn")),
};

let ui;
let sound;
let experience;
let game;
let primeActive = false;
let ready = false;
let hintDismissed = false;

function dismissHint() {
  if (hintDismissed || !hint) return;
  hintDismissed = true;
  hint.classList.add("is-quiet");
}

function syncControls(state) {
  if (!state) return;
  controls.scramble.disabled = state.scrambleDisabled;
  controls.reset.disabled = state.resetDisabled;
  controls.undo.disabled = state.undoDisabled;
  controls.prime.disabled = state.primeDisabled;
  controls.faces.forEach((button) => {
    button.disabled = state.facesDisabled;
  });
}

function openHelp() {
  if (!ui) return;
  ui.openHelp();
}

function closeHelp() {
  if (!ui) return;
  ui.closeHelp();
}

function bindControls() {
  controls.scramble.addEventListener("click", () => {
    if (!game) return;
    sound.init();
    dismissHint();
    game.scramble();
  });

  controls.reset.addEventListener("click", () => {
    if (!game) return;
    sound.init();
    game.reset();
  });

  controls.undo.addEventListener("click", () => {
    if (!game) return;
    sound.init();
    game.undo();
  });

  controls.prime.addEventListener("click", () => {
    primeActive = !primeActive;
    ui.setPrime(primeActive);
    sound.init();
    sound.ui();
  });

  controls.faces.forEach((button) => {
    button.addEventListener("click", (event) => {
      if (!game) return;
      const face = button.dataset.face;
      const prime = primeActive || event.shiftKey;
      game.requestTurn(face, prime, "button");
    });
  });

  controls.sound.addEventListener("click", () => {
    const enabled = sound.toggle();
    ui.setSound(enabled);
    if (enabled) sound.ui();
  });

  controls.help.addEventListener("click", openHelp);
  controls.helpClose.addEventListener("click", closeHelp);
  controls.helpOk.addEventListener("click", closeHelp);

  helpDialog.addEventListener("click", (event) => {
    if (event.target !== helpDialog) return;
    const rect = helpDialog.getBoundingClientRect();
    const outside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (outside) closeHelp();
  });
}

function bindKeyboard() {
  document.addEventListener("keydown", (event) => {
    if (helpDialog.open) return;
    const target = event.target;
    const tagName = target?.tagName?.toUpperCase?.() || "";
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tagName)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (sound.enabled) sound.init();

    if (event.code === "Space") {
      if (target?.closest?.("button")) return;
      event.preventDefault();
      if (game) {
        dismissHint();
        game.scramble();
      }
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      if (game) game.undo();
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      if (game) game.reset();
      return;
    }

    if (event.key === "?") {
      event.preventDefault();
      openHelp();
      return;
    }

    const face = event.key.toUpperCase();
    if (FACE_KEYS.includes(face)) {
      event.preventDefault();
      if (event.repeat) return;
      if (game) {
        game.requestTurn(face, event.shiftKey || primeActive, "keyboard");
      }
    }
  });
}

function bindPointer() {
  const pointers = new Map();
  let gesture = null;

  function distanceBetween(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function setHover(event) {
    if (!experience || pointers.size) return;
    const hit = experience.pick(event.clientX, event.clientY);
    canvas.classList.toggle("is-over-cube", Boolean(hit));
  }

  function cancelFacePreview() {
    if (!gesture || gesture.mode !== "face" || !gesture.preview) return;
    const preview = gesture.preview;
    gesture.preview = null;
    preview.finish(false).then(() => {
      game?.completeDragTurn(null);
    });
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!experience) return;
    if (sound.enabled) sound.init();

    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* capture is a convenience, not a requirement */
    }

    if (pointers.size === 2) {
      cancelFacePreview();
      const [a, b] = Array.from(pointers.values());
      gesture = {
        mode: "pinch",
        startDistance: Math.max(1, distanceBetween(a, b)),
        startZoom: experience.view.targetDistance,
        lastMidpoint: midpoint(a, b),
      };
      canvas.classList.add("is-dragging");
      dismissHint();
      return;
    }

    if (pointers.size > 2) return;

    const hit = experience.pick(event.clientX, event.clientY);
    const mustOrbit =
      event.button === 2 ||
      !hit ||
      Boolean(game && game.inputBlocked);

    if (!mustOrbit) {
      gesture = {
        mode: "face",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        hit,
        preview: null,
        angle: 0,
        detent: false,
      };
      canvas.classList.add("is-dragging");
      canvas.classList.remove("is-over-cube");
      return;
    }

    gesture = {
      mode: "orbit",
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    canvas.classList.add("is-dragging");
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!experience) return;

    if (!pointers.has(event.pointerId)) {
      setHover(event);
      return;
    }

    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (gesture?.mode === "pinch" && pointers.size >= 2) {
      const [a, b] = Array.from(pointers.values());
      const currentDistance = Math.max(1, distanceBetween(a, b));
      const ratio = gesture.startDistance / currentDistance;
      const view = experience.view;
      view.targetDistance = Math.max(
        view.minDistance,
        Math.min(view.maxDistance, gesture.startZoom * ratio),
      );
      experience._userZoomed = true;

      const currentMidpoint = midpoint(a, b);
      experience.orbitBy(
        (currentMidpoint.x - gesture.lastMidpoint.x) * 0.45,
        (currentMidpoint.y - gesture.lastMidpoint.y) * 0.45,
      );
      gesture.lastMidpoint = currentMidpoint;
      return;
    }

    if (!gesture || gesture.mode !== "face" || gesture.pointerId !== event.pointerId) {
      if (gesture?.mode === "orbit" && gesture.pointerId === event.pointerId) {
        const moveX = event.clientX - gesture.lastX;
        const moveY = event.clientY - gesture.lastY;
        if (Math.abs(moveX) + Math.abs(moveY) > 1) {
          experience.orbitBy(moveX, moveY);
          dismissHint();
        }
        gesture.lastX = event.clientX;
        gesture.lastY = event.clientY;
      }
      return;
    }

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (!gesture.preview) {
      if (Math.hypot(dx, dy) < 8) return;
      if (!game || game.inputBlocked) return;

      const measure = experience.measureDrag(gesture.hit, dx, dy);
      if (!measure) return;
      if (!game.beginDragPreview()) return;

      const preview = experience.beginDragTurn(measure.face);
      if (!preview) {
        game.completeDragTurn(null);
        return;
      }

      gesture.preview = preview;
      dismissHint();
    }

    const measure = experience.measureDrag(gesture.hit, dx, dy);
    if (!measure) return;

    gesture.preview.setAngle(measure.angle);
    gesture.angle = measure.angle;

    const engaged = Math.abs(measure.angle) > Math.PI / 4;
    if (engaged && !gesture.detent) {
      gesture.detent = true;
      sound.detent();
    } else if (!engaged) {
      gesture.detent = false;
    }
  });

  function finishPointer(event) {
    pointers.delete(event.pointerId);
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      /* no capture to release */
    }

    if (gesture?.mode === "face" && gesture.pointerId === event.pointerId) {
      const preview = gesture.preview;
      if (preview) {
        const cancelled = event.type === "pointercancel";
        const shouldCommit =
          !cancelled && Math.abs(gesture.angle) > Math.PI / 4;
        gesture.preview = null;

        if (shouldCommit) sound.turn(0);
        preview
          .finish(shouldCommit)
          .then((finalAngle) => {
            const committed =
              shouldCommit && Math.abs(finalAngle) > 0.1;
            game?.completeDragTurn(
              committed ? preview.face : null,
              finalAngle > 0,
            );
          })
          .catch((error) => {
            console.error("Drag turn failed", error);
            game?.completeDragTurn(null);
          });
      }
    }

    if (pointers.size === 0) {
      gesture = null;
      canvas.classList.remove("is-dragging");
    } else if (gesture?.mode === "pinch" && pointers.size === 1) {
      gesture = { mode: "wait" };
    }
  }

  canvas.addEventListener("pointerup", finishPointer);
  canvas.addEventListener("pointercancel", finishPointer);
  canvas.addEventListener("pointerleave", () => {
    if (!pointers.size) canvas.classList.remove("is-over-cube");
  });

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!experience) return;
      event.preventDefault();
      experience.zoomBy(event.deltaY);
      dismissHint();
    },
    { passive: false },
  );

  canvas.addEventListener("dblclick", (event) => {
    if (!experience) return;
    const hit = experience.pick(event.clientX, event.clientY);
    if (!hit) {
      experience.resetView();
      ui.showToast("Đã căn lại góc nhìn", "Góc máy trở về bố cục ban đầu.", 1800);
    }
  });
}

function bindResizeSideEffects() {
  window.addEventListener("resize", () => {
    if (ui) ui.setSound(sound.enabled);
  });
}

function showFatalError(error) {
  console.error(error);
  if (loader) loader.classList.add("is-hidden");
  if (errorPanel) errorPanel.hidden = false;
  document.body.classList.remove("is-ready");
}

async function boot() {
  try {
    ui = new UI();
    sound = new SoundEngine();
    ui.setSound(true);

    experience = new CubeExperience(canvas, {
      onFrame: (now) => game?.tick(now),
    });

    game = new CubeGame(experience, ui, sound, {
      onControlsChange: syncControls,
      onInteract: dismissHint,
    });

    window.__noir = { game, experience, ui, sound };

    bindControls();
    bindKeyboard();
    bindPointer();
    bindResizeSideEffects();

    document.body.dataset.state = "ready";
    document.body.classList.add("is-ready");

    const minimumDelay = new Promise((resolve) => window.setTimeout(resolve, 680));
    const fontsReady = document.fonts?.ready
      ? document.fonts.ready.catch(() => {})
      : Promise.resolve();
    const timeout = new Promise((resolve) => window.setTimeout(resolve, 2200));

    loaderLabel.textContent = "ĐANG HOÀN THIỆN BỀ MẶT";
    await Promise.race([Promise.all([minimumDelay, fontsReady]), timeout]);

    loader.classList.add("is-hidden");
    experience.beginIntro();
    ready = true;
    window.setTimeout(dismissHint, 16000);

    window.setTimeout(() => {
      loader.setAttribute("aria-hidden", "true");
      loader.remove();
    }, 1500);
  } catch (error) {
    showFatalError(error);
  }
}

window.addEventListener("error", (event) => {
  if (!ready && event.error) console.error("NOIR³ boot error:", event.error);
});

boot();
