const board = document.querySelector('#game-board');
const paddle = document.querySelector('#paddle');
const ball = document.querySelector('#ball');
const scoreText = document.querySelector('#score');
const livesText = document.querySelector('#lives');
const bonusScoreText = document.querySelector('#bonus-score');
const message = document.querySelector('#message');
const startButton = document.querySelector('#start-button');
const pauseButton = document.querySelector('#pause-button');
const resetButton = document.querySelector('#reset-button');
const helpButton = document.querySelector('#help-button');
const helpDialog = document.querySelector('#help-dialog');
const closeHelpButton = document.querySelector('#close-help-button');
const confetti = document.querySelector('#confetti');

let score = 0;
let bonusScore = 0;
let lives = 3;
let paddleX = 0;
let ballX = 0;
let ballY = 0;
let ballSpeedX = 2.2;
let ballSpeedY = -2.2;
let bonusObjects = [];
let gameRunning = false;
let gamePaused = false;
let animationId;
let keysPressed = {};

function createBricks() {
	const brickCount = 28;
	const brickHeight = 22;
	const gap = 8;
	const columns = board.clientWidth < 620 ? 5 : 7;
	const brickWidth = (board.clientWidth - gap * (columns + 1)) / columns;
	const brickColors = ['yellow', 'teal', 'orange'];

	for (let index = 0; index < brickCount; index += 1) {
		const brick = document.createElement('div');
		brick.className = `brick ${brickColors[index % brickColors.length]}`;
		brick.style.width = `${brickWidth}px`;
		brick.style.left = `${(index % columns) * (brickWidth + gap) + gap}px`;
		brick.style.top = `${Math.floor(index / columns) * (brickHeight + gap) + 38}px`;
		brick.dataset.dirty = Math.random() < 0.15 ? 'true' : 'false';
		brick.dataset.bonus = brick.dataset.dirty === 'false' && Math.random() < 0.25 ? 'true' : 'false';
		board.appendChild(brick);
	}
}

function resetBall() {
	ballX = board.clientWidth / 2 - 8;
	ballY = board.clientHeight - 62;
	ballSpeedX = Math.random() > 0.5 ? 2.2 : -2.2;
	ballSpeedY = -2.2;
	paddleX = board.clientWidth / 2 - 55;
	drawGame();
}

function drawGame() {
	paddle.style.left = `${paddleX}px`;
	ball.style.left = `${ballX}px`;
	ball.style.top = `${ballY}px`;
	scoreText.textContent = score;
	livesText.textContent = lives;
	bonusScoreText.textContent = bonusScore;
}

function rectanglesOverlap(first, second) {
	return first.left < second.right && first.right > second.left &&
		first.top < second.bottom && first.bottom > second.top;
}

function dropBonus(brick, isDirty) {
	const bonus = document.createElement('div');
	bonus.className = isDirty ? 'bonus dirty-bonus' : 'bonus';
	bonus.innerHTML = isDirty ? '<span class="dirty-drop" aria-label="Dirty water"></span>' : Math.random() > 0.5
		? '<img src="img/water-can.png" alt="">'
		: '<span aria-hidden="true">💧</span>';
	bonus.style.left = brick.style.left;
	bonus.style.top = brick.style.top;
	board.appendChild(bonus);
	bonusObjects.push({ element: bonus, x: parseFloat(brick.style.left), y: parseFloat(brick.style.top), isDirty });
}

function clearConfetti() {
	confetti.replaceChildren();
}

function showConfetti() {
	const colors = ['#ffc907', '#2e9df7', '#8bd1cb', '#ff902a', '#f16061'];

	// Create small paper pieces with different positions and fall speeds.
	for (let index = 0; index < 80; index += 1) {
		const piece = document.createElement('span');
		piece.className = 'confetti-piece';
		piece.style.setProperty('--confetti-left', `${Math.random() * 100}%`);
		piece.style.setProperty('--confetti-color', colors[index % colors.length]);
		piece.style.setProperty('--confetti-delay', `${Math.random() * 0.8}s`);
		piece.style.setProperty('--confetti-duration', `${1.8 + Math.random() * 1.4}s`);
		piece.style.setProperty('--confetti-rotation', `${Math.random() * 360}deg`);
		confetti.appendChild(piece);
	}
}

function updateBonuses() {
	const paddleBox = paddle.getBoundingClientRect();
	bonusObjects = bonusObjects.filter((bonus) => {
		bonus.y += 1.4;
		bonus.element.style.top = `${bonus.y}px`;
		const bonusBox = bonus.element.getBoundingClientRect();

		if (rectanglesOverlap(bonusBox, paddleBox)) {
			if (bonus.isDirty) {
				score = Math.max(0, score - bonusScore * 25);
				bonusScore = 0;
			} else {
				bonusScore += 1;
				score += 25;
			}
			bonus.element.remove();
			return false;
		}

		if (bonus.y > board.clientHeight) {
			bonus.element.remove();
			return false;
		}
		return true;
	});
}

function loseLife() {
	lives -= 1;
	if (lives === 0) {
		endGame('Game over', `You scored ${score} points. Ready for another round?`);
	} else {
		resetBall();
	}
}

