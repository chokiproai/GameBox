const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Constants from original repo
const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 650;
const MIN_PIPE_GAP = 170;
const MAX_PIPE_GAP = 200;
const MIN_PIPE_HEIGHT = 100;
const MAX_PIPE_HEIGHT = 300;
const PIPE_WIDTH = 100;
const MAX_PIPE_OFFSET = 400;
const MIN_PIPE_OFFSET = 300;
const PIPE_SPEED = 2;
const BIRD_SIZE = { width: 70, height: 50 };
const BIRD_ANIMATION_FRAMES = [200, 272, 344, 416]; // X coordinates in sprite sheet?
const FLOOR_OFFSET = 70;

// Set canvas size
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Assets
const sprite = new Image();
sprite.src = 'assets/sprite.png';

const bgImage = new Image();
bgImage.src = 'assets/background.png';

// Game State
let frames = 0;
let score = 0;
let bestScore = localStorage.getItem('flappy_best_score') || 0;
let gameStart = false;
let gameOver = false;

// Objects
const bird = {
    x: (CANVAS_WIDTH / 2) - (BIRD_SIZE.height / 2), // Note: Original code swaps width/height in position calc?
    y: (CANVAS_HEIGHT / 2) - (BIRD_SIZE.width / 2),
    velocity: 0,
    gravity: 0.5,
    lift: -8,
    frame: 0,
    rotation: 0,

    draw: function () {
        if (!gameOver) this.frame++;
        let animationFrameIndex = Math.floor(this.frame / 8) % 4;
        let sx = BIRD_ANIMATION_FRAMES[animationFrameIndex];

        ctx.save();
        ctx.translate(this.x + BIRD_SIZE.width / 2, this.y + BIRD_SIZE.height / 2);
        ctx.rotate(this.rotation * Math.PI / 180);

        // Draw bird from sprite
        // Assuming sprite layout based on p5 code: 
        // p5.image(img, dx, dy, dWidth, dHeight, sx, sy, sWidth, sHeight)
        // Original: image(this.image, 0, 0, BIRDSIZE.Width, BIRDSIZE.Height, BIRDANIMATIONFRAME[animationFrame], 0, BIRDSIZE.Width, BIRDSIZE.Height);
        // So sx is BIRDANIMATIONFRAME[animationFrame], sy is 0.
        ctx.drawImage(sprite, sx, 0, BIRD_SIZE.width, BIRD_SIZE.height, -BIRD_SIZE.width / 2, -BIRD_SIZE.height / 2, BIRD_SIZE.width, BIRD_SIZE.height);

        ctx.restore();
    },

    update: function () {
        this.velocity += this.gravity;
        this.y += this.velocity;

        // Rotation logic from original
        if (this.velocity > 8) this.rotation = 0;
        if (this.velocity > 9) this.rotation = 22.5;
        if (this.velocity > 10) this.rotation = 45;
        if (this.velocity > 11) this.rotation = 67.5;
        if (this.velocity > 12) this.rotation = 90;

        if (this.velocity > 15) this.velocity = 15;

        // Floor collision
        if (this.y >= CANVAS_HEIGHT - BIRD_SIZE.height - FLOOR_OFFSET) {
            this.y = CANVAS_HEIGHT - BIRD_SIZE.height - FLOOR_OFFSET;
            this.velocity = 0;
            gameOver = true;
        }
    },

    jump: function () {
        this.velocity = this.lift;
        this.rotation = -25;
    },

    reset: function () {
        this.y = (CANVAS_HEIGHT / 2) - (BIRD_SIZE.width / 2);
        this.velocity = 0;
        this.rotation = 0;
        this.frame = 0;
    }
};

