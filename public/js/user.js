const socket = io();

let userLatitude = 0;
let userLongitude = 0;
let driverMarker = null;
let userMarker = null;
let routePolyline = null;

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

      // Update user marker
      if (!userMarker) {
        userMarker = L.marker([userLatitude, userLongitude], {
          icon: L.icon({
            iconUrl: "/image/user.png",
            iconSize: [30, 30],
          }),
        }).addTo(map).bindPopup("You are here").openPopup();

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

socket.on("driver-location-update", (data) => {
  const { latitude, longitude } = data;

  if (!driverMarker) {
    driverMarker = L.marker([latitude, longitude], {
      icon: L.icon({
        iconUrl: "/image/ambulance.png",
        iconSize: [40, 40],
      }),
    }).addTo(map);
  } else {
    driverMarker.setLatLng([latitude, longitude]);
  }
});

socket.on("ambulance-accepted", (data) => {
  const { driverLocation, userLocation } = data;

  // Ensure user marker is shown
  if (!userMarker) {
    userMarker = L.marker([userLocation.latitude, userLocation.longitude], {
      icon: L.icon({
        iconUrl: "/image/user.png",
        iconSize: [30, 30],
      }),
    }).addTo(map).bindPopup("You are here").openPopup();
  } else {
    userMarker.setLatLng([userLocation.latitude, userLocation.longitude]);
  }

  // Draw route line
  if (routePolyline) {
    map.removeLayer(routePolyline);
  }

  routePolyline = L.polyline(
    [
      [driverLocation.latitude, driverLocation.longitude],
      [userLocation.latitude, userLocation.longitude],
    ],
    { color: "blue", weight: 5 }
  ).addTo(map);

  map.fitBounds(routePolyline.getBounds());
});

socket.on("user-disconnected", (id) => {
  console.log(`User disconnected: ${id}`);
});

document.getElementById("request-ambulance").addEventListener("click", () => {
  socket.emit("ambulance-request", {
    latitude: userLatitude,
    longitude: userLongitude,
  });

  alert("Ambulance requested! Please wait for driver to accept.");
});
