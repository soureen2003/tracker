const socket = io();
socket.emit("register", { type: "driver" });

let myLocation = null;
let userLocation = null;
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

function updateUserMarker(latlng) {
  if (markers["user"]) {
    markers["user"].setLatLng(latlng);
  } else {
    markers["user"] = L.marker(latlng).addTo(map);
  }
}

// Receive location updates
socket.on("receive-location", (data) => {
  const { id, latitude, longitude } = data;

  if (id === socket.id) return; // skip self

  userLocation = [latitude, longitude];
  updateUserMarker(userLocation);

  if (myLocation && userLocation) {
    if (routingControl) {
      routingControl.setWaypoints([L.latLng(myLocation), L.latLng(userLocation)]);
    } else {
      routingControl = L.Routing.control({
        waypoints: [L.latLng(myLocation), L.latLng(userLocation)],
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

// Receive ambulance request from server
socket.on("ambulance-request", ({ userId, userLocation }) => {
  const accept = confirm(`User requested an ambulance! Accept request?`);
  if (accept) {
    socket.emit("accept-request", { userId });
  }
});
