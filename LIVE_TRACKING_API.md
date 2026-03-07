# Baneen Live Ride Tracking – API for Flutter / Mobile

This document describes how to implement **live tracking** of an active ride so the passenger sees the driver (car) moving on the map in real time.

---

## Base URL & Auth

- **Base URL:** `https://baneen-fullbackend.onrender.com/api/v1`
- **Socket URL:** `https://baneen-fullbackend.onrender.com` (same host as API, no `/api/v1` path).
- **Auth:** Send access token (JWT) in header:
  ```http
  Authorization: Bearer <access_token>
  ```
- **Socket auth:** Pass token when connecting (see Socket section below).

---

## 1. Driver app: sending location

The driver must send their current location **only while the ride status is `in-progress`** (after they have started the ride).

### Option A – REST (recommended for production)

**Endpoint:** `PUT /rides/:id/location`

- **Path:** `id` = ride ID (MongoDB `_id` of the ride).
- **Headers:** `Authorization: Bearer <driver_access_token>`
- **Body (JSON):**

| Field       | Type   | Required | Description                    |
|------------|--------|----------|--------------------------------|
| `latitude` | number | Yes      | Current latitude               |
| `longitude`| number | Yes      | Current longitude              |
| `speed`    | number | No       | Speed in km/h                  |
| `heading`  | number | No       | Bearing in degrees (0–360)     |

**Example request:**
```json
PUT /api/v1/rides/507f1f77bcf86cd799439011/location
Authorization: Bearer <token>
Content-Type: application/json

{
  "latitude": 31.5204,
  "longitude": 74.3587,
  "speed": 45,
  "heading": 90
}
```

**Example success response (200):**
```json
{
  "success": true,
  "message": "Location updated successfully",
  "data": {
    "rideId": "507f1f77bcf86cd799439011",
    "currentLocation": {
      "latitude": 31.5204,
      "longitude": 74.3587,
      "timestamp": "2025-03-07T12:00:00.000Z"
    },
    "updated": true
  }
}
```

**Recommendation:** Call this every **5–10 seconds** while the ride is in progress (e.g. using a timer or when device location changes). The backend saves the location and path and pushes an update to the passenger over Socket.

---

### Option B – Socket (alternative)

Driver can also send location via Socket.io. Same data is persisted and the passenger is notified.

- **Event name (emit):** `ride:location_update`
- **Payload:**
  - `rideId` (string) – required  
  - `latitude` (number) – required  
  - `longitude` (number) – required  
  - `speed` (number) – optional  
  - `heading` (number) – optional  

**Example (Flutter / Dart pseudocode):**
```dart
socket.emit('ride:location_update', {
  'rideId': rideId,
  'latitude': position.latitude,
  'longitude': position.longitude,
  'speed': speed,
  'heading': heading,
});
```

On validation or server error, the server may emit:
- **Event:** `ride:error`
- **Payload:** `{ "type": "location_update_failed", "message": "..." }`

---

## 2. Passenger app: receiving live updates

### Initial state when opening “Track ride”

Call **GET ride details** to show the latest position and path (and to recover after reconnect).

**Endpoint:** `GET /rides/:id`

- **Path:** `id` = ride ID.
- **Headers:** `Authorization: Bearer <passenger_access_token>`

**Response** includes the ride document. For the map, use:

- **`tracking.currentLocation`** – latest driver position:
  - `latitude`, `longitude`, `timestamp`
- **`tracking.path`** – array of `{ latitude, longitude, timestamp }` for the route so far
- **`tracking.speed`**, **`tracking.heading`** – optional
- **`pickup.location`**, **`destination.location`** – for pickup/drop pins and route

