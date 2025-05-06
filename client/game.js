const socket = new WebSocket('ws://172.20.10.5:3000');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let playerId, snake = [], direction = 'right', gameState = {}, food = null;
let roomCode = null;
let gameLoopTimeout = null;
let isGameOver = false;
let isSpectator = false; // Biến để xác định người xem

socket.onopen = () => console.log('WebSocket connection successful');
socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    if (!isGameOver) {
        showErrorMessage('Network error occurred. Please try again.');
    }
};
socket.onclose = () => {
    console.log('WebSocket closed');
    if (!isGameOver) {
        showConnectionLostMessage();
    }
};

canvas.addEventListener('click', () => {
    canvas.focus();
    console.log('Canvas focused');
});

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Received from server:', data);
    if (data.type === 'roomCreated') {
        console.log('Room code:', data.roomCode);
        roomCode = data.roomCode;
        alert(`Room Code: ${data.roomCode}`);
    } else if (data.type === 'joined') {
        console.log('Joined room');
        roomCode = data.roomCode;
        document.getElementById('roomSetup').style.display = 'none';
        if (data.role === 'spectator') {
            isSpectator = true;
            gameState = data.gameState;
            food = gameState.food;
            document.getElementById('score1').textContent = gameState.scores[0];
            document.getElementById('score2').textContent = gameState.scores[1];
            const instructions = document.createElement('p');
            instructions.className = 'instructions';
            instructions.textContent = 'You are a spectator. Watch the game!';
            document.body.querySelector('.container').appendChild(instructions);
            renderGame(); // Bắt đầu vẽ cho spectator
        }
    } else if (data.type === 'start') {
        if (gameLoopTimeout) {
            clearTimeout(gameLoopTimeout);
        }
        isGameOver = false;
        playerId = data.playerId;
        snake = [{ x: playerId === 0 ? 50 : 150, y: 100 }];
        direction = 'right';
        food = data.food;
        gameState = { scores: data.scores };
        console.log('Game started, playerId:', playerId, 'scores:', gameState.scores);
        document.getElementById('score1').textContent = gameState.scores[0];
        document.getElementById('score2').textContent = gameState.scores[1];
        const oldInstructions = document.querySelector('.instructions');
        if (oldInstructions) oldInstructions.remove();
        const instructions = document.createElement('p');
        instructions.className = 'instructions';
        instructions.textContent = playerId === 0 ? 'Control Blue Snake: W (up), A (left), S (down), D (right)' : 'Control Red Snake: Arrow keys';
        document.body.querySelector('.container').appendChild(instructions);
        console.log('Calling gameLoop');
        gameLoop();
    } else if (data.type === 'update') {
        if (!isGameOver || (isGameOver && playerId !== undefined)) { // Cho phép người thua xem tiếp
            gameState = data.gameState;
            food = gameState.food;
            if (!isSpectator && gameState[`player${playerId}`]) {
                direction = gameState[`player${playerId}`].direction;
            }
            console.log('Updated gameState:', gameState);
            document.getElementById('score1').textContent = gameState.scores[0];
            document.getElementById('score2').textContent = gameState.scores[1];
            if (isSpectator || (isGameOver && playerId !== undefined)) {
                renderGame(); // Cập nhật giao diện cho spectator hoặc người thua
            }
        }
    } else if (data.type === 'youLost') {
        console.log('You lost, playerId:', data.playerId);
        isGameOver = true;
        if (gameLoopTimeout) {
            clearTimeout(gameLoopTimeout);
        }
        showYouLostMessage();
        // Người thua vẫn có thể xem tiếp (renderGame được gọi từ update)
    } else if (data.type === 'summary') {
        console.log('Game summary:', data);
        isGameOver = true;
        if (gameLoopTimeout) {
            clearTimeout(gameLoopTimeout);
        }
        showGameSummary(data.scores, data.winnerMessage);
    } else if (data.type === 'opponentDisconnected') {
        console.log('Opponent disconnected');
        isGameOver = true;
        if (gameLoopTimeout) {
            clearTimeout(gameLoopTimeout);
        }
        showOpponentDisconnectedMessage(data.message);
    } else if (data.type === 'playerDisconnected') {
        console.log('A player disconnected, playerId:', data.playerId);
        if (isSpectator) {
            const message = `Player ${data.playerId + 1} has disconnected.`; // Đổi Player 0/1 thành Player 1/2
            showMessage(message);
        }
    } else if (data.type === 'reset') {
        const overlay = document.getElementById('gameOverOverlay');
        if (overlay) {
            document.body.removeChild(overlay);
        }
        if (isSpectator) {
            isGameOver = false;
            renderGame();
        }
    } else if (data.type === 'error') {
        console.log('Server error:', data.message);
        isGameOver = true;
        if (gameLoopTimeout) {
            clearTimeout(gameLoopTimeout);
        }
        showErrorMessage(data.message);
    }
};

