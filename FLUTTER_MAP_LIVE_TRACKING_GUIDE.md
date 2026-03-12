# Flutter Map + Live Tracking (Driver & Passenger) — Full Integration Guide

This is the **end-to-end** guide for the Flutter team to integrate:

- A **real Google Map** in the app
- A **moving car marker** (live driver location)
- **Real-time tracking** using **REST + Socket.io**

Backend support is already implemented (see `LIVE_TRACKING_API.md`).

---

## Core idea (one paragraph)

During an active ride, the **driver app** sends GPS updates (every 5–10 seconds) to the backend (`PUT /rides/:id/location` or `ride:location_update`). The backend persists them to `ride.tracking` and emits **`ride:driver_location`** to the passenger in real time. The **passenger app** opens a tracking screen, loads the latest ride state (`GET /rides/:id`), draws the map + markers, then listens to `ride:driver_location` and **moves the car marker**.

---

## What you must have before coding

### Backend URLs

- **API base URL**: `https://baneen-fullbackend.onrender.com/api/v1`
- **Socket URL**: `https://baneen-fullbackend.onrender.com` (no `/api/v1`)

### Tokens

You need JWT access tokens for:
- **Driver** (to send location updates)
- **Passenger** (to read ride data + receive socket events)

### Ride state requirement

Live updates only work when the ride status is:
- **`in-progress`**

The backend will reject location updates when the ride is not in progress.

---

## Part A — Google Maps in Flutter (Android + iOS)

This guide assumes **Google Maps** via `google_maps_flutter`.

### A1) Google Cloud setup (Maps for the Flutter app)

In Google Cloud Console:

- Enable **Maps SDK for Android**
- Enable **Maps SDK for iOS**

Create an API key, then **restrict it**:
- Android restriction: **package name + SHA-1**
- iOS restriction: **bundle identifier**

> Note: This app map key is separate from (or can be same as) the backend’s `GOOGLE_MAPS_API_KEY`, but the restrictions are different. Backend keys should be restricted to server usage; app keys should be restricted to app identifiers.

### A2) Flutter dependencies (recommended)

Add (latest compatible versions):

- `google_maps_flutter`
- `geolocator` (GPS)
- `permission_handler` (optional; Geolocator can request permission too)
- `socket_io_client`
- `dio` (or `http`) for REST
- `flutter_polyline_points` (optional, to draw directions polyline)

### A3) Android configuration

1) Put the Maps key in `android/app/src/main/AndroidManifest.xml`:

```xml
<application>
  <meta-data
      android:name="com.google.android.geo.API_KEY"
      android:value="YOUR_GOOGLE_MAPS_KEY"/>
</application>
```

2) Add location permissions:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
```

If you need background tracking (driver app), also add:

```xml
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
```

> If you don’t need background updates, avoid background permission (Google Play policy is strict).

### A4) iOS configuration

1) Add this to `ios/Runner/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>We use your location to enable ride tracking.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We use your location to enable ride tracking during rides.</string>
```

2) Add the Google Maps key (common patterns):
- Use `GMSServices.provideAPIKey(...)` in `AppDelegate`, or
- Use the method recommended by `google_maps_flutter` for your Flutter version.

---

## Part B — Networking conventions (REST + auth)

### B1) REST headers

All tracking calls require:

```http
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
```

### B2) Endpoints used for live tracking

Driver sends:
- `PUT /rides/:id/location`

Passenger reads initial state:
- `GET /rides/:id`

Optional route polyline:
- `GET /maps/directions?origin=<lat,lng>&destination=<lat,lng>` (see `GOOGLE_MAPS_INTEGRATION.md`)

---

## Part C — Socket.io conventions (Passenger receives live updates)

### C1) Connection

Socket server:
- `https://baneen-fullbackend.onrender.com`

Send JWT on connect (recommended):

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

