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
const milestoneCelebration = document.querySelector('#milestone-celebration');
const difficultyOptionsContainer = document.querySelector('#difficulty-options');
const difficultyOptions = document.querySelectorAll('input[name="difficulty"]');

function createSound(path) {
	const sound = new Audio(path);
	sound.preload = 'auto';
	return sound;
}

const sounds = {
	start: createSound('audio/start.mp3'),
	gameOver: createSound('audio/over.mp3'),
	win: createSound('audio/yay.mp3'),
	dirtyWater: createSound('audio/ohno.mp3'),
	bonus: createSound('audio/bonus.mp3'),
	milestone: createSound('audio/milestone.mp3')
};

let score = 0;
let bonusScore = 0;
let lives = 3;
let selectedDifficulty = '';
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
let celebratedMilestones = [];

function playSound(sound) {
	sound.currentTime = 0;
	const playPromise = sound.play();

	if (playPromise !== undefined) {
		playPromise.catch((error) => {
			console.warn('Unable to play game sound.', error);
		});
	}
}

function primeSounds() {
	Object.values(sounds).filter((sound) => sound !== sounds.start).forEach((sound) => {
		const originalVolume = sound.volume;
		sound.volume = 0;
		const playPromise = sound.play();

		if (playPromise !== undefined) {
			playPromise.then(() => {
				sound.pause();
				sound.currentTime = 0;
				sound.volume = originalVolume;
			}).catch((error) => {
				sound.volume = originalVolume;
				console.warn('Unable to prepare game sound.', error);
			});
		}
	});
}

function createBricks() {
	const brickCount = 42;
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

function showCelebration(text, isWarning = false) {
	milestoneCelebration.textContent = text;
	milestoneCelebration.classList.toggle('warning', isWarning);
	milestoneCelebration.classList.remove('show');
	void milestoneCelebration.offsetWidth;
	milestoneCelebration.classList.add('show');
}

function checkMilestones() {
	const milestones = [150, 300];
	for (let milestone = 400; milestone <= score; milestone += 100) {
		milestones.push(milestone);
	}
	const milestone = milestones.find((value) => score >= value && !celebratedMilestones.includes(value));

	if (!milestone) return;

	celebratedMilestones.push(milestone);
	const celebrationMessages = ['wow!', 'keep going!', 'Good job!'];
	const randomMessage = celebrationMessages[Math.floor(Math.random() * celebrationMessages.length)];
	showCelebration(`${milestone} points! ${randomMessage}`);
	playSound(sounds.milestone);
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
				celebratedMilestones = celebratedMilestones.filter((milestone) => score >= milestone);
				showCelebration('Oh no!', true);
				playSound(sounds.dirtyWater);
			} else {
				bonusScore += 1;
				score += 25;
				playSound(sounds.bonus);
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
		playSound(sounds.gameOver);
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
	difficultyOptionsContainer.hidden = true;
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
	checkMilestones();
	drawGame();

	if (lives > 0 && document.querySelectorAll('.brick').length === 0) {
		showConfetti();
		playSound(sounds.win);
		endGame('You made a splash!', `You cleared the board with ${score} points.`);
	} else {
		animationId = requestAnimationFrame(moveBall);
	}
}

function startGame() {
	if (!selectedDifficulty) return;

	primeSounds();
	playSound(sounds.start);
	document.querySelectorAll('.brick, .bonus').forEach((item) => item.remove());
	clearConfetti();
	score = 0;
	bonusScore = 0;
	celebratedMilestones = [];
	const startingBalls = { easy: 5, normal: 3, hard: 1 };
	lives = startingBalls[selectedDifficulty];
	bonusObjects = [];
	createBricks();
	resetBall();
	message.classList.add('hidden');
	difficultyOptionsContainer.hidden = true;
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
		difficultyOptionsContainer.hidden = true;
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
	celebratedMilestones = [];
	lives = selectedDifficulty ? { easy: 5, normal: 3, hard: 1 }[selectedDifficulty] : 3;
	bonusObjects = [];
	gameRunning = false;
	gamePaused = false;
	createBricks();
	resetBall();
	pauseButton.disabled = true;
	pauseButton.textContent = 'Pause';
	message.querySelector('h2').textContent = 'Choose a difficulty';
	message.querySelector('p').textContent = 'Move with the arrow keys or A and D.';
	difficultyOptionsContainer.hidden = false;
	startButton.textContent = 'Start game';
	startButton.hidden = false;
	startButton.disabled = !selectedDifficulty;
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

difficultyOptions.forEach((option) => {
	option.addEventListener('change', () => {
		selectedDifficulty = option.value;
		startButton.disabled = false;
	});
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
