function SoundManager() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.enabled = true;
}

SoundManager.prototype.playSound = function (type) {
    if (!this.enabled) return;
    if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
    }

    switch (type) {
        case 'move':
            this.playMoveSound();
            break;
        case 'merge':
            this.playMergeSound();
            break;
        case 'win':
            this.playWinSound();
            break;
        case 'gameover':
            this.playGameOverSound();
            break;
    }
};

SoundManager.prototype.playMoveSound = function () {
    var osc = this.audioCtx.createOscillator();
    var gain = this.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.1);
};

SoundManager.prototype.playMergeSound = function () {
    var osc = this.audioCtx.createOscillator();
    var gain = this.audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, this.audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(600, this.audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.15);
};

SoundManager.prototype.playWinSound = function () {
    var now = this.audioCtx.currentTime;
    var notes = [523.25, 659.25, 783.99, 1046.50]; // C Major
    notes.forEach((freq, i) => {
        var osc = this.audioCtx.createOscillator();
        var gain = this.audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.05, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.5);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.5);
    });
};

SoundManager.prototype.playGameOverSound = function () {
    var now = this.audioCtx.currentTime;
    var osc = this.audioCtx.createOscillator();
    var gain = this.audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 1);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 1);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    osc.stop(now + 1);
};
