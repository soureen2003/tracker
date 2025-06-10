const express = require("express");
const app = express();
const http = require("http");
const path = require("path");

const socketio = require("socket.io");
const server = http.createServer(app);
const io = socketio(server);

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("user");
});

app.get("/driver", (req, res) => {
  res.render("driver");
});

let driverSocketId = null;
let userSocketId = null;

io.on("connection", (socket) => {
  console.log(`New client connected: ${socket.id}`);

  // Driver sends location
  socket.on("driver-location", (data) => {
    io.emit("driver-location-update", {
      id: socket.id,
      ...data,
    });
  });

  // User sends location
  socket.on("user-location", (data) => {
    io.emit("user-location-update", {
      id: socket.id,
      ...data,
    });
  });

  // User requests ambulance
  socket.on("ambulance-request", (data) => {
    console.log("Ambulance request received", data);
    userSocketId = socket.id;

    io.emit("ambulance-request-received", {
      userSocketId,
      userLocation: data,
    });
  });

  // Driver accepts request
  socket.on("ambulance-accept", (data) => {
    console.log("Ambulance accepted", data);
    driverSocketId = socket.id;

    io.to(userSocketId).emit("ambulance-accepted", data);
    io.to(driverSocketId).emit("ambulance-accepted", data);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    io.emit("user-disconnected", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
