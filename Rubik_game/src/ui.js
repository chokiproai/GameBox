import { formatTime } from "./config.js";

const MAX_VISIBLE_MOVES = 12;

export class UI {
  constructor() {
    this.timer = document.getElementById("timer");
    this.moveCount = document.getElementById("moveCount");
    this.statusLabel = document.getElementById("statusLabel");
    this.historyList = document.getElementById("historyList");
    this.logMeta = document.getElementById("logMeta");
    this.toast = document.getElementById("toast");
    this.toastTitle = document.getElementById("toastTitle");
    this.toastText = document.getElementById("toastText");
    this.solvedTime = document.getElementById("solvedTime");
    this.solvedMoves = document.getElementById("solvedMoves");
    this.modeLabel = document.getElementById("modeLabel");
    this.primeToggle = document.getElementById("primeToggle");
    this.soundBtn = document.getElementById("soundBtn");
    this.announcer = document.getElementById("announcer");
    this.helpDialog = document.getElementById("helpDialog");

    this._lastTimer = "";
    this._lastMoves = null;
    this._toastTimeout = 0;
    this._announceTimeout = 0;
  }

  setStatus(label, state) {
    this.statusLabel.textContent = label;
    document.body.dataset.state = state;
  }

  setTimer(milliseconds) {
    const text = formatTime(milliseconds);
    if (text !== this._lastTimer) {
      this.timer.textContent = text;
      this._lastTimer = text;
    }
  }

  setMoves(count, bump = false) {
    const text = String(Math.max(0, count)).padStart(2, "0");
    this.moveCount.textContent = text;
    if (bump && this._lastMoves !== null && count !== this._lastMoves) {
      this.moveCount.classList.remove("is-bumping");
      void this.moveCount.offsetWidth;
      this.moveCount.classList.add("is-bumping");
    }
    this._lastMoves = count;
  }

  renderMoves(moves, totalMoves, phase = "ready") {
    const fragment = document.createDocumentFragment();
    const visible = moves.slice(-MAX_VISIBLE_MOVES);

    if (!visible.length) {
      const empty = document.createElement("span");
      empty.className = "move-log__empty";
      empty.textContent =
        phase === "scrambled"
          ? "Sẵn sàng cho lượt xoay đầu tiên"
          : "Chưa có lượt xoay";
      fragment.appendChild(empty);
    } else {
      visible.forEach((move, index) => {
        const chip = document.createElement("span");
        chip.className = "move-chip";
        if (index === visible.length - 1) chip.classList.add("is-latest", "is-new");
        chip.textContent = move;
        fragment.appendChild(chip);
      });
    }

    this.historyList.replaceChildren(fragment);

    if (totalMoves > 0) {
      this.logMeta.textContent = `${totalMoves} LƯỢT`;
    } else if (phase === "scrambled") {
      this.logMeta.textContent = "ĐÃ TRỘN";
    } else {
      this.logMeta.textContent = "TRỐNG";
    }
  }

  showToast(title, detail, duration = 2800) {
    window.clearTimeout(this._toastTimeout);
    this.toastTitle.textContent = title;
    this.toastText.textContent = detail;
    this.toast.classList.add("is-visible");
    document.body.classList.add("toast-visible");
    this._toastTimeout = window.setTimeout(() => this.hideToast(), duration);
  }

  hideToast() {
    window.clearTimeout(this._toastTimeout);
    this.toast.classList.remove("is-visible");
    document.body.classList.remove("toast-visible");
  }

  showSolved(elapsed, moves) {
    this.hideToast();
    this.solvedTime.textContent = formatTime(elapsed);
    this.solvedMoves.textContent = `${String(moves).padStart(2, "0")} LƯỢT`;
    document.body.classList.add("is-solved");

    if (window.matchMedia("(max-width: 760px)").matches) {
      this.showToast(
        "Hoàn hảo.",
        `${formatTime(elapsed)} · ${moves} lượt xoay`,
        4600,
      );
    }
  }

  clearSolved() {
    document.body.classList.remove("is-solved");
  }

  setPrime(active) {
    document.body.classList.toggle("is-prime", active);
    this.primeToggle.setAttribute("aria-pressed", String(active));
    this.modeLabel.textContent = active ? "NGƯỢC" : "THUẬN";
  }

  setSound(enabled) {
    document.body.classList.toggle("is-muted", !enabled);
    this.soundBtn.setAttribute("aria-pressed", String(enabled));
    this.soundBtn.setAttribute(
      "aria-label",
      enabled ? "Tắt âm thanh" : "Bật âm thanh",
    );
    const label = this.soundBtn.querySelector(".sound-btn__label");
    if (label) {
      label.innerHTML = `ÂM THANH <b>${enabled ? "ON" : "OFF"}</b>`;
    }
  }

  announce(message) {
    window.clearTimeout(this._announceTimeout);
    this.announcer.textContent = "";
    this._announceTimeout = window.setTimeout(() => {
      this.announcer.textContent = message;
    }, 30);
  }

  openHelp() {
    if (typeof this.helpDialog.showModal === "function") {
      this.helpDialog.showModal();
    } else {
      this.helpDialog.setAttribute("open", "");
    }
  }

  closeHelp() {
    if (typeof this.helpDialog.close === "function") {
      this.helpDialog.close();
    } else {
      this.helpDialog.removeAttribute("open");
    }
  }
}
