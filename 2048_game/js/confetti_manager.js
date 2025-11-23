function ConfettiManager() {
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '9999';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.animating = false;

    window.addEventListener('resize', this.resize.bind(this));
    this.resize();
}

ConfettiManager.prototype.resize = function () {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
};

ConfettiManager.prototype.start = function () {
    if (this.animating) return;
    this.animating = true;
    for (var i = 0; i < 100; i++) {
        this.particles.push(this.createParticle());
    }
    this.animate();
};

ConfettiManager.prototype.createParticle = function () {
    return {
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height - this.canvas.height,
        vx: Math.random() * 4 - 2,
        vy: Math.random() * 4 + 2,
        color: 'hsl(' + Math.random() * 360 + ', 100%, 50%)',
        size: Math.random() * 10 + 5,
        rotation: Math.random() * 360,
        vRotation: Math.random() * 10 - 5
    };
};

ConfettiManager.prototype.animate = function () {
    if (!this.animating) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (var i = 0; i < this.particles.length; i++) {
        var p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vRotation;

        if (p.y > this.canvas.height) {
            p.y = -20;
            p.x = Math.random() * this.canvas.width;
        }

        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rotation * Math.PI / 180);
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        this.ctx.restore();
    }

    requestAnimationFrame(this.animate.bind(this));
};

ConfettiManager.prototype.stop = function () {
    this.animating = false;
    this.particles = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
};
