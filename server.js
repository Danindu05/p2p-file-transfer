const { createServer } = require("node:http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    handler(req, res);
  });

  const io = new Server(httpServer, {
    cors: { origin: "*" },
    pingTimeout: 2000,
    pingInterval: 5000 
  });

  io.on("connection", (socket) => {
    const room = "stable-p2p-room";
    socket.join(room);

    socket.on("discovery", (data) => {
      if (!data?.peerId) return;
      socket.to(room).emit("peer-found", { 
        socketId: socket.id, 
        peerId: data.peerId, 
        name: data.name || "Unknown", 
        color: data.color || "#333"
      });
    });

    socket.on("signal-exchange", (data) => {
      if (!data?.to) return;
      io.to(data.to).emit("got-peer", { 
        from: socket.id, 
        peerId: data.peerId, 
        name: data.name, 
        color: data.color 
      });
    });

    socket.on("disconnect", () => {
      socket.to(room).emit("peer-left", socket.id);
    });
  });

  httpServer.listen(3000, "0.0.0.0", () => {
    console.log("\n STABLE SERVER RUNNING");
  });
});