const socket = io();

let driverLatitude = 0;
let driverLongitude = 0;
let driverMarker = null;
let userMarker = null;
let routePolyline = null;
let currentUserLocation = null;

const map = L.map("map").setView([0, 0], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "soureen-laha",
}).addTo(map);

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (position) => {
      driverLatitude = position.coords.latitude;
      driverLongitude = position.coords.longitude;

      socket.emit("driver-location", {
        latitude: driverLatitude,
        longitude: driverLongitude,
      });

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

socket.on("ambulance-request-received", (data) => {
  console.log("Ambulance request received", data);
  currentUserLocation = data.userLocation;

  document.getElementById("accept-button").style.display = "block";
});

document.getElementById("accept-button").addEventListener("click", () => {
  if (currentUserLocation) {
    socket.emit("ambulance-accept", {
      driverLocation: {
        latitude: driverLatitude,
        longitude: driverLongitude,
      },
      userLocation: currentUserLocation,
    });

    document.getElementById("accept-button").style.display = "none";
  }
});

socket.on("ambulance-accepted", (data) => {
  const { driverLocation, userLocation } = data;

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
