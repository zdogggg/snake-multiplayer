const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 3000 });

const rooms = new Map();

function generateFood() {
    return {
        x: Math.floor(Math.random() * 40) * 10,
        y: Math.floor(Math.random() * 40) * 10
    };
}

server.on('connection', (socket) => {
    console.log('A player connected!');

    socket.on('message', (message) => {
        const data = JSON.parse(message);
        console.log('Received from client:', data);

        if (data.type === 'create') {
            // Tạo mã phòng ngẫu nhiên 5 chữ số
            const roomCode = Math.floor(10000 + Math.random() * 90000).toString();
            rooms.set(roomCode, { 
                players: [socket], 
                gameState: { 
                    food: generateFood(), 
                    scores: [0, 0],
                    player0: { position: [{ x: 50, y: 100 }], direction: 'right' },
                    player1: { position: [], direction: 'right' },
                    isGameOver: false
                } 
            });
            console.log('Created room, code:', roomCode);
            socket.send(JSON.stringify({ type: 'roomCreated', roomCode }));
        } else if (data.type === 'join') {
            const room = rooms.get(data.roomCode);
            if (room && room.players.length < 2) {
                room.players.push(socket);
                socket.send(JSON.stringify({ type: 'joined', roomCode: data.roomCode }));
                console.log('Sending start to', room.players.length, 'players');
                room.players.forEach(player => {
                    player.send(JSON.stringify({ 
                        type: 'start', 
                        playerId: room.players.indexOf(player), 
                        food: room.gameState.food, 
                        scores: room.gameState.scores 
                    }));
                });
            } else {
                socket.send(JSON.stringify({ type: 'error', message: 'Room does not exist or is full' }));
            }
        } else if (data.type === 'move') {
            const room = Array.from(rooms.values()).find(r => r.players.includes(socket));
            if (room && !room.gameState.isGameOver) {
                room.gameState[`player${data.playerId}`].position = data.position;
                if (data.position[0].x === room.gameState.food.x && data.position[0].y === room.gameState.food.y) {
                    room.gameState.food = generateFood();
                    room.gameState.scores[data.playerId]++;
                }
                room.players.forEach(player => {
                    player.send(JSON.stringify({ type: 'update', gameState: room.gameState }));
                });
            }
        } else if (data.type === 'changeDirection') {
            const room = Array.from(rooms.values()).find(r => r.players.includes(socket));
            if (room && !room.gameState.isGameOver) {
                room.gameState[`player${data.playerId}`].direction = data.direction;
                room.players.forEach(player => {
                    player.send(JSON.stringify({ type: 'update', gameState: room.gameState }));
                });
            }
        } else if (data.type === 'gameOver') {
            const room = Array.from(rooms.values()).find(r => r.players.includes(socket));
            if (room) {
                room.gameState.isGameOver = true;
                room.players.forEach(player => {
                    player.send(JSON.stringify({ type: 'gameOver', playerId: data.playerId }));
                });
            }
        } else if (data.type === 'reset') {
            const room = rooms.get(data.roomCode);
            if (room) {
                room.gameState = {
                    food: generateFood(),
                    scores: [0, 0],
                    player0: { position: [{ x: 50, y: 100 }], direction: 'right' },
                    player1: { position: [], direction: 'right' },
                    isGameOver: false
                };
                console.log('Reset game for room:', data.roomCode);
                room.players.forEach(player => {
                    player.send(JSON.stringify({ type: 'reset' }));
                });
                room.players.forEach(player => {
                    player.send(JSON.stringify({ 
                        type: 'start', 
                        playerId: room.players.indexOf(player), 
                        food: room.gameState.food, 
                        scores: room.gameState.scores 
                    }));
                });
            }
        }
    });

    socket.on('close', () => {
        console.log('A player disconnected');
        for (let [roomCode, room] of rooms) {
            const disconnectedPlayerIndex = room.players.indexOf(socket);
            if (disconnectedPlayerIndex !== -1) {
                room.players = room.players.filter(p => p !== socket);
                // Gửi thông báo tới người chơi còn lại
                if (room.players.length > 0) {
                    room.players.forEach(player => {
                        player.send(JSON.stringify({
                            type: 'opponentDisconnected',
                            message: 'Player has disconnected the game'
                        }));
                    });
                }
                // Xóa phòng nếu không còn người chơi
                if (room.players.length === 0) {
                    rooms.delete(roomCode);
                }
            }
        }
    });
});

console.log('Server running at ws://192.168.1.11:3000');