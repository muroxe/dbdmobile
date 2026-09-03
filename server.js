const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const rooms = {};

io.on('connection', (socket) => {
  socket.on('createRoom', () => {
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    rooms[roomId] = { host: socket.id, players: {} };
    rooms[roomId].players[socket.id] = { id: socket.id, role: 'KILLER' };
    socket.join(roomId);
    socket.emit('roomCreated', roomId, 'KILLER');
    io.to(roomId).emit('updatePlayers', Object.values(rooms[roomId].players));
  });

  socket.on('joinRoom', (roomId) => {
    roomId = roomId.toUpperCase();
    if (rooms[roomId] && Object.keys(rooms[roomId].players).length < 5) {
      rooms[roomId].players[socket.id] = { id: socket.id, role: 'SURVIVOR' };
      socket.join(roomId);
      socket.emit('roomJoined', roomId, 'SURVIVOR');
      io.to(roomId).emit('updatePlayers', Object.values(rooms[roomId].players));
    } else {
      socket.emit('error', 'Комната не найдена или уже полная');
    }
  });

  socket.on('startGame', (roomId) => {
    if (rooms[roomId] && rooms[roomId].host === socket.id) {
      // Отправляем всем единый сид для рандома генераторов и палеток
      const mapSeed = Math.random();
      io.to(roomId).emit('gameStarted', mapSeed);
    }
  });

  socket.on('playerMove', (data) => {
    const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
    if (roomId) socket.to(roomId).emit('playerMoved', { id: socket.id, ...data });
  });

  socket.on('action', (data) => {
    const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
    if (roomId) socket.to(roomId).emit('syncAction', data);
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      if (rooms[roomId].players[socket.id]) {
        delete rooms[roomId].players[socket.id];
        io.to(roomId).emit('updatePlayers', Object.values(rooms[roomId].players));
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
