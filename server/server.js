const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 3000 });

const rooms = new Map(); // Lưu thông tin phòng

server.on('connection', (socket) => {
    console.log('Có người chơi kết nối!');

    socket.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'create') {
            const roomCode = Math.random().toString(36).substring(7); // Mã phòng ngẫu nhiên
            rooms.set(roomCode, { players: [socket], gameState: {} });
            socket.send(JSON.stringify({ type: 'roomCreated', roomCode }));
        } else if (data.type === 'join') {
            const room = rooms.get(data.roomCode);
            if (room && room.players.length < 2) {
                room.players.push(socket);
                socket.send(JSON.stringify({ type: 'joined', roomCode: data.roomCode }));
                room.players.forEach(player =>
                    player.send(JSON.stringify({ type: 'start', playerId: room.players.indexOf(player) }))
                );
            } else {
                socket.send(JSON.stringify({ type: 'error', message: 'Phòng không tồn tại hoặc đầy' }));
            }
        } else if (data.type === 'move') {
            const room = Array.from(rooms.values()).find(r => r.players.includes(socket));
            if (room) {
                room.gameState[`player${data.playerId}`] = data.position;
                room.players.forEach(player => {
                    if (player !== socket) {
                        player.send(JSON.stringify({ type: 'update', gameState: room.gameState }));
                    }
                });
            }
        }
    });

    socket.on('close', () => {
        console.log('Người chơi ngắt kết nối');
        for (let [roomCode, room] of rooms) {
            room.players = room.players.filter(p => p !== socket);
            if (room.players.length === 0) rooms.delete(roomCode);
        }
    });
});

console.log('Server chạy tại ws://localhost:3000');