function createRoom() {
    console.log('Sending create room request');
    socket.send(JSON.stringify({ type: 'create' }));
}

function joinRoom() {
    const roomCodeInput = document.getElementById('roomCode').value;
    console.log('Sending join room request:', roomCodeInput);
    socket.send(JSON.stringify({ type: 'join', roomCode: roomCodeInput }));
}

function showYouLostMessage() {
    const oldOverlay = document.getElementById('gameOverOverlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gameOverOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0, 0, 0, 0.7)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '1000';

    const messageBox = document.createElement('div');
    messageBox.style.background = '#fff';
    messageBox.style.padding = '20px';
    messageBox.style.borderRadius = '10px';
    messageBox.style.textAlign = 'center';

    const text = document.createElement('p');
    text.textContent = 'You Lost! You can watch the other player.';
    text.style.fontFamily = 'Press Start 2P, cursive';
    text.style.color = '#000';
    text.style.marginBottom = '20px';

    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.style.padding = '10px 20px';
    okBtn.style.fontFamily = 'Press Start 2P, cursive';
    okBtn.style.fontSize = '1rem';
    okBtn.style.background = '#00ff00';
    okBtn.style.color = '#000';
    okBtn.style.border = 'none';
    okBtn.style.borderRadius = '5px';
    okBtn.style.cursor = 'pointer';
    okBtn.addEventListener('click', () => {
        document.body.removeChild(overlay); // Chỉ đóng thông báo, không reload
    });

    messageBox.appendChild(text);
    messageBox.appendChild(okBtn);
    overlay.appendChild(messageBox);
    document.body.appendChild(overlay);
}

function showGameSummary(scores, winnerMessage) {
    const oldOverlay = document.getElementById('gameOverOverlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gameOverOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0, 0, 0, 0.7)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '1000';

    const messageBox = document.createElement('div');
    messageBox.style.background = '#fff';
    messageBox.style.padding = '20px';
    messageBox.style.borderRadius = '10px';
    messageBox.style.textAlign = 'center';

    const title = document.createElement('p');
    title.textContent = 'Game Over!';
    title.style.fontFamily = 'Press Start 2P, cursive';
    title.style.color = '#000';
    title.style.marginBottom = '10px';

    const scoresText = document.createElement('p');
    scoresText.textContent = `Scores - Player 1 (Blue): ${scores[0]} | Player 2 (Red): ${scores[1]}`;
    scoresText.style.fontFamily = 'Press Start 2P, cursive';
    scoresText.style.color = '#000';
    scoresText.style.marginBottom = '10px';

    const winnerText = document.createElement('p');
    winnerText.textContent = winnerMessage;
    winnerText.style.fontFamily = 'Press Start 2P, cursive';
    winnerText.style.color = '#000';
    winnerText.style.marginBottom = '20px';

    const playAgainBtn = document.createElement('button');
    playAgainBtn.textContent = 'Play Again';
    playAgainBtn.style.padding = '10px 20px';
    playAgainBtn.style.fontFamily = 'Press Start 2P, cursive';
    playAgainBtn.style.fontSize = '1rem';
    playAgainBtn.style.background = '#00ff00';
    playAgainBtn.style.color = '#000';
    playAgainBtn.style.border = 'none';
    playAgainBtn.style.borderRadius = '5px';
    playAgainBtn.style.cursor = 'pointer';
    playAgainBtn.addEventListener('click', () => {
        socket.send(JSON.stringify({ type: 'reset', roomCode }));
    });

    messageBox.appendChild(title);
    messageBox.appendChild(scoresText);
    messageBox.appendChild(winnerText);
    messageBox.appendChild(playAgainBtn);
    overlay.appendChild(messageBox);
    document.body.appendChild(overlay);
}

function showOpponentDisconnectedMessage(message) {
    const oldOverlay = document.getElementById('gameOverOverlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gameOverOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0, 0, 0, 0.7)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '1000';

    const messageBox = document.createElement('div');
    messageBox.style.background = '#fff';
    messageBox.style.padding = '20px';
    messageBox.style.borderRadius = '10px';
    messageBox.style.textAlign = 'center';

    const text = document.createElement('p');
    text.textContent = message || 'Your opponent has disconnected.';
    text.style.fontFamily = 'Press Start 2P, cursive';
    text.style.color = '#000';
    text.style.marginBottom = '20px';

    const returnBtn = document.createElement('button');
    returnBtn.textContent = 'Back to Menu';
    returnBtn.style.padding = '10px 20px';
    returnBtn.style.fontFamily = 'Press Start 2P, cursive';
    returnBtn.style.fontSize = '1rem';
    returnBtn.style.background = '#ff0000';
    returnBtn.style.color = '#fff';
    returnBtn.style.border = 'none';
    returnBtn.style.borderRadius = '5px';
    returnBtn.style.cursor = 'pointer';
    returnBtn.addEventListener('click', () => {
        window.location.reload();
    });

    messageBox.appendChild(text);
    messageBox.appendChild(returnBtn);
    overlay.appendChild(messageBox);
    document.body.appendChild(overlay);
}

function showConnectionLostMessage() {
    const oldOverlay = document.getElementById('gameOverOverlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gameOverOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0, 0, 0, 0.7)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '1000';

    const messageBox = document.createElement('div');
    messageBox.style.background = '#fff';
    messageBox.style.padding = '20px';
    messageBox.style.borderRadius = '10px';
    messageBox.style.textAlign = 'center';

    const text = document.createElement('p');
    text.textContent = 'Connection lost. Please check your network.';
    text.style.fontFamily = 'Press Start 2P, cursive';
    text.style.color = '#000';
    text.style.marginBottom = '20px';

    const returnBtn = document.createElement('button');
    returnBtn.textContent = 'Back to Menu';
    returnBtn.style.padding = '10px 20px';
    returnBtn.style.fontFamily = 'Press Start 2P, cursive';
    returnBtn.style.fontSize = '1rem';
    returnBtn.style.background = '#ff0000';
    returnBtn.style.color = '#fff';
    returnBtn.style.border = 'none';
    returnBtn.style.borderRadius = '5px';
    returnBtn.style.cursor = 'pointer';
    returnBtn.addEventListener('click', () => {
        window.location.reload();
    });

    messageBox.appendChild(text);
    messageBox.appendChild(returnBtn);
    overlay.appendChild(messageBox);
    document.body.appendChild(overlay);
}

function showErrorMessage(message) {
    const oldOverlay = document.getElementById('gameOverOverlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gameOverOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0, 0, 0, 0.7)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '1000';

    const messageBox = document.createElement('div');
    messageBox.style.background = '#fff';
    messageBox.style.padding = '20px';
    messageBox.style.borderRadius = '10px';
    messageBox.style.textAlign = 'center';

    const text = document.createElement('p');
    text.textContent = message || 'An error occurred. Please try again.';
    text.style.fontFamily = 'Press Start 2P, cursive';
    text.style.color = '#000';
    text.style.marginBottom = '20px';

    const returnBtn = document.createElement('button');
    returnBtn.textContent = 'Back to Menu';
    returnBtn.style.padding = '10px 20px';
    returnBtn.style.fontFamily = 'Press Start 2P, cursive';
    returnBtn.style.fontSize = '1rem';
    returnBtn.style.background = '#ff0000';
    returnBtn.style.color = '#fff';
    returnBtn.style.border = 'none';
    returnBtn.style.borderRadius = '5px';
    returnBtn.style.cursor = 'pointer';
    returnBtn.addEventListener('click', () => {
        window.location.reload();
    });

    messageBox.appendChild(text);
    messageBox.appendChild(returnBtn);
    overlay.appendChild(messageBox);
    document.body.appendChild(overlay);
}

function showMessage(message) {
    const oldOverlay = document.getElementById('gameOverOverlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gameOverOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0, 0, 0, 0.7)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '1000';

    const messageBox = document.createElement('div');
    messageBox.style.background = '#fff';
    messageBox.style.padding = '20px';
    messageBox.style.borderRadius = '10px';
    messageBox.style.textAlign = 'center';

    const text = document.createElement('p');
    text.textContent = message;
    text.style.fontFamily = 'Press Start 2P, cursive';
    text.style.color = '#000';
    text.style.marginBottom = '20px';

    const returnBtn = document.createElement('button');
    returnBtn.textContent = 'Back to Menu';
    returnBtn.style.padding = '10px 20px';
    returnBtn.style.fontFamily = 'Press Start 2P, cursive';
    returnBtn.style.fontSize = '1rem';
    returnBtn.style.background = '#ff0000';
    returnBtn.style.color = '#fff';
    returnBtn.style.border = 'none';
    returnBtn.style.borderRadius = '5px';
    returnBtn.style.cursor = 'pointer';
    returnBtn.addEventListener('click', () => {
        window.location.reload();
    });

    messageBox.appendChild(text);
    messageBox.appendChild(returnBtn);
    overlay.appendChild(messageBox);
    document.body.appendChild(overlay);
}

document.addEventListener('keydown', (e) => {
    if (isGameOver || isSpectator) return; // Người xem và người thua không điều khiển được
    console.log('Key pressed:', e.key, 'Player:', playerId);
    const key = e.key.toLowerCase();
    let newDirection = direction;
    if (playerId === 0) {
        if (key === 'w' && direction !== 'down') newDirection = 'up';
        else if (key === 's' && direction !== 'up') newDirection = 'down';
        else if (key === 'a' && direction !== 'right') newDirection = 'left';
        else if (key === 'd' && direction !== 'left') newDirection = 'right';
    } else if (playerId === 1) {
        if (e.key === 'ArrowUp' && direction !== 'down') newDirection = 'up';
        else if (e.key === 'ArrowDown' && direction !== 'up') newDirection = 'down';
        else if (e.key === 'ArrowLeft' && direction !== 'right') newDirection = 'left';
        else if (e.key === 'ArrowRight' && direction !== 'left') newDirection = 'right';
    }
    if (newDirection !== direction) {
        direction = newDirection;
        console.log('Sending new direction:', direction);
        socket.send(JSON.stringify({ type: 'changeDirection', playerId, direction }));
    }
});

function gameLoop() {
    if (isGameOver || isSpectator) return; // Người xem và người thua không chạy gameLoop

    try {
        console.log('Running gameLoop, Direction:', direction, 'Snake:', snake);
        const head = { x: snake[0].x, y: snake[0].y };
        if (direction === 'up') head.y -= 10;
        if (direction === 'down') head.y += 10;
        if (direction === 'left') head.x -= 10;
        if (direction === 'right') head.x += 10;

        console.log('Checking wall collision:', head.x, head.y);
        if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height) {
            console.log('Wall collision, game over');
            socket.send(JSON.stringify({ type: 'gameOver', playerId }));
            return;
        }

        if (snake.length > 3) {
            for (let i = 1; i < snake.length; i++) {
                if (head.x === snake[i].x && head.y === snake[i].y) {
                    console.log('Body collision, game over');
                    socket.send(JSON.stringify({ type: 'gameOver', playerId }));
                    return;
                    }
            }
        }

        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) {
            console.log('Ate food');
        } else {
            snake.pop();
        }

        const otherPlayerId = playerId === 0 ? 'player1' : 'player0';
        if (gameState[otherPlayerId] && gameState[otherPlayerId].position) {
            const otherSnake = gameState[otherPlayerId].position;
            for (let i = 0; i < snake.length; i++) {
                for (let j = 0; j < otherSnake.length; j++) {
                    if (snake[i].x === otherSnake[j].x && snake[i].y === otherSnake[j].y) {
                        console.log('Collision with other snake (body-to-body), game over');
                        socket.send(JSON.stringify({ type: 'gameOver', playerId }));
                        return;
                    }
                }
            }
        }

        if (!isGameOver) {
            socket.send(JSON.stringify({ type: 'move', playerId, position: snake }));
        }

        renderGame();
        gameLoopTimeout = setTimeout(gameLoop, 100);
    } catch (error) {
        console.error('Error in gameLoop:', error);
    }
}

function renderGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (food) {
        ctx.fillStyle = '#ff69b4';
        ctx.beginPath();
        ctx.arc(food.x + 5, food.y + 5, 5, 0, 2 * Math.PI);
        ctx.fill();
    }

    // Vẽ rắn của người chơi hiện tại (nếu không phải spectator)
    if (!isSpectator) {
        snake.forEach(s => {
            ctx.fillStyle = playerId === 0 ? '#4b0082' : '#ff0000';
            ctx.fillRect(s.x, s.y, 10, 10);
        });
    }

    // Vẽ cả hai con rắn từ gameState (cho tất cả người chơi và người xem)
    for (let id in gameState) {
        if (id === 'player0' || id === 'player1') {
            if (gameState[id] && gameState[id].position) {
                gameState[id].position.forEach(s => {
                    ctx.fillStyle = id === 'player0' ? '#4b0082' : '#ff0000';
                    // Nếu người chơi đã thua, làm mờ rắn
                    ctx.globalAlpha = gameState[id].lost ? 0.3 : 1.0;
                    ctx.fillRect(s.x, s.y, 10, 10);
                    ctx.globalAlpha = 1.0; // Reset độ mờ
                });
            }
        }
    }

    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    if (gameState.scores) {
        if (!isSpectator) {
            // Người chơi chỉ thấy điểm của mình
            ctx.fillText(`Score: ${gameState.scores[playerId]}`, 10, 30);
        } else {
            // Người xem thấy điểm của cả hai
            ctx.fillText(`Player 1 (Blue): ${gameState.scores[0]}`, 10, 30);
            ctx.fillText(`Player 2 (Red): ${gameState.scores[1]}`, 10, 60);
        }
    }
}