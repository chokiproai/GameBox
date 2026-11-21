import { FACE_KEYS, notation } from "./config.js";

const SCRAMBLE_LENGTH = 22;

export class CubeGame {
  constructor(cube, ui, sound, callbacks = {}) {
    this.cube = cube;
    this.ui = ui;
    this.sound = sound;
    this.onControlsChange = callbacks.onControlsChange || (() => {});
    this.onInteract = callbacks.onInteract || (() => {});

    this.mode = "ready";
    this.elapsed = 0;
    this.startedAt = 0;
    this.timerRunning = false;
    this.moves = 0;
    this.recent = [];
    this.undoStack = [];
    this.turnLog = [];
    this.manualQueue = [];
    this.manualBusy = false;
    this.autoBusy = false;
    this.previewBusy = false;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.ui.setStatus("SẴN SÀNG", "ready");
    this.ui.setTimer(0);
    this.ui.setMoves(0);
    this.ui.renderMoves([], 0, "ready");
    this.ui.clearSolved();
    this._syncControls();
  }

  get inputBlocked() {
    return (
      this.autoBusy ||
      this.manualBusy ||
      this.previewBusy ||
      this.cube.busy ||
      this.manualQueue.length > 0
    );
  }

  beginAttempt() {
    if (this.mode === "running") return;
    if (this.mode === "ready" || this.mode === "solved") {
      this.moves = 0;
      this.recent = [];
      this.undoStack = [];
      this.turnLog = [];
      this.elapsed = 0;
      this.ui.setMoves(0);
      this.ui.setTimer(0);
      this.ui.renderMoves([], 0, "running");
      this.ui.clearSolved();
    }

    this.mode = "running";
    this.elapsed = 0;
    this.startedAt = performance.now();
    this.timerRunning = true;
    this.ui.setStatus("ĐANG XOAY", "running");
    this.ui.hideToast();
  }

  requestTurn(face, prime, source = "ui") {
    if (this.autoBusy || this.previewBusy) return false;
    if (this.manualQueue.length >= 12) return false;
    if (!FACE_KEYS.includes(face)) return false;

    this.beginAttempt();
    this.sound.init();
    this.manualQueue.push({ face, prime, notation: notation(face, prime), source });
    this.onInteract(source);
    this._syncControls();
    this._processQueue();
    return true;
  }

  beginDragPreview() {
    if (this.autoBusy || this.manualBusy || this.manualQueue.length) return false;
    if (this.cube.busy) return false;
    this.previewBusy = true;
    this.ui.hideToast();
    this.onInteract("gesture");
    this._syncControls();
    return true;
  }

  completeDragTurn(face, prime) {
    this.previewBusy = false;

    if (face) {
      this.beginAttempt();
      this._recordManual({
        face,
        prime,
        notation: notation(face, prime),
        source: "gesture",
      });
    }

    this._syncControls();

    if (
      face &&
      this.mode === "running" &&
      this.cube.isSolved()
    ) {
      this._handleSolved();
    }
  }

  async _processQueue() {
    if (this.manualBusy || this.autoBusy) return;
    this.manualBusy = true;
    this._syncControls();

    try {
      while (this.manualQueue.length && !this.autoBusy) {
        const move = this.manualQueue.shift();
        this._syncControls();
        this.sound.turn(0);
        await this.cube.turn(
          move.face,
          move.prime,
          this.reducedMotion ? 60 : 172,
        );
        this._recordManual(move);
        if (this.mode === "running") this.ui.setStatus("ĐANG XOAY", "running");
        this._syncControls();
      }
    } catch (error) {
      console.error("Turn failed", error);
    } finally {
      this.manualBusy = false;
    }

    this._syncControls();

    if (
      !this.autoBusy &&
      !this.manualQueue.length &&
      this.mode === "running" &&
      this.cube.isSolved()
    ) {
      this._handleSolved();
    }
  }

