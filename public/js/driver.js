const socket = io();

let driverLatitude = 0;
let driverLongitude = 0;
let driverMarker = null;
let userMarker = null;
let routeControl = null;
let pendingRequest = null;

// Initialize map
const map = L.map("map").setView([0, 0], 13);

// Register driver after page load
window.addEventListener("load", () => {
  fetch("/driver-info")
    .then((res) => res.json())
    .then((data) => {
      if (data.driverId) {
        socket.emit("driver-register", data.driverId);
      }
    })
    .catch((err) => {
      console.error("Failed to register driver:", err);
    });
});


L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// Track driver location and emit
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (position) => {
      driverLatitude = position.coords.latitude;
      driverLongitude = position.coords.longitude;

      socket.emit("driver-location", {
        latitude: driverLatitude,
        longitude: driverLongitude,
      });

      // Driver marker
      if (!driverMarker) {
        driverMarker = L.marker([driverLatitude, driverLongitude], {
          icon: L.icon({
            iconUrl: "/image/ambulance.png",
            iconSize: [40, 40],
          }),
        }).addTo(map);
        map.setView([driverLatitude, driverLongitude], 13);
      } else {
        driverMarker.setLatLng([driverLatitude, driverLongitude]);
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

// Receive ambulance request
socket.on("ambulance-request-received", (data) => {
  // If already handling a request, ignore new requests
  if (pendingRequest) return;

  pendingRequest = data;

  document.getElementById("accept-request").style.display = "block";
  alert("New ambulance request received!");
});

// Handle Accept button
document.getElementById("accept-request").addEventListener("click", () => {
  if (pendingRequest) {
    socket.emit("ambulance-accept", {
      driverLocation: {
        latitude: driverLatitude,
        longitude: driverLongitude,
      },
      userLocation: pendingRequest.userLocation,
      userSocketId: pendingRequest.userSocketId,
    });

    alert("Request accepted! Route will be displayed.");

    document.getElementById("accept-request").style.display = "none";

    // Draw route to user
    if (routeControl) {
      map.removeControl(routeControl);
    }

    routeControl = L.Routing.control({
      waypoints: [
        L.latLng(driverLatitude, driverLongitude),
        L.latLng(pendingRequest.userLocation.latitude, pendingRequest.userLocation.longitude),
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      show: false,
    }).addTo(map);

    // Show user marker
    if (!userMarker) {
      userMarker = L.marker(
        [pendingRequest.userLocation.latitude, pendingRequest.userLocation.longitude],
        {
          icon: L.icon({
            iconUrl: "/image/user.png",
            iconSize: [30, 30],
          }),
        }
      ).addTo(map);
    } else {
      userMarker.setLatLng([
        pendingRequest.userLocation.latitude,
        pendingRequest.userLocation.longitude,
      ]);
    }

    // Clear pendingRequest so we can handle a future one
    pendingRequest = null;
  }
});
