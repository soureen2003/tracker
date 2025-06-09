const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const socketio = require("socket.io");

const server = http.createServer(app);
const io = socketio(server);

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

const users = {};
const drivers = {};

io.on("connection", (socket) => {
  // User or Driver registers on connect
  socket.on("register", ({ type }) => {
    if (type === "user") {
      users[socket.id] = { id: socket.id };
      console.log("User connected:", socket.id);
      socket.emit("registered", { id: socket.id, type });
    } else if (type === "driver") {
      drivers[socket.id] = { id: socket.id };
      console.log("Driver connected:", socket.id);
      socket.emit("registered", { id: socket.id, type });
    }
  });

  socket.on("send-location", (data) => {
    // Broadcast location to everyone
    io.emit("receive-location", { id: socket.id, ...data });
  });

  // User requests ambulance
  socket.on("request-ambulance", () => {
    console.log(`User ${socket.id} requested ambulance`);
    // Find nearest available driver (for demo, just pick any)
    const driverIds = Object.keys(drivers);

    if (driverIds.length === 0) {
      socket.emit("no-drivers-available");
      return;
    }

    // For simplicity, send to all drivers the request
    driverIds.forEach((driverId) => {
      io.to(driverId).emit("ambulance-request", {
        userId: socket.id,
        userLocation: users[socket.id], // Optional user info if stored
      });
    });
  });

  // Driver accepts request
  socket.on("accept-request", ({ userId }) => {
    console.log(`Driver ${socket.id} accepted request for user ${userId}`);

    // Notify user that driver accepted
    io.to(userId).emit("request-accepted", { driverId: socket.id });
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    delete users[socket.id];
    delete drivers[socket.id];
    io.emit("user-disconnected", socket.id);
  });
});

// Routes for user and driver pages
app.get("/", (req, res) => res.render("user"));
app.get("/driver", (req, res) => res.render("driver"));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