  _recordManual(move) {
    this.moves += 1;
    this.recent.push(move.notation);
    if (this.recent.length > 80) this.recent.shift();
    this.undoStack.push(move.notation);
    this.turnLog.push(move.notation);
    this.ui.setMoves(this.moves, true);
    this.ui.renderMoves(this.recent, this.moves, this.mode);
  }

  async undo() {
    if (this.inputBlocked) return;
    if (!this.undoStack.length) return;
    if (this.mode === "solved" || this.mode === "ready") return;

    const original = this.undoStack.pop();
    const face = original[0];
    const inversePrime = !original.endsWith("'");
    if (this.turnLog[this.turnLog.length - 1] === original) this.turnLog.pop();
    if (this.recent[this.recent.length - 1] === original) this.recent.pop();
    this.moves = Math.max(0, this.moves - 1);

    this.autoBusy = true;
    this._syncControls();
    this.ui.hideToast();

    try {
      this.sound.turn(0);
      await this.cube.turn(face, inversePrime, this.reducedMotion ? 60 : 160);
    } catch (error) {
      console.error("Undo failed", error);
    }

    this.ui.setMoves(this.moves);
    this.ui.renderMoves(this.recent, this.moves, this.mode);
    this.autoBusy = false;

    if (this.mode === "running" && this.cube.isSolved()) {
      // Undoing the final move returns the puzzle to its pristine state. That
      // is a cancellation, not a solve, so the timer and log start over.
      this.mode = "ready";
      this.timerRunning = false;
      this.elapsed = 0;
      this.startedAt = 0;
      this.moves = 0;
      this.recent = [];
      this.undoStack = [];
      this.turnLog = [];
      this.ui.setTimer(0);
      this.ui.setMoves(0);
      this.ui.renderMoves([], 0, "ready");
      this.ui.clearSolved();
      this.ui.setStatus("SẴN SÀNG", "ready");
      this.ui.announce(
        `Đã hoàn tác ${original}. Khối trở về trạng thái ban đầu.`,
      );
    } else {
      this.ui.announce(
        `Đã hoàn tác ${original}. Còn ${this.moves} lượt xoay.`,
      );
    }

    this._syncControls();
  }

  async scramble() {
    if (this.inputBlocked) return;

    this.autoBusy = true;
    this.mode = "scrambling";
    this.manualQueue = [];
    this.timerRunning = false;
    this.elapsed = 0;
    this.moves = 0;
    this.recent = [];
    this.undoStack = [];
    this.ui.clearSolved();
    this.ui.hideToast();
    this.ui.setTimer(0);
    this.ui.setMoves(0);
    this.ui.renderMoves([], 0, "scrambling");
    this.ui.setStatus("ĐANG TRỘN", "running");
    this._syncControls();
    this.sound.init();
    this.onInteract("scramble");

    // Keep the existing turn log when the cube was already unsolved, so that
    // "Xếp lại" always has a complete path back to the solved state.
    const currentLog = this.turnLog.slice();
    const sequence = this._makeScramble();
    const completed = [];

    try {
      for (const move of sequence) {
        this.sound.turn(0);
        await this.cube.turn(
          move.face,
          move.prime,
          this.reducedMotion ? 20 : 88,
        );
        completed.push(notation(move.face, move.prime));
        this.turnLog = currentLog.concat(completed);
      }
    } catch (error) {
      console.error("Scramble failed", error);
    }

    this.turnLog = currentLog.concat(completed);
    this.mode = "scrambled";
    this.autoBusy = false;
    this.timerRunning = false;
    this.elapsed = 0;
    this.ui.setTimer(0);
    this.ui.setStatus("ĐÃ TRỘN · SẴN SÀNG", "scrambled");
    this.ui.renderMoves([], 0, "scrambled");
    this.ui.showToast(
      "Đã trộn khối",
      `${completed.length} bước ngẫu nhiên · lượt xoay đầu tiên sẽ bật đồng hồ.`,
      3300,
    );
    this.ui.announce(
      `Đã trộn khối với ${completed.length} bước. Đồng hồ sẽ bắt đầu ở lượt xoay tiếp theo.`,
    );
    this._syncControls();
  }

