const socket = io();

let userLatitude = 0;
let userLongitude = 0;
let userMarker = null;
let ambulanceMarkers = {};
let routeControl = null;

const map = L.map("map").setView([0, 0], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// Track user location
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (position) => {
      userLatitude = position.coords.latitude;
      userLongitude = position.coords.longitude;

      socket.emit("user-location", {
        latitude: userLatitude,
        longitude: userLongitude,
      });

      if (!userMarker) {
        userMarker = L.marker([userLatitude, userLongitude], {
          icon: L.icon({
            iconUrl: "/image/user.png",
            iconSize: [30, 30],
          }),
        }).addTo(map);
        map.setView([userLatitude, userLongitude], 13);
      } else {
        userMarker.setLatLng([userLatitude, userLongitude]);
      }
    },
    (error) => console.log(error),
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000,
    }
  );
}

// Update driver positions
socket.on("driver-location-update", (drivers) => {
  Object.keys(drivers).forEach((driverId) => {
    const { latitude, longitude } = drivers[driverId];

    if (!ambulanceMarkers[driverId]) {
      ambulanceMarkers[driverId] = L.marker([latitude, longitude], {
        icon: L.icon({
          iconUrl: "/image/ambulance.png",
          iconSize: [40, 40],
        }),
      }).addTo(map);
    } else {
      ambulanceMarkers[driverId].setLatLng([latitude, longitude]);
    }
  });

  Object.keys(ambulanceMarkers).forEach((driverId) => {
    if (!drivers[driverId]) {
      map.removeLayer(ambulanceMarkers[driverId]);
      delete ambulanceMarkers[driverId];
    }
  });
});

// On ambulance acceptance
socket.on("ambulance-accepted", (data) => {
  const { driverLocation, userLocation, driverName, driverPhone } = data;

  // Remove old route
  if (routeControl) map.removeControl(routeControl);

  routeControl = L.Routing.control({
    waypoints: [
      L.latLng(driverLocation.latitude, driverLocation.longitude),
      L.latLng(userLocation.latitude, userLocation.longitude),
    ],
    routeWhileDragging: false,
    addWaypoints: false,
    draggableWaypoints: false,
    fitSelectedRoutes: true,
    show: false,
  }).addTo(map);

  if (!userMarker) {
    userMarker = L.marker([userLocation.latitude, userLocation.longitude], {
      icon: L.icon({
        iconUrl: "/image/user.png",
        iconSize: [30, 30],
      }),
    }).addTo(map);
  } else {
    userMarker.setLatLng([userLocation.latitude, userLocation.longitude]);
  }

  const btn = document.getElementById("request-ambulance");
  btn.disabled = false;
  btn.classList.remove("loading");

  document.getElementById("no-driver-msg").style.display = "none";

  alert(`🚑 Ambulance Accepted!\n👨‍✈️ Driver: ${driverName}\n📞 Phone: ${driverPhone}`);
});

// If user disconnects
socket.on("user-disconnected", (id) => {
  console.log(`User disconnected: ${id}`);
});

// Handle Request Ambulance button
document.getElementById("request-ambulance").addEventListener("click", () => {
  const btn = document.getElementById("request-ambulance");
  const msgBox = document.getElementById("no-driver-msg");

  // Visual loading
  btn.classList.add("loading");
  btn.disabled = true;
  msgBox.style.display = "none";

  socket.emit("ambulance-request", {
    latitude: userLatitude,
    longitude: userLongitude,
  });

  // Timeout fallback if no response
  setTimeout(() => {
    if (!routeControl) {
      msgBox.style.display = "block";
      btn.classList.remove("loading");
      btn.disabled = false;
    }
  }, 15000);
});