function endGame(title, copy) {
	gameRunning = false;
	gamePaused = false;
	cancelAnimationFrame(animationId);
	pauseButton.disabled = true;
	pauseButton.textContent = 'Pause';
	message.querySelector('h2').textContent = title;
	message.querySelector('p').textContent = copy;
	startButton.textContent = 'Play again';
	startButton.hidden = false;
	message.classList.remove('hidden');
}

function moveBall() {
	if (!gameRunning || gamePaused) return;

	const boardWidth = board.clientWidth;
	const boardHeight = board.clientHeight;
	const paddleBox = paddle.getBoundingClientRect();
	const ballBox = ball.getBoundingClientRect();

	// Holding a key keeps the paddle moving instead of requiring repeated taps.
	if (keysPressed.ArrowLeft || keysPressed.a) paddleX -= 8;
	if (keysPressed.ArrowRight || keysPressed.d) paddleX += 8;
	paddleX = Math.max(0, Math.min(boardWidth - paddle.offsetWidth, paddleX));

	ballX += ballSpeedX;
	ballY += ballSpeedY;

	if (ballX <= 0 || ballX + ball.offsetWidth >= boardWidth) ballSpeedX *= -1;
	if (ballY <= 0) ballSpeedY *= -1;

	if (rectanglesOverlap(ballBox, paddleBox) && ballSpeedY > 0) {
		ballSpeedY = -Math.abs(ballSpeedY);
		ballSpeedX = ((ballX + 8) - (paddleX + 55)) / 12;
	}

	document.querySelectorAll('.brick').forEach((brick) => {
		if (rectanglesOverlap(ballBox, brick.getBoundingClientRect())) {
			if (brick.dataset.dirty === 'true') {
				dropBonus(brick, true);
			} else if (brick.dataset.bonus === 'true') {
				dropBonus(brick, false);
			}
			brick.remove();
			score += 10;
			ballSpeedY *= -1;
		}
	});

	if (ballY > boardHeight) loseLife();
	updateBonuses();
	drawGame();

	if (lives > 0 && document.querySelectorAll('.brick').length === 0) {
		showConfetti();
		endGame('You made a splash!', `You cleared the board with ${score} points.`);
	} else {
		animationId = requestAnimationFrame(moveBall);
	}
}

function startGame() {
	document.querySelectorAll('.brick, .bonus').forEach((item) => item.remove());
	clearConfetti();
	score = 0;
	bonusScore = 0;
	lives = 3;
	bonusObjects = [];
	createBricks();
	resetBall();
	message.classList.add('hidden');
	startButton.hidden = false;
	gameRunning = true;
	gamePaused = false;
	pauseButton.disabled = false;
	pauseButton.textContent = 'Pause';
	board.focus();
	moveBall();
}

function togglePause() {
	if (!gameRunning) return;

	gamePaused = !gamePaused;
	pauseButton.textContent = gamePaused ? 'Play' : 'Pause';

	if (gamePaused) {
		cancelAnimationFrame(animationId);
		keysPressed = {};
		message.querySelector('h2').textContent = 'Game paused';
		message.querySelector('p').textContent = 'Press Play when you are ready to continue.';
		startButton.hidden = true;
		message.classList.remove('hidden');
	} else {
		message.classList.add('hidden');
		moveBall();
	}
}

function resetGame() {
	cancelAnimationFrame(animationId);
	document.querySelectorAll('.brick, .bonus').forEach((item) => item.remove());
	clearConfetti();
	score = 0;
	bonusScore = 0;
	lives = 3;
	bonusObjects = [];
	gameRunning = false;
	gamePaused = false;
	createBricks();
	resetBall();
	pauseButton.disabled = true;
	pauseButton.textContent = 'Pause';
	message.querySelector('h2').textContent = 'Ready to make a splash?';
	message.querySelector('p').textContent = 'Move with the arrow keys or A and D.';
	startButton.textContent = 'Start game';
	startButton.hidden = false;
	message.classList.remove('hidden');
}

document.addEventListener('keydown', (event) => {
	const key = event.key.toLowerCase();
	if (key === 'arrowleft' || key === 'arrowright' || key === 'a' || key === 'd') {
		event.preventDefault();
		keysPressed[event.key] = true;
		keysPressed[key] = true;
	}
});

document.addEventListener('keyup', (event) => {
	const key = event.key.toLowerCase();
	keysPressed[event.key] = false;
	keysPressed[key] = false;
});

board.addEventListener('pointermove', (event) => {
	if (!gameRunning || gamePaused) return;
	const boardBox = board.getBoundingClientRect();
	paddleX = event.clientX - boardBox.left - paddle.offsetWidth / 2;
	paddleX = Math.max(0, Math.min(board.clientWidth - paddle.offsetWidth, paddleX));
	drawGame();
});

startButton.addEventListener('click', startGame);
pauseButton.addEventListener('click', togglePause);
resetButton.addEventListener('click', resetGame);
helpButton.addEventListener('click', () => helpDialog.showModal());
closeHelpButton.addEventListener('click', () => helpDialog.close());
window.addEventListener('resize', () => {
	paddleX = Math.max(0, Math.min(board.clientWidth - paddle.offsetWidth, paddleX));
	drawGame();
});

drawGame();
