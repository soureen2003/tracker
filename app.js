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

// Multiple drivers storage
let driverSockets = {}; // { socket.id: { latitude, longitude } }
let userSocketId = null;
let currentRequest = null; // store current request data

io.on("connection", (socket) => {
  console.log(`New client connected: ${socket.id}`);

  // Driver sends location
  socket.on("driver-location", (data) => {
    driverSockets[socket.id] = data;

    // Broadcast all drivers to all users
    io.emit("driver-location-update", driverSockets);
  });

  // User sends location
  socket.on("user-location", (data) => {
    userSocketId = socket.id;

    // Emit to all drivers — live user location
    io.emit("user-location-update", {
      id: socket.id,
      ...data,
    });
  });

  // User requests ambulance
  socket.on("ambulance-request", (data) => {
    console.log("Ambulance request received", data);

    userSocketId = socket.id;
    currentRequest = {
      userSocketId,
      userLocation: data,
      assignedDriverSocketId: null, // no driver assigned yet
    };

    // Emit to all drivers — new request
    io.emit("ambulance-request-received", {
      userSocketId,
      userLocation: data,
    });
  });

  // Driver accepts request
  socket.on("ambulance-accept", (data) => {
    console.log(`Driver ${socket.id} accepted request`);

    // Safety check
    if (!currentRequest) {
      console.log("No active request.");
      return;
    }

    if (currentRequest.assignedDriverSocketId) {
      console.log("Request already accepted by another driver.");
      return;
    }

    // Assign driver
    currentRequest.assignedDriverSocketId = socket.id;

    // Send to user and driver
    io.to(userSocketId).emit("ambulance-accepted", data);
    io.to(socket.id).emit("ambulance-accepted", data);

    console.log(`Request assigned to driver ${socket.id}`);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);

    // Remove driver if exists
    if (driverSockets[socket.id]) {
      delete driverSockets[socket.id];

      // Update driver list to users
      io.emit("driver-location-update", driverSockets);
    }

    // If user disconnects → reset request
    if (socket.id === userSocketId) {
      console.log(`User ${socket.id} disconnected — resetting request.`);
      userSocketId = null;
      currentRequest = null;

      // Notify drivers
      io.emit("user-disconnected", socket.id);
    }

    // If driver assigned → reset request
    if (currentRequest && socket.id === currentRequest.assignedDriverSocketId) {
      console.log(`Assigned driver ${socket.id} disconnected — resetting request.`);
      currentRequest = null;

      // Notify drivers
      io.emit("user-disconnected", "assigned-driver-disconnected");
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