const pipes = {
    items: [],

    generate: function () {
        const height = Math.floor(Math.random() * (MAX_PIPE_HEIGHT - MIN_PIPE_HEIGHT + 1) + MIN_PIPE_HEIGHT);
        const gap = Math.floor(Math.random() * (MAX_PIPE_GAP - MIN_PIPE_GAP + 1) + MIN_PIPE_GAP);
        // Offset is distance from right edge? No, original uses offset from right.
        // Let's stick to standard canvas logic: x position.
        // Original logic: offset increases, drawn at CANVAS_WIDTH - offset.
        // Let's simplify: store x position.
        this.items.push({
            x: CANVAS_WIDTH,
            height: height,
            gap: gap,
            passed: false
        });
    },

    update: function () {
        // Add new pipe
        if (this.items.length === 0 || CANVAS_WIDTH - this.items[this.items.length - 1].x > Math.floor(Math.random() * (MAX_PIPE_OFFSET - MIN_PIPE_OFFSET + 1) + MIN_PIPE_OFFSET)) {
            this.generate();
        }

        const level = Math.floor(score / 10);

        for (let i = 0; i < this.items.length; i++) {
            let p = this.items[i];
            p.x -= (PIPE_SPEED + level);

            // Remove off-screen pipes
            if (p.x + PIPE_WIDTH < 0) {
                this.items.shift();
                i--;
                continue;
            }

            // Collision
            // Bird AABB
            let bx = bird.x;
            let by = bird.y;
            let bw = BIRD_SIZE.width;
            let bh = BIRD_SIZE.height;

            // Pipe AABB
            // Top Pipe
            let tx = p.x;
            let ty = 0;
            let tw = PIPE_WIDTH;
            let th = p.height;

            // Bottom Pipe
            let bx_pipe = p.x;
            let by_pipe = p.height + p.gap;
            let bw_pipe = PIPE_WIDTH;
            let bh_pipe = CANVAS_HEIGHT - p.height - p.gap - FLOOR_OFFSET;

            // Check collision
            if (
                (bx < tx + tw && bx + bw > tx && by < ty + th && by + bh > ty) || // Top pipe
                (bx < bx_pipe + bw_pipe && bx + bw > bx_pipe && by < by_pipe + bh_pipe && by + bh > by_pipe) // Bottom pipe
            ) {
                gameOver = true;
            }

            // Score
            if (!p.passed && bx > p.x + PIPE_WIDTH) {
                score++;
                p.passed = true;
                if (score > bestScore) {
                    bestScore = score;
                    localStorage.setItem('flappy_best_score', bestScore);
                }
            }
        }
    },

    draw: function () {
        for (let i = 0; i < this.items.length; i++) {
            let p = this.items[i];

            // Draw Top Pipe
            // Original: image(this.image, CANVAS_WIDTH - pipe.offset, 0, PIPE_WIDTH, pipe.height, PIPE_WIDTH, 500 - pipe.height, PIPE_WIDTH, pipe.height);
            // sx = PIPE_WIDTH, sy = 500 - pipe.height (This seems to imply sprite sheet layout)
            // Let's assume the sprite sheet has pipes. 
            // Based on original code: 
            // Top pipe source: sx=100, sy=500-height, sw=100, sh=height
            // Bottom pipe source: sx=0, sy=0, sw=100, sh=...

            // Wait, looking at original code:
            // Top Pipe: sx=PIPE_WIDTH (100), sy=500-pipe.height? 
            // Bottom Pipe: sx=0, sy=0?

            // Let's try to infer from common sprite sheets or just use what's there.
            // If I can't see the sprite, I'll trust the original code's slicing.

            // Top Pipe
            ctx.drawImage(sprite, PIPE_WIDTH, 500 - p.height, PIPE_WIDTH, p.height, p.x, 0, PIPE_WIDTH, p.height);

            // Bottom Pipe
            // Original: image(this.image, ..., pipe.height + pipe.gap, ..., ..., 0, 0, PIPE_WIDTH, ...)
            // sx=0, sy=0
            let bottomPipeHeight = CANVAS_HEIGHT - p.height - p.gap - FLOOR_OFFSET;
            ctx.drawImage(sprite, 0, 0, PIPE_WIDTH, bottomPipeHeight, p.x, p.height + p.gap, PIPE_WIDTH, bottomPipeHeight);
        }
    },

    reset: function () {
        this.items = [];
        this.generate(); // Start with one pipe? Original generates first at -300 offset.
        this.items[0].x = CANVAS_WIDTH + 300; // Delay first pipe
    }
};

