const socket = io();

// LOGIN
const loginDiv = document.getElementById("login");
const gameDiv = document.getElementById("game");
const nameInput = document.getElementById("name");
const themeSelect = document.getElementById("theme");
const passwordInput = document.getElementById("password");
const createBtn = document.getElementById("createBtn");
const roomsListDiv = document.getElementById("roomsList");

const roomCodeSpan = document.getElementById("roomCode");

// BOTÃO ENTRAR DIRETO
const joinBtn = document.getElementById("joinBtn");
const roomCodeInput = document.getElementById("roomCodeInput");
const roomPasswordInput = document.getElementById("roomPasswordInput");

joinBtn.onclick = ()=>{
    const name = nameInput.value.trim();
    const code = roomCodeInput.value.trim().toUpperCase();
    const password = roomPasswordInput.value.trim();
    if(!name) return alert("Digite seu nome!");
    if(!code) return alert("Digite o código da sala!");
    socket.emit("joinRoom", code, name, password);
};

// CRIAR SALA
createBtn.onclick = ()=>{
    const name=nameInput.value.trim();
    const theme=themeSelect.value;
    const password=passwordInput.value.trim();
    if(!name)return alert("Digite seu nome!");
    socket.emit("createRoom",name,theme,password);
};

// LISTAR SALAS ATIVAS
socket.on("activeRooms", rooms=>{
    roomsListDiv.innerHTML = "";
    rooms.forEach(r=>{
        let btn = document.createElement("button");
        btn.textContent = `${r.id} (${r.players} jogadores) ${r.hasPassword?"🔒":""} [${r.theme}]`;
        btn.onclick = ()=>{
            const pwd = r.hasPassword ? prompt("Digite a senha:") : "";
            const name = nameInput.value.trim();
            if(!name) return alert("Digite seu nome!");
            socket.emit("joinRoom", r.id, name, pwd);
        };
        roomsListDiv.appendChild(btn);
    });
});

// ENTRAR / CRIAR SALA
socket.on("roomCreated", roomId=>{
    roomCodeSpan.textContent = roomId;
    loginDiv.style.display="none";
    gameDiv.style.display="block";
});

socket.on("roomJoined", roomId=>{
    roomCodeSpan.textContent = roomId;
    loginDiv.style.display="none";
    gameDiv.style.display="block";
});

socket.on("errorMessage", msg=>alert(msg));

// CANVAS
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let drawing=false,isDrawer=false,erasing=false;

canvas.addEventListener("mousedown",()=>{if(isDrawer){drawing=true;ctx.beginPath();}});
canvas.addEventListener("mouseup",()=>drawing=false);
canvas.addEventListener("mousemove",e=>{
    if(!drawing||!isDrawer)return;
    const rect=canvas.getBoundingClientRect();
    const x=e.clientX-rect.left;
    const y=e.clientY-rect.top;
    ctx.strokeStyle=erasing?"#fff":colorPicker.value;
    ctx.lineWidth=erasing?15:3;
    ctx.lineTo(x,y);
    ctx.stroke();
    socket.emit("drawing",{x,y,color:ctx.strokeStyle,width:ctx.lineWidth});
});
socket.on("drawing",data=>{
    ctx.strokeStyle=data.color;
    ctx.lineWidth=data.width;
    ctx.lineTo(data.x,data.y);
    ctx.stroke();
});

const eraserBtn = document.getElementById("eraserBtn");
eraserBtn.onclick = ()=>erasing=!erasing;

const colorPicker = document.getElementById("colorPicker");

// CHAT / PALPITES
const messagesDiv = document.getElementById("messages");
const guessInput = document.getElementById("guessInput");
const sendBtn = document.getElementById("sendBtn");
const playersDiv = document.getElementById("players");
const infoDiv = document.getElementById("info");
const timerSpan = document.getElementById("timer");

sendBtn.onclick = ()=>{
    const msg=guessInput.value.trim();
    if(msg){socket.emit("guess",msg);guessInput.value="";}
};

socket.on("chatMessage",data=>{
    messagesDiv.innerHTML+=`<div><b>${data.name}:</b> ${data.message}</div>`;
    messagesDiv.scrollTop=messagesDiv.scrollHeight;
});

socket.on("correctGuess",data=>{
    messagesDiv.innerHTML+=`<div style="color:green;"><b>${data.name}</b> acertou a palavra: ${data.word}</div>`;
    messagesDiv.scrollTop=messagesDiv.scrollHeight;
});

// ATUALIZAR JOGADORES
socket.on("updatePlayers",players=>{
    playersDiv.innerHTML=players.map(p=>`${p.name}: ${p.score}`).join("<br>");
});

// INÍCIO DO TURNO
socket.on("startTurn",data=>{
    ctx.clearRect(0,0,canvas.width,canvas.height);
    isDrawer=socket.id===data.drawerId;
    if(isDrawer){
        infoDiv.textContent=`Você desenha! Palavra: ${data.word}`;
    } else {
        infoDiv.textContent=`Adivinhe a palavra! (${data.wordLength} letras)`;
    }
    startTimer();
});

// TIMER
let turnTime=60,timerInterval;
function startTimer(){
    clearInterval(timerInterval);
    turnTime=60;
    timerSpan.textContent=`⏱ ${turnTime}s`;
    timerInterval=setInterval(()=>{
        turnTime--;
        timerSpan.textContent=`⏱ ${turnTime}s`;
        if(turnTime<=0) clearInterval(timerInterval);
    },1000);
}
