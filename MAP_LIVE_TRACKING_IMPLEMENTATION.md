# Real Map & Live Car Tracking – Implementation Guide

This guide explains **what you need** and **how to implement** a real map in your app that shows the car moving with live tracking during an active ride.

---

## What You Need (Requirements)

### 1. Backend (already in place)

Your backend already supports live tracking:

- **REST:** `PUT /rides/:id/location` – driver sends location every 5–10 seconds
- **Socket:** `ride:location_update` (driver) → backend saves and emits `ride:driver_location` (passenger)
- **Passenger:** `GET /rides/:id` returns `tracking.currentLocation`, `tracking.path`, pickup/destination

See **LIVE_TRACKING_API.md** for full API details.

### 2. In Your App (what you must add)

| Requirement | Purpose |
|-------------|--------|
| **Map SDK** | Show a real map (Google Maps, Mapbox, etc.) and draw markers/polylines |
| **Google Maps API key** (for app) | If using Google Maps in the app – enable **Maps SDK for Android**, **Maps SDK for iOS**, and/or **Maps JavaScript API** (web) in Google Cloud Console. Restrict by app package/bundle ID or HTTP referrer. |
| **Location permission** | Driver app needs “while in use” (or “always” if you want background updates) to get GPS and send to backend |
| **Socket.io client** | Passenger receives `ride:driver_location` in real time |
| **Ride ID** | From ride request/accept flow; needed for `GET /rides/:id` and `PUT /rides/:id/location` |

### 3. Optional but useful

- **Route polyline** – Use backend Directions API (`GET /api/v1/maps/directions`) to draw the route from pickup to destination so the car moves along a visible path.
- **Car icon rotation** – Use `heading` from `ride:driver_location` to rotate the car marker.

---

## High-Level Flow

```
Driver (after "Start ride")          Backend                    Passenger ("Track ride" screen)
─────────────────────────           ───────                    ─────────────────────────────
Get GPS every 5–10 s
  → PUT /rides/:id/location    →    Save to ride.tracking
  or emit ride:location_update        → emit ride:driver_location  →  Listen ride:driver_location
                                                                   →  Move car marker on map
                                                                   GET /rides/:id on open
                                                                   →  Show map + driver at
                                                                      tracking.currentLocation
```

---

## Step-by-Step Implementation

### Step 1: Choose and set up the map in your app

- **Flutter:** Use `google_maps_flutter` (or `flutter_map` / Mapbox). Add dependency and configure Android/iOS with your **Maps API key** (different from backend key if you want; can be same key with both server and app restrictions).
- **React Native:** Use `react-native-maps` with Google Maps (needs API key in app config).
- **Web:** Use Google Maps JavaScript API (or Mapbox GL JS) with an API key and optional HTTP referrer restriction.

Ensure the map shows:
- A **driver/car marker** (position from `tracking.currentLocation` or `ride:driver_location`).
- Optional: **pickup** and **destination** markers from `ride.pickup.location` and `ride.destination.location`.
- Optional: **route line** from Directions API between pickup and destination.

### Step 2: Driver app – send location during ride

Only when **ride status is `in-progress`** (after driver taps “Start ride”):

1. Start a **timer** (e.g. every 5–10 seconds).
2. Get **current position** (e.g. `geolocator` in Flutter, `navigator.geolocation` or `@react-native-community/geolocation` in RN).
3. Send to backend:
   - **REST:** `PUT /api/v1/rides/:rideId/location` with body:
     ```json
     { "latitude": 31.52, "longitude": 74.35, "speed": 45, "heading": 90 }
     ```
   - **Socket:** Emit `ride:location_update` with `rideId`, `latitude`, `longitude`, optional `speed`, `heading`.
4. **Stop** the timer when the ride is completed or cancelled.

The backend saves the location and path and pushes `ride:driver_location` to the passenger.

### Step 3: Passenger app – “Track ride” screen with real map

1. **On screen open**
   - Call `GET /api/v1/rides/:rideId` (with passenger token).
   - From the response:
     - Put the **driver/car marker** at `data.tracking.currentLocation` (or last point of `data.tracking.path` if `currentLocation` is missing).
     - Optionally draw **path so far** using `data.tracking.path` (polyline).
     - Add **pickup** and **destination** from `data.pickup.location` and `data.destination.location`.
   - Optional: Fetch route from `GET /api/v1/maps/directions?origin=...&destination=...` and draw the route polyline on the map.

2. **Real-time updates**
   - Connect **Socket.io** to your backend (e.g. `https://baneen-fullbackend.onrender.com`) with **JWT** in auth.
   - **Listen** for `ride:driver_location`.
   - Payload: `rideId`, `location: { latitude, longitude, timestamp }`, optional `speed`, `heading`.
   - On each event: **move the car marker** to `location.latitude`, `location.longitude`. Optionally rotate by `heading`.

3. **Reconnect**
   - If the socket disconnects, call `GET /rides/:id` again every 10–15 seconds until reconnected or ride ends, and update the car position from `tracking.currentLocation`.

4. **When ride ends**
   - Stop listening for `ride:driver_location` and leave or repurpose the screen.

### Step 4: (Optional) Draw route on the map

To show the planned route (pickup → destination):

- Call your backend: `GET /api/v1/maps/directions?origin=lat,lng&destination=lat,lng` (see **GOOGLE_MAPS_INTEGRATION.md**).
- Use the returned polyline (or list of points) to draw a line on the map. The live car marker will move along/near this route as the driver sends location.

---

## Summary Checklist

**Backend**
- [x] `PUT /rides/:id/location` (driver)
- [x] Socket `ride:location_update` (driver) and `ride:driver_location` (passenger)
- [x] `GET /rides/:id` with `tracking.currentLocation` and `tracking.path`
- [x] Directions API for route (optional)

**Driver app**
- [ ] Map SDK + API key (if you show a map for driver)
- [ ] Location permission
- [ ] After “Start ride”, timer 5–10 s → get GPS → `PUT /rides/:rideId/location` or `ride:location_update`
- [ ] Stop sending when ride completed/cancelled

**Passenger app**
- [ ] Map SDK + API key
- [ ] “Track ride” screen: `GET /rides/:id` → show map with car at `tracking.currentLocation`, pickup/destination
- [ ] Socket.io connect with JWT, listen `ride:driver_location` → move car marker
- [ ] Optional: directions API for route polyline; optional: path polyline from `tracking.path`

**Google Cloud (for map in app)**
- [ ] Enable **Maps SDK for Android** and/or **Maps SDK for iOS** and/or **Maps JavaScript API** (web)
- [ ] Create/use API key and restrict by app (package name / bundle ID) or referrer (web)

---

## Related Docs

- **LIVE_TRACKING_API.md** – Full API for driver location and passenger live updates
- **GOOGLE_MAPS_INTEGRATION.md** – Backend maps (directions, geocode); use same or new key for app map
- **DRIVER_ONLINE_API.md** – Driver go online and pending rides
