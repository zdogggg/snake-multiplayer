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
    console.log('A client connected!');

    socket.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received from client:', data);

            if (data.type === 'create') {
                const roomCode = Math.floor(10000 + Math.random() * 90000).toString();
                rooms.set(roomCode, { 
                    players: [socket], 
                    spectators: [], // Danh sách người xem
                    gameState: { 
                        food: generateFood(), 
                        scores: [0, 0],
                        player0: { position: [{ x: 50, y: 100 }], direction: 'right', lost: false },
                        player1: { position: [], direction: 'right', lost: false },
                        isGameOver: false
                    } 
                });
                socket.isPlayer = true;
                socket.playerId = 0; // Gán playerId cho socket
                console.log('Created room, code:', roomCode);
                socket.send(JSON.stringify({ type: 'roomCreated', roomCode }));
            } else if (data.type === 'join') {
                const room = rooms.get(data.roomCode);
                if (room) {
                    if (room.players.length < 2) {
                        // Tham gia với tư cách người chơi
                        room.players.push(socket);
                        socket.isPlayer = true;
                        socket.playerId = 1;
                        socket.send(JSON.stringify({ type: 'joined', roomCode: data.roomCode, role: 'player' }));
                        console.log('Sending start to', room.players.length, 'players');
                        room.players.forEach(player => {
                            player.send(JSON.stringify({ 
                                type: 'start', 
                                playerId: room.players.indexOf(player), 
                                food: room.gameState.food, 
                                scores: room.gameState.scores 
                            }));
                        });
                        // Thông báo cho spectators
                        room.spectators.forEach(spectator => {
                            spectator.send(JSON.stringify({
                                type: 'update',
                                gameState: room.gameState
                            }));
                        });
                    } else {
                        // Tham gia với tư cách người xem (spectator)
                        room.spectators.push(socket);
                        socket.isPlayer = false;
                        socket.send(JSON.stringify({ 
                            type: 'joined', 
                            roomCode: data.roomCode, 
                            role: 'spectator', 
                            gameState: room.gameState 
                        }));
                        console.log('A spectator joined room:', data.roomCode);
                    }
                } else {
                    socket.send(JSON.stringify({ type: 'error', message: 'Room does not exist' }));
                }
            } else if (data.type === 'move') {
                const room = Array.from(rooms.values()).find(r => r.players.includes(socket));
                if (room && !room.gameState.isGameOver) {
                    room.gameState[`player${data.playerId}`].position = data.position;
                    if (data.position[0].x === room.gameState.food.x && data.position[0].y === room.gameState.food.y) {
                        room.gameState.food = generateFood();
                        room.gameState.scores[data.playerId]++;
                    }
                    // Gửi cập nhật cho tất cả người chơi và người xem
                    room.players.forEach(player => {
                        player.send(JSON.stringify({ type: 'update', gameState: room.gameState }));
                    });
                    room.spectators.forEach(spectator => {
                        spectator.send(JSON.stringify({ type: 'update', gameState: room.gameState }));
                    });
                }
            } else if (data.type === 'changeDirection') {
                const room = Array.from(rooms.values()).find(r => r.players.includes(socket));
                if (room && !room.gameState.isGameOver) {
                    room.gameState[`player${data.playerId}`].direction = data.direction;
                    room.players.forEach(player => {
                        player.send(JSON.stringify({ type: 'update', gameState: room.gameState }));
                    });
                    room.spectators.forEach(spectator => {
                        spectator.send(JSON.stringify({ type: 'update', gameState: room.gameState }));
                    });
                }
            } else if (data.type === 'gameOver') {
                const room = Array.from(rooms.values()).find(r => r.players.includes(socket));
                if (room) {
                    // Đánh dấu người chơi này đã thua
                    room.gameState[`player${data.playerId}`].lost = true;
                    // Gửi thông báo chỉ cho người thua
                    socket.send(JSON.stringify({ type: 'youLost', playerId: data.playerId }));
                    console.log(`Player ${data.playerId} lost in room ${data.roomCode}`);
                    // Kiểm tra nếu cả hai người chơi đều thua
                    if (room.gameState.player0.lost && room.gameState.player1.lost) {
                        room.gameState.isGameOver = true;
                        // Tính toán người thắng
                        let winnerMessage;
                        if (room.gameState.scores[0] > room.gameState.scores[1]) {
                            winnerMessage = 'Player 1 (Blue) wins!';
                        } else if (room.gameState.scores[1] > room.gameState.scores[0]) {
                            winnerMessage = 'Player 2 (Red) wins!';
                        } else {
                            winnerMessage = 'It\'s a tie!';
                        }
                        // Gửi thông điệp tổng kết cho tất cả người chơi và người xem
                        const summary = {
                            type: 'summary',
                            scores: room.gameState.scores,
                            winnerMessage: winnerMessage
                        };
                        room.players.forEach(player => {
                            player.send(JSON.stringify(summary));
                        });
                        room.spectators.forEach(spectator => {
                            spectator.send(JSON.stringify(summary));
                        });
                    }
                    // Cập nhật trạng thái cho spectators
                    room.spectators.forEach(spectator => {
                        spectator.send(JSON.stringify({ type: 'update', gameState: room.gameState }));
                    });
                }
            } else if (data.type === 'reset') {
                const room = rooms.get(data.roomCode);
                if (room) {
                    room.gameState = {
                        food: generateFood(),
                        scores: [0, 0],
                        player0: { position: [{ x: 50, y: 100 }], direction: 'right', lost: false },
                        player1: { position: [], direction: 'right', lost: false },
                        isGameOver: false
                    };
                    console.log('Reset game for room:', data.roomCode);
                    room.players.forEach(player => {
                        player.send(JSON.stringify({ type: 'reset' }));
                        player.send(JSON.stringify({ 
                            type: 'start', 
                            playerId: room.players.indexOf(player), 
                            food: room.gameState.food, 
                            scores: room.gameState.scores 
                        }));
                    });
                    room.spectators.forEach(spectator => {
                        spectator.send(JSON.stringify({ type: 'reset' }));
                        spectator.send(JSON.stringify({ 
                            type: 'update', 
                            gameState: room.gameState 
                        }));
                    });
                }
            }
        } catch (error) {
            console.error('Error processing message:', error);
            socket.send(JSON.stringify({ type: 'error', message: 'Server error occurred' }));
        }
    });

    socket.on('close', () => {
        try {
            console.log('A client disconnected');
            for (let [roomCode, room] of rooms) {
                if (socket.isPlayer) {
                    const disconnectedPlayerIndex = room.players.indexOf(socket);
                    if (disconnectedPlayerIndex !== -1) {
                        room.players = room.players.filter(p => p !== socket);
                        if (room.players.length > 0) {
                            room.players.forEach(player => {
                                player.send(JSON.stringify({
                                    type: 'opponentDisconnected',
                                    message: 'Your opponent has disconnected.'
                                }));
                            });
                        }
                        room.spectators.forEach(spectator => {
                            spectator.send(JSON.stringify({
                                type: 'playerDisconnected',
                                playerId: disconnectedPlayerIndex
                            }));
                        });
                        if (room.players.length === 0) {
                            rooms.delete(roomCode);
                        }
                    }
                } else {
                    // Xóa spectator khỏi danh sách
                    room.spectators = room.spectators.filter(s => s !== socket);
                }
            }
        } catch (error) {
            console.error('Error handling disconnect:', error);
        }
    });
});

console.log('Server running at ws://192.168.1.11:3000');