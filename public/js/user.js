const socket = io();

let userLatitude = 0;
let userLongitude = 0;
let userMarker = null;
let ambulanceMarkers = {};
let routeControl = null;

// Initialize map
const map = L.map("map").setView([0, 0], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// Track user location and emit
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (position) => {
      userLatitude = position.coords.latitude;
      userLongitude = position.coords.longitude;

      socket.emit("user-location", {
        latitude: userLatitude,
        longitude: userLongitude,
      });

      // Show user marker
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

// Receive all ambulance positions
socket.on("driver-location-update", (drivers) => {
  // Update each driver marker
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

  // Remove ambulance markers for disconnected drivers
  Object.keys(ambulanceMarkers).forEach((driverId) => {
    if (!drivers[driverId]) {
      map.removeLayer(ambulanceMarkers[driverId]);
      delete ambulanceMarkers[driverId];
    }
  });
});

// When ambulance accepts request → draw route
socket.on("ambulance-accepted", (data) => {
  const { driverLocation, userLocation } = data;

  // Remove old route if exists
  if (routeControl) {
    map.removeControl(routeControl);
  }

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

  // Ensure user marker is shown at correct place
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
});

// User disconnected → clean up if needed
socket.on("user-disconnected", (id) => {
  console.log(`User disconnected: ${id}`);
});

// Handle Request Ambulance button
document.getElementById("request-ambulance").addEventListener("click", () => {
  socket.emit("ambulance-request", {
    latitude: userLatitude,
    longitude: userLongitude,
  });

  alert("Ambulance requested! Please wait for driver to accept.");
});