IO.Socket connectSocket(String token) {
  final socket = IO.io(
    'https://baneen-fullbackend.onrender.com',
    IO.OptionBuilder()
      .setTransports(['websocket'])
      .disableAutoConnect()
      .setAuth({'token': token})
      .build(),
  );

  socket.connect();
  return socket;
}
```

### C2) Event to listen (Passenger)

Listen for:
- **`ride:driver_location`**

Payload example:

```json
{
  "rideId": "...",
  "location": { "latitude": 31.52, "longitude": 74.35, "timestamp": "..." },
  "speed": 45,
  "heading": 90
}
```

---

## Part D — Driver app implementation (sending location)

### D1) When to start sending

Start sending only when:
- Driver has **accepted** the ride
- Driver has **started** the ride, and backend status is **`in-progress`**

If the driver app sends before `in-progress`, backend will reject it.

### D2) Frequency

Recommended:
- Every **5–10 seconds**, OR
- On significant location change (plus a minimum interval)

### D3) REST method (recommended)

Pseudo-service (Dart):

```dart
Future<void> sendDriverLocation({
  required Dio dio,
  required String baseUrl, // https://baneen-fullbackend.onrender.com/api/v1
  required String token,
  required String rideId,
  required double latitude,
  required double longitude,
  double? speedKmh,
  double? headingDegrees,
}) async {
  await dio.put(
    '$baseUrl/rides/$rideId/location',
    data: {
      'latitude': latitude,
      'longitude': longitude,
      if (speedKmh != null) 'speed': speedKmh,
      if (headingDegrees != null) 'heading': headingDegrees,
    },
    options: Options(
      headers: {'Authorization': 'Bearer $token'},
    ),
  );
}
```

### D4) Getting GPS (Geolocator)

Checklist:
- Ensure service enabled
- Request permission
- Get position

Use `Position.speed` and `Position.heading` when available.

### D5) Background tracking (optional / policy-sensitive)

If product requires tracking while the driver app is backgrounded:
- You must implement a **foreground service** on Android and background modes on iOS.
- Ensure compliance with Google Play / App Store policies.

If you don’t need this, keep tracking **foreground-only** (simpler).

---

## Part E — Passenger app implementation (map + live car marker)

### E1) Track Ride screen flow

On screen open:

1) Call `GET /rides/:id`
2) Render Google Map:
   - Pickup marker (`ride.pickup.location`)
   - Destination marker (`ride.destination.location`)
   - Car marker at `ride.tracking.currentLocation` (or last point in `ride.tracking.path`)
3) Connect socket
4) Listen to `ride:driver_location`
5) On each event:
   - Update car marker position
   - Optionally animate camera to keep car visible
   - Optionally rotate car icon using `heading`

### E2) Minimal map widget pattern (marker update)

Store a `Marker` for the car and update it in `setState` (or via your state manager):

```dart
Marker buildCarMarker(LatLng pos, {double? heading}) {
  return Marker(
    markerId: const MarkerId('car'),
    position: pos,
    rotation: heading ?? 0,
    anchor: const Offset(0.5, 0.5),
    flat: true,
    // icon: custom bitmap for a car is recommended
  );
}
```

### E3) Reconnect strategy (important)

If socket disconnects:
- Keep the map open
- Poll `GET /rides/:id` every **10–15 seconds** until socket reconnects
- When socket reconnects, stop polling

Always use `GET /rides/:id` on screen open to recover the latest state.

---

## Part F — Data fields you must use (from backend)

From `GET /rides/:id`, you will use:

- `status` (must be `in-progress` for live updates)
- `pickup.location` and `pickup.address`
- `destination.location` and `destination.address`
- `tracking.currentLocation`
- `tracking.path` (optional polyline of traveled path)
- `tracking.speed`, `tracking.heading` (optional UI)

From socket `ride:driver_location`:

- `location.latitude`
- `location.longitude`
- `heading` (optional: marker rotation)
- `speed` (optional)

---

## Part G — Testing plan (end-to-end)

### G1) Driver-side test (REST)

Prereqs:
- A ride with status **`in-progress`**
- Driver token

Call:
- `PUT /api/v1/rides/<RIDE_ID>/location`

Expected:
- 200 response with `updated: true`

### G2) Passenger-side test (REST initial state)

Prereqs:
- Passenger token

Call:
- `GET /api/v1/rides/<RIDE_ID>`

Expected:
- `tracking.currentLocation` updates after driver sends
- `tracking.path` grows

### G3) Passenger-side test (Socket)

1) Passenger connects socket with JWT
2) Driver sends location updates

Expected:
- Passenger receives repeated **`ride:driver_location`**

---

## Part H — Recommended Flutter structure (so it stays maintainable)

### H1) Suggested modules

- `lib/services/api_client.dart` (Dio + auth header)
- `lib/services/tracking_api.dart` (PUT/GET ride tracking)
- `lib/services/socket_client.dart` (Socket.io connect + events)
- `lib/features/driver/driver_tracking_sender.dart` (timer + Geolocator)
- `lib/features/passenger/track_ride/track_ride_controller.dart` (state + markers)
- `lib/features/passenger/track_ride/track_ride_screen.dart` (UI)

### H2) Single source of truth

For passenger tracking UI, keep one state model:

- `LatLng carPosition`
- `double? heading`
- `List<LatLng> pathSoFar` (optional)
- `RideStatus status`

Update it from:
- `GET /rides/:id` (initial + fallback polling)
- `ride:driver_location` (real time)

---

## References

- `LIVE_TRACKING_API.md` (authoritative API + event names)
- `GOOGLE_MAPS_INTEGRATION.md` (backend maps endpoints for routes / geocode)
- `MAP_LIVE_TRACKING_IMPLEMENTATION.md` (project-level overview)

