const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

let rooms = {};

const words = {
    logos: ["nike","adidas","puma","apple","mcdonalds","starbucks"],
    animais: ["gato","cachorro","leão","tigre","elefante"],
    veiculos: ["carro","moto","avião","navio","bicicleta"],
    objetos: ["bola","cadeira","mesa","caneta","livro"]
};

function generateRoomCode() {
    let code = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for(let i=0;i<5;i++) code += chars[Math.floor(Math.random()*chars.length)];
    return code;
}

// SOCKET.IO
io.on("connection", socket => {
    console.log("Novo jogador:", socket.id);

    // Criar sala
    socket.on("createRoom", (playerName, theme, password) => {
        if(!playerName) return;
        let roomId = generateRoomCode();
        rooms[roomId] = { 
            players: [], 
            drawer: 0, 
            word: "", 
            guessed: [], 
            theme: theme || "logos", 
            password: password || "" 
        };
        joinRoom(socket, roomId, playerName);
        socket.emit("roomCreated", roomId);
        updateActiveRooms();
    });

    // Entrar na sala
    socket.on("joinRoom", (roomId, playerName, password) => {
        if(!playerName) return;
        roomId = roomId.toUpperCase();
        if(rooms[roomId]){
            if(rooms[roomId].password && rooms[roomId].password !== password){
                socket.emit("errorMessage","Senha incorreta!");
                return;
            }
            joinRoom(socket, roomId, playerName);
            socket.emit("roomJoined", roomId);
            updateActiveRooms();
        } else {
            socket.emit("errorMessage","Sala não existe!");
        }
    });

    // Desenho
    socket.on("drawing", data => {
        let roomId = getRoom(socket.id);
        if(roomId) socket.to(roomId).emit("drawing", data);
    });

    // Palpites / chat
    socket.on("guess", guess => {
        let roomId = getRoom(socket.id);
        if(!roomId) return;
        let room = rooms[roomId];
        let drawerId = room.players[room.drawer].id;

        if(guess.toLowerCase() === room.word.toLowerCase() && !room.guessed.includes(socket.id)) {
            room.guessed.push(socket.id);
            let guesser = room.players.find(p => p.id === socket.id);
            let drawer = room.players.find(p => p.id === drawerId);
            guesser.score += 10;
            drawer.score += 5;
            io.to(roomId).emit("correctGuess", { name: guesser.name, word: room.word });
            io.to(roomId).emit("updatePlayers", room.players);
            if(room.guessed.length >= room.players.length-1) nextTurn(roomId);
        } else {
            let player = room.players.find(p => p.id === socket.id);
            io.to(roomId).emit("chatMessage", { name: player.name, message: guess });
        }
    });

    // Desconectar
    socket.on("disconnect", () => {
        let roomId = getRoom(socket.id);
        if(!roomId) return;
        let room = rooms[roomId];
        room.players = room.players.filter(p => p.id !== socket.id);
        io.to(roomId).emit("updatePlayers", room.players);
        if(room.players.length === 0) delete rooms[roomId];
        updateActiveRooms();
    });
});

// Funções auxiliares
function joinRoom(socket, roomId, playerName) {
    rooms[roomId].players.push({id: socket.id, name: playerName, score: 0});
    socket.join(roomId);
    io.to(roomId).emit("updatePlayers", rooms[roomId].players);
    startTurn(roomId);
}

function getRoom(socketId) {
    for(let roomId in rooms){
        if(rooms[roomId].players.some(p=>p.id===socketId)) return roomId;
    }
    return null;
}

function startTurn(roomId) {
    let room = rooms[roomId];
    if(!room) return;
    room.drawer = room.drawer % room.players.length;
    let themeWords = words[room.theme] || words["logos"];
    room.word = themeWords[Math.floor(Math.random()*themeWords.length)];
    room.guessed = [];
    io.to(roomId).emit("startTurn", { drawerId: room.players[room.drawer].id, wordLength: room.word.length, word: room.word });
}

function nextTurn(roomId) {
    let room = rooms[roomId];
    if(!room) return;
    room.drawer = (room.drawer + 1) % room.players.length;
    let themeWords = words[room.theme] || words["logos"];
    room.word = themeWords[Math.floor(Math.random()*themeWords.length)];
    room.guessed = [];
    io.to(roomId).emit("startTurn", { drawerId: room.players[room.drawer].id, wordLength: room.word.length, word: room.word });
}

function updateActiveRooms(){
    let activeRooms = Object.entries(rooms).map(([id, r])=>{
        return { id, players: r.players.length, theme: r.theme, hasPassword: r.password!=="" };
    });
    io.emit("activeRooms", activeRooms);
}

// PORTA
const PORT = 4000;
http.listen(PORT, () => console.log(`Servidor do Andrartic rodando na porta ${PORT}`));
