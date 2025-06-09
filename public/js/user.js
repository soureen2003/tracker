const socket = io();
socket.emit("register", { type: "user" });

let myLocation = null;
let driverLocation = null;
let routingControl = null;

// LOCATION UPDATES
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      myLocation = [latitude, longitude];
      socket.emit("send-location", { latitude, longitude });
      if (!routingControl) {
        map.setView(myLocation, 13);
      }
    },
    (error) => {
      console.log(error);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000,
    }
  );
}

// MAP INIT
const map = L.map("map").setView([0, 0], 10);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "ctrl-alt-elite",
}).addTo(map);

const markers = {};

const ambulanceIcon = L.icon({
  iconUrl: "/img/ambulance.png",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

function updateDriverMarker(latlng) {
  if (markers["driver"]) {
    markers["driver"].setLatLng(latlng);
  } else {
    markers["driver"] = L.marker(latlng, { icon: ambulanceIcon }).addTo(map);
  }
}

// Receive location updates
socket.on("receive-location", (data) => {
  const { id, latitude, longitude } = data;

  if (id === socket.id) return; // skip self

  driverLocation = [latitude, longitude];
  updateDriverMarker(driverLocation);

  if (myLocation && driverLocation) {
    if (routingControl) {
      routingControl.setWaypoints([L.latLng(driverLocation), L.latLng(myLocation)]);
    } else {
      routingControl = L.Routing.control({
        waypoints: [L.latLng(driverLocation), L.latLng(myLocation)],
        routeWhileDragging: false,
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: true,
        show: false,
      }).addTo(map);
    }
  }
});

// Handle disconnection
socket.on("user-disconnected", (id) => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];
  }
  if (routingControl) {
    routingControl.remove();
    routingControl = null;
  }
});

// REQUEST AMBULANCE button logic
const requestButton = document.getElementById("requestButton");
requestButton.addEventListener("click", () => {
  if (!myLocation) {
    alert("Waiting for your location...");
    return;
  }
  socket.emit("request-ambulance");
});

// When driver accepts request
socket.on("request-accepted", ({ driverId }) => {
  alert(`Driver ${driverId} accepted your request and is on the way!`);
});

// No drivers available
socket.on("no-drivers-available", () => {
  alert("No drivers available at the moment.");
});
