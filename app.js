const express = require("express");
const http = require("http");
const path = require("path");
const socketIO = require("socket.io");
const session = require("express-session");
const flash = require("connect-flash");
const mongoose = require("mongoose");

require("./db");
const User = require("./models/userModel");
const Driver = require("./models/driverModel");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'ambulance-secret',
  resave: false,
  saveUninitialized: false
}));
app.use(flash());

app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  next();
});

// Pages
app.get("/", (req, res) => res.render("home"));

app.get("/user", async (req, res) => {
  const email = req.query.email;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      req.flash("error_msg", "User not found");
      return res.redirect("/user-login");
    }
    res.render("user", { user });
  } catch (err) {
    console.error("❌ Error loading user view:", err);
    res.redirect("/user-login");
  }
});

app.get("/user-login", (req, res) => res.render("userLogin"));
app.get("/user-signup", (req, res) => res.render("userSignup"));

app.get("/driver", async (req, res) => {
  if (!req.session.driverId) {
    req.flash("error_msg", "Please log in first");
    return res.redirect("/driver-login");
  }

  try {
    const driver = await Driver.findById(req.session.driverId);
    res.render("driver", { driver });
  } catch (err) {
    res.render("driver", { driver: null });
  }
});

app.get("/driver-login", (req, res) => res.render("driverLogin"));
app.get("/driver-signup", (req, res) => res.render("driverSignup"));

// Signup & Login Routes

app.post("/user/signup", async (req, res) => {
  const { name, email, password, phone } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) {
      req.flash("error_msg", "User already exists");
      return res.redirect("/user-signup");
    }

    const newUser = new User({ name, email, password, phone });
    await newUser.save();
    req.flash("success_msg", "User registered! Please login.");
    res.redirect("/user-login");
  } catch (err) {
    req.flash("error_msg", "Error during signup");
    res.redirect("/user-signup");
  }
});

app.post("/user/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      req.flash("error_msg", "Invalid credentials");
      return res.redirect("/user-login");
    }
    res.redirect(`/user?email=${encodeURIComponent(email)}`);
  } catch (err) {
    req.flash("error_msg", "Login error");
    res.redirect("/user-login");
  }
});

app.post("/driver/signup", async (req, res) => {
  const { name, email, password, phone } = req.body;
  try {
    const existing = await Driver.findOne({ email });
    if (existing) {
      req.flash("error_msg", "Driver already exists");
      return res.redirect("/driver-signup");
    }

    const newDriver = new Driver({ name, email, password, phone });
    await newDriver.save();
    req.flash("success_msg", "Driver registered! Please login.");
    res.redirect("/driver-login");
  } catch (err) {
    req.flash("error_msg", "Error during signup");
    res.redirect("/driver-signup");
  }
});

app.post("/driver/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const driver = await Driver.findOne({ email });
    if (!driver || driver.password !== password) {
      req.flash("error_msg", "Invalid credentials");
      return res.redirect("/driver-login");
    }
    req.session.driverId = driver._id;
    res.redirect("/driver");
  } catch (err) {
    req.flash("error_msg", "Login error");
    res.redirect("/driver-login");
  }
});

// ========== SOCKET.IO ==========
const drivers = {};
const driverLocations = {};
const userRequests = {};
const driverSocketToId = {};

io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);

  socket.on("driver-register", (driverId) => {
    driverSocketToId[socket.id] = driverId;
    drivers[socket.id] = socket;
  });

  socket.on("user-location", async (location) => {
    userRequests[socket.id] = location;
    try {
      await User.findOneAndUpdate({ email: location.email }, { socketId: socket.id });
    } catch (err) {
      console.error("⚠️ Error saving user socketId:", err);
    }
    io.emit("driver-location-update", driverLocations);
  });

  socket.on("driver-location", (location) => {
    driverLocations[socket.id] = location;
    drivers[socket.id] = socket;
    io.emit("driver-location-update", driverLocations);
  });

  socket.on("ambulance-request", async (location) => {
    userRequests[socket.id] = location;
    try {
      const user = await User.findOne({ socketId: socket.id });
      if (!user) return;

      for (const driverSocketId in drivers) {
        drivers[driverSocketId].emit("ambulance-request-received", {
          userSocketId: socket.id,
          userLocation: location,
          userName: user.name,
          userPhone: user.phone
        });
      }
    } catch (err) {
      console.error("❌ Error fetching user in ambulance-request:", err);
    }
  });

  socket.on("ambulance-accept", async (data) => {
    const { driverLocation, userLocation, userSocketId } = data;
    const driverId = driverSocketToId[socket.id];
    if (!driverId) return;

    try {
      const driver = await Driver.findById(driverId);
      const user = await User.findOne({ socketId: userSocketId });
      if (!driver || !user) return;

      // Send driver info to user
      io.to(userSocketId).emit("ambulance-accepted", {
        driverLocation,
        userLocation,
        driverName: driver.name,
        driverPhone: driver.phone
      });

      // Send user info to driver
      socket.emit("user-info", {
        userName: user.name,
        userPhone: user.phone,
        userLocation
      });

    } catch (err) {
      console.error("❌ Error in ambulance-accept:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
    delete drivers[socket.id];
    delete driverLocations[socket.id];
    delete userRequests[socket.id];
    delete driverSocketToId[socket.id];
    io.emit("driver-location-update", driverLocations);
  });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