**Example (relevant parts):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "in-progress",
    "pickup": {
      "location": { "latitude": 31.52, "longitude": 74.35 },
      "address": "Lahore"
    },
    "destination": {
      "location": { "latitude": 31.55, "longitude": 74.38 },
      "address": "Airport"
    },
    "tracking": {
      "currentLocation": {
        "latitude": 31.521,
        "longitude": 74.359,
        "timestamp": "2025-03-07T12:00:00.000Z"
      },
      "path": [
        { "latitude": 31.52, "longitude": 74.35, "timestamp": "..." },
        { "latitude": 31.521, "longitude": 74.359, "timestamp": "..." }
      ],
      "speed": 45,
      "heading": 90
    }
  }
}
```

Use `tracking.currentLocation` (or last point of `tracking.path`) to place the car marker when the passenger opens the screen or reconnects.

---

### Real-time updates over Socket

Connect to the same server as the API (Socket URL = API origin, no path).

**Connection (with auth):**
- **Query or auth object:** Pass the JWT so the server can identify the user (passenger).
- Example: `socket = io(SOCKET_URL, { auth: { token: accessToken } })`  
  or `extraHeaders: { Authorization: 'Bearer ' + accessToken }` if your Flutter client supports it.

**Listen for driver location:**
- **Event name:** `ride:driver_location`
- **Payload:**
  - `rideId` (string)
  - `location`: `{ latitude, longitude, timestamp? }`
  - `speed` (number or null)
  - `heading` (number or null)

**Example payload:**
```json
{
  "rideId": "507f1f77bcf86cd799439011",
  "location": {
    "latitude": 31.521,
    "longitude": 74.359,
    "timestamp": "2025-03-07T12:00:00.000Z"
  },
  "speed": 45,
  "heading": 90
}
```

On each event, update the car marker on the map to `location.latitude` and `location.longitude`. Optionally use `speed` and `heading` for UI (e.g. rotation of car icon).

---

## 3. End-to-end flow summary

| Step | Actor    | Action |
|------|----------|--------|
| 1    | Driver   | Accept ride → backend registers ride for tracking. |
| 2    | Driver   | Start ride → status becomes `in-progress`, tracking is initialized. |
| 3    | Driver   | Send location every 5–10 s: `PUT /rides/:id/location` (or `ride:location_update` via socket). |
| 4    | Backend  | Saves to DB and emits `ride:driver_location` to the passenger. |
| 5    | Passenger| On “Track ride”: `GET /rides/:id` → show map with `tracking.currentLocation` and path. |
| 6    | Passenger| Listen to `ride:driver_location` → move car marker on map. |
| 7    | Passenger| On reconnect: call `GET /rides/:id` again to get latest `tracking`. |

---

## 4. Errors (REST)

- **401** – Missing or invalid token.
- **403** – Not the driver for this ride (location endpoint).
- **400** – Missing `latitude`/`longitude`, or ride not in progress.
- **404** – Ride not found.

---

## 5. Flutter implementation checklist

**Driver:**
- [ ] After starting the ride, start a periodic timer (e.g. 5–10 s).
- [ ] Get device location (e.g. `geolocator` / `location`).
- [ ] Call `PUT /rides/:rideId/location` with `latitude`, `longitude`, optional `speed`, `heading`.
- [ ] Stop sending when ride is completed or cancelled.

**Passenger:**
- [ ] On opening “Track ride” screen, call `GET /rides/:id` and place driver marker at `tracking.currentLocation` (or last point in `tracking.path`).
- [ ] Connect Socket.io with JWT and listen for `ride:driver_location`.
- [ ] On each event, update car marker to `location.latitude`, `location.longitude`.
- [ ] On socket disconnect, optionally poll `GET /rides/:id` every 10–15 s until reconnected or ride ends.
- [ ] When ride ends, stop listening and disconnect socket if not needed elsewhere.

---

## 6. Notes

- **Ride ID:** Use the ride `_id` returned when the ride was requested/accepted (e.g. from `POST /rides/request` or `ride:accepted`).
- **Tracking only in progress:** Location updates are accepted only when `status === 'in-progress'`.
- **Path history:** All locations sent via REST or socket are appended to `tracking.path` for replay and support.

---

## 7. How to test

### Option A: Run the existing test script

From the backend folder:

```bash
# Use your Render URL (or leave default localhost)
set BASE_URL=https://baneen-fullbackend.onrender.com/api/v1
npm run test:track-ride
```

This checks that the location endpoint and tracking flow are in place (it may get 401/403 without valid tokens).

### Option B: Test with Postman / Thunder Client / Insomnia

**1. Get a driver token**

- `POST https://baneen-fullbackend.onrender.com/api/v1/auth/login`  
  Body: `{ "email": "driver@example.com", "password": "..." }` (or phone/login your app uses).  
  Copy `accessToken` from the response.

**2. Get a ride in progress**

- You need a ride whose `status` is `in-progress` (driver has already started it).  
  Either use an existing ride ID from your DB, or: request ride (passenger) → accept (driver) → start ride (driver), then copy the ride `_id`.

**3. Send a location update**

- **Method:** PUT  
- **URL:** `https://baneen-fullbackend.onrender.com/api/v1/rides/<RIDE_ID>/location`  
  Replace `<RIDE_ID>` with the actual ride ID.
- **Headers:**  
  - `Authorization: Bearer <DRIVER_ACCESS_TOKEN>`  
  - `Content-Type: application/json`
- **Body (raw JSON):**
  ```json
  {
    "latitude": 31.5204,
    "longitude": 74.3587,
    "speed": 45,
    "heading": 90
  }
  ```

You should get `200` with `"updated": true`. Then call **GET** `/rides/<RIDE_ID>` (with passenger or driver token) and check `tracking.currentLocation` and `tracking.path` in the response.

**4. Test as passenger (GET ride)**

- **Method:** GET  
- **URL:** `https://baneen-fullbackend.onrender.com/api/v1/rides/<RIDE_ID>`  
- **Headers:** `Authorization: Bearer <PASSENGER_ACCESS_TOKEN>`

Response should include `tracking.currentLocation` and `tracking.path`.

### Option C: Test Socket (optional)

Use a Socket.io client (e.g. Postman Socket.io, or a small Node script with `socket.io-client`). Connect to `https://baneen-fullbackend.onrender.com` with `auth: { token: "<DRIVER_TOKEN>" }`, then emit `ride:location_update` with `rideId`, `latitude`, `longitude`. The passenger app (or another client with passenger token) should receive `ride:driver_location`.
