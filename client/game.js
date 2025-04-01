const socket = new WebSocket('ws://localhost:3000');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let playerId, snake = [], direction = 'right', gameState = {};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'roomCreated') {
        alert(`Mã phòng: ${data.roomCode}`);
    } else if (data.type === 'joined') {
        document.getElementById('roomSetup').style.display = 'none';
    } else if (data.type === 'start') {
        playerId = data.playerId;
        snake = [{ x: playerId * 10, y: 10 }];
        gameLoop();
    } else if (data.type === 'update') {
        gameState = data.gameState;
    }
};

function createRoom() {
    socket.send(JSON.stringify({ type: 'create' }));
}

function joinRoom() {
    const roomCode = document.getElementById('roomCode').value;
    socket.send(JSON.stringify({ type: 'join', roomCode }));
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' && direction !== 'down') direction = 'up';
    if (e.key === 'ArrowDown' && direction !== 'up') direction = 'down';
    if (e.key === 'ArrowLeft' && direction !== 'right') direction = 'left';
    if (e.key === 'ArrowRight' && direction !== 'left') direction = 'right';
});

function gameLoop() {
    const head = { x: snake[0].x, y: snake[0].y };
    if (direction === 'up') head.y -= 10;
    if (direction === 'down') head.y += 10;
    if (direction === 'left') head.x -= 10;
    if (direction === 'right') head.x += 10;
    snake.unshift(head);
    snake.pop();

    socket.send(JSON.stringify({ type: 'move', playerId, position: snake }));

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    snake.forEach(s => {
        ctx.fillStyle = playerId === 0 ? 'blue' : 'red';
        ctx.fillRect(s.x, s.y, 10, 10);
    });
    for (let id in gameState) {
        if (id !== `player${playerId}`) {
            gameState[id].forEach(s => {
                ctx.fillStyle = id === 'player0' ? 'blue' : 'red';
                ctx.fillRect(s.x, s.y, 10, 10);
            });
        }
    }

    setTimeout(gameLoop, 100);
}