const floor = {
    x: 0,
    draw: function () {
        // Floor is likely at the bottom of sprite or separate?
        // Original: floor.js not read, but likely simple.
        // Let's assume standard floor drawing or use a color if sprite not clear.
        // Actually, let's just draw a rect for now or try to find it in sprite.
        // Original code imports Floor from './game/floor'. Let's assume it uses sprite.
        // I'll just draw a solid color for floor to be safe or check floor.js if needed.
        // But wait, I have the sprite.png.
        // Let's use a pattern or color.
        ctx.fillStyle = '#ded895';
        ctx.fillRect(0, CANVAS_HEIGHT - FLOOR_OFFSET, CANVAS_WIDTH, FLOOR_OFFSET);

        // Grass line
        ctx.fillStyle = '#73bf2e';
        ctx.fillRect(0, CANVAS_HEIGHT - FLOOR_OFFSET, CANVAS_WIDTH, 20);
    },
    update: function () {
        // Scroll floor?
    }
};

const gameText = {
    draw: function () {
        ctx.fillStyle = "white";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.font = "40px FlappyBirdy";
        ctx.textAlign = "center";

        if (!gameStart) {
            ctx.fillText("Get Ready", CANVAS_WIDTH / 2, 150);
            ctx.strokeText("Get Ready", CANVAS_WIDTH / 2, 150);
            ctx.font = "20px FlappyBirdy";
            ctx.fillText("Tap to Fly", CANVAS_WIDTH / 2, 200);
        } else if (gameOver) {
            ctx.font = "50px FlappyBirdy";
            ctx.fillText("Game Over", CANVAS_WIDTH / 2, 150);
            ctx.strokeText("Game Over", CANVAS_WIDTH / 2, 150);

            ctx.font = "30px FlappyBirdy";
            ctx.fillText("Score: " + score, CANVAS_WIDTH / 2, 220);
            ctx.strokeText("Score: " + score, CANVAS_WIDTH / 2, 220);

            ctx.fillText("Best: " + bestScore, CANVAS_WIDTH / 2, 260);
            ctx.strokeText("Best: " + bestScore, CANVAS_WIDTH / 2, 260);

            // Restart button
            ctx.fillStyle = "#f4703a";
            ctx.fillRect(CANVAS_WIDTH / 2 - 50, 300, 100, 40);
            ctx.fillStyle = "white";
            ctx.font = "20px FlappyBirdy";
            ctx.fillText("RESTART", CANVAS_WIDTH / 2, 325);
        } else {
            ctx.font = "50px FlappyBirdy";
            ctx.fillText(score, CANVAS_WIDTH / 2, 80);
            ctx.strokeText(score, CANVAS_WIDTH / 2, 80);
        }
    }
};

function resetGame() {
    bird.reset();
    pipes.reset();
    score = 0;
    gameStart = false;
    gameOver = false;
    frames = 0;
}

function loop() {
    // Background
    ctx.drawImage(bgImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (gameStart && !gameOver) {
        pipes.update();
        bird.update();
        floor.update();
    } else if (gameOver) {
        bird.update(); // Bird falls to ground
    }

    pipes.draw();
    floor.draw();
    bird.draw();
    gameText.draw();

    frames++;
    requestAnimationFrame(loop);
}

// Input
canvas.addEventListener('click', function (evt) {
    if (gameOver) {
        let rect = canvas.getBoundingClientRect();
        let x = (evt.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
        let y = (evt.clientY - rect.top) * (CANVAS_HEIGHT / rect.height);

        // Restart button check
        if (x > CANVAS_WIDTH / 2 - 50 && x < CANVAS_WIDTH / 2 + 50 && y > 300 && y < 340) {
            resetGame();
        }
    } else {
        if (!gameStart) gameStart = true;
        bird.jump();
    }
});

window.addEventListener('keydown', function (evt) {
    if (evt.code === 'Space') {
        if (gameOver) {
            resetGame();
        } else {
            if (!gameStart) gameStart = true;
            bird.jump();
        }
    }
});

// Start
pipes.reset();
loop();