  _makeScramble() {
    const sequence = [];
    let previous = "";
    for (let i = 0; i < SCRAMBLE_LENGTH; i += 1) {
      let face = previous;
      while (face === previous) {
        face = FACE_KEYS[Math.floor(Math.random() * FACE_KEYS.length)];
      }
      sequence.push({ face, prime: Math.random() < 0.5 });
      previous = face;
    }
    return sequence;
  }

  async reset() {
    if (this.inputBlocked) return;

    this.autoBusy = true;
    this.mode = "resetting";
    this.manualQueue = [];
    this.timerRunning = false;
    this.elapsed = 0;
    this.ui.clearSolved();
    this.ui.hideToast();
    this.ui.setTimer(0);
    this.ui.setStatus("ĐANG XẾP LẠI", "running");
    this._syncControls();

    const reverseSequence = this.turnLog.slice().reverse();
    const canAnimate = reverseSequence.length > 0 && reverseSequence.length <= 40;

    try {
      if (canAnimate) {
        for (const original of reverseSequence) {
          const face = original[0];
          const inversePrime = !original.endsWith("'");
          this.sound.turn(0);
          await this.cube.turn(
            face,
            inversePrime,
            this.reducedMotion ? 12 : 48,
          );
        }
      } else if (reverseSequence.length > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 90));
        this.cube.rebuild();
      }

      if (!this.cube.isSolved()) this.cube.rebuild();
    } catch (error) {
      console.error("Reset failed", error);
      this.cube.rebuild();
    }

    this.mode = "ready";
    this.autoBusy = false;
    this.timerRunning = false;
    this.elapsed = 0;
    this.moves = 0;
    this.recent = [];
    this.undoStack = [];
    this.turnLog = [];
    this.ui.setTimer(0);
    this.ui.setMoves(0);
    this.ui.renderMoves([], 0, "ready");
    this.ui.setStatus("SẴN SÀNG", "ready");
    this.ui.showToast(
      "Đã xếp lại",
      "Khối đã trở về trạng thái hoàn chỉnh.",
      2600,
    );
    this.ui.announce("Khối đã được xếp lại về trạng thái hoàn chỉnh.");
    this._syncControls();
  }

  _handleSolved() {
    this.timerRunning = false;
    this.mode = "solved";
    this.elapsed = this.timerRunning
      ? this.elapsed
      : Math.max(0, performance.now() - this.startedAt);
    this.ui.setTimer(this.elapsed);
    this.ui.setMoves(this.moves);
    this.ui.renderMoves(this.recent, this.moves, "solved");
    this.ui.setStatus("ĐÃ GIẢI", "solved");
    this.ui.showSolved(this.elapsed, this.moves);
    this.ui.announce(
      `Tuyệt vời. Bạn đã giải khối trong ${(this.elapsed / 1000).toFixed(1)} giây với ${this.moves} lượt xoay.`,
    );
    this.turnLog = [];
    this.undoStack = [];
    this.sound.solved();
    this._syncControls();
  }

  tick(now) {
    if (!this.timerRunning) return;
    this.elapsed = Math.max(0, now - this.startedAt);
    this.ui.setTimer(this.elapsed);
  }

  _syncControls() {
    const busy = this.manualBusy || this.cube.busy || this.previewBusy;
    this.onControlsChange({
      scrambleDisabled: this.autoBusy || busy || this.manualQueue.length > 0,
      resetDisabled: this.autoBusy || busy || this.manualQueue.length > 0,
      undoDisabled:
        this.autoBusy ||
        busy ||
        this.manualQueue.length > 0 ||
        !this.undoStack.length ||
        this.mode === "solved" ||
        this.mode === "ready",
      facesDisabled: this.autoBusy || this.previewBusy,
      primeDisabled: this.autoBusy || this.previewBusy,
    });
  }
}
