# Flutter Ride API + Socket Handoff

This document is based on the current backend code and routes.

## Environment

- **Base API URL:** `https://baneen-fullbackend.onrender.com/api/v1`
- **Socket URL:** `https://baneen-fullbackend.onrender.com`
- **Auth Header:** `Authorization: Bearer <JWT>`
- **Socket Auth:** send token in handshake as:
  - `auth: { token: "<JWT>" }`
  - backend also supports query token fallback

---

## Core Ride Flow (Passenger + Driver)

1. Passenger requests a ride
2. Driver accepts ride
3. Passenger receives driver info in real-time
4. Driver sends live location updates
5. Passenger sees map updates + ETA

---

## REST APIs Used On Passenger "Driver Assigned / Live Ride" Screen

### 1) Request Ride (Passenger)
- **Method:** `POST`
- **Path:** `/rides/request`
- **Use:** create ride request
- **Important:** store returned `data.rideId`

### 2) Accept Ride (Driver)
- **Method:** `PUT`
- **Path:** `/rides/:id/accept`
- **Use:** driver accepts a pending ride
- **Important:** `:id` must be the **rideId** from request response
- **Example:** `/rides/680f8b7c2e9a4c1234567890/accept`

### 3) Get Ride Details (Passenger/Driver)
- **Method:** `GET`
- **Path:** `/rides/:id`
- **Use:** fallback refresh and full ride details

### 4) Get Active Rides (Passenger/Driver)
- **Method:** `GET`
- **Path:** `/rides/active`
- **Use:** restore current ride state after app reopen/reconnect

### 5) Cancel Ride
- **Method:** `POST`
- **Path:** `/rides/:id/cancel`
- **Use:** cancel current ride
- **Body example:**
```json
{
  "reason": "Passenger requested cancellation"
}
```

### 6) SOS Alert
- **Method:** `POST`
- **Path:** `/rides/sos/alert`
- **Use:** emergency alert from passenger/driver
- **Note:** send body according to SOS validator schema implemented in backend

---

## Socket Events For Live Ride UX

## Connect

Connect to:
- `https://baneen-fullbackend.onrender.com`

Send JWT in handshake:
```json
{
  "token": "<JWT>"
}
```

## Passenger Should Listen To

- `ride:accepted`
  - fired when driver accepts ride
  - includes ride + driver details
- `ride:driver_location`
  - driver live location updates for map marker movement
- `ride:started`
- `ride:completed`
- `ride:cancelled`
- `ride:disconnected` (network/connection interruptions)

## Driver Can Emit

- `ride:accept`
```json
{
  "rideId": "<rideId>"
}
```

- `ride:location_update`
```json
{
  "rideId": "<rideId>",
  "latitude": 24.8607,
  "longitude": 67.0011,
  "speed": 20,
  "heading": 140
}
```

---

## Chat / Call / Share Actions On This Screen

### Chat APIs
- `GET /chat/rides/:rideId/messages`
- `POST /chat/rides/:rideId/messages`

### Call Button
- Use driver phone from ride/accept payload and open device dialer (`tel:`)
- No separate backend call endpoint required in current ride routes

### Share Ride Details
- Use data from `GET /rides/:id` and build local share text
- No dedicated backend "share" endpoint in current code

---

## Integration Rules (Important)

- `:id` in ride routes means **rideId** (not passengerId, not driverId)
- For accept API, do not send query `?id=...`; use path param `/rides/:id/accept`
- Use role-correct tokens:
  - Passenger token for passenger routes
  - Driver token for accept/location/start/complete flows
- Keep REST fallback for reconnect cases even when sockets are active

---

## Suggested Frontend Sequence (Passenger Side)

1. Call `POST /rides/request`
2. Save `rideId`
3. Start socket connection with passenger JWT
4. Listen for `ride:accepted`
5. On event, render driver card and route UI
6. Update map on each `ride:driver_location`
7. If socket reconnects or app resumes, call `GET /rides/:id` or `GET /rides/active`

