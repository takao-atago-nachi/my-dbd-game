const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = {};
let generatorProgress = 0;

const walls = [
  { x: 250, y: 100, w: 20, h: 200 },
  { x: 100, y: 180, w: 100, h: 20 }
];

function checkCollision(x, y, radius) {
  for (let w of walls) {
    if (
      x + radius > w.x &&
      x - radius < w.x + w.w &&
      y + radius > w.y &&
      y - radius < w.y + w.h
    ) {
      return true;
    }
  }
  return false;
}

io.on("connection", (socket) => {
  const isKiller = Object.keys(players).length === 0;
  players[socket.id] = {
    id: socket.id,
    x: isKiller ? 80 : 520,
    y: 200,
    role: isKiller ? "killer" : "survivor",
    isDown: false
  };

  socket.emit("init", { id: socket.id, players, generatorProgress, walls });
  socket.broadcast.emit("newPlayer", players[socket.id]);

  socket.on("move", (dir) => {
    const p = players[socket.id];
    if (!p || p.isDown) return;

    const speed = p.role === "killer" ? 6 : 5;
    let newX = p.x;
    let newY = p.y;

    if (dir.up) newY -= speed;
    if (dir.down) newY += speed;
    if (dir.left) newX -= speed;
    if (dir.right) newX += speed;

    if (newX > 20 && newX < 580 && !checkCollision(newX, p.y, 15)) p.x = newX;
    if (newY > 20 && newY < 380 && !checkCollision(p.x, newY, 15)) p.y = newY;

    io.emit("stateUpdate", { players, generatorProgress });
  });

  socket.on("action", () => {
    const p = players[socket.id];
    if (!p || p.isDown) return;

    if (p.role === "killer") {
      Object.values(players).forEach((target) => {
        if (target.role === "survivor" && !target.isDown) {
          const dist = Math.hypot(p.x - target.x, p.y - target.y);
          if (dist < 35) {
            target.isDown = true;
          }
        }
      });
    } else {
      const genDist = Math.hypot(p.x - 300, p.y - 200);
      if (genDist < 45) {
        generatorProgress = Math.min(100, generatorProgress + 1);
      }

      Object.values(players).forEach((target) => {
        if (target.role === "survivor" && target.isDown && target.id !== p.id) {
          const dist = Math.hypot(p.x - target.x, p.y - target.y);
          if (dist < 40) {
            target.isDown = false;
          }
        }
      });
    }

    io.emit("stateUpdate", { players, generatorProgress });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerLeft", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
