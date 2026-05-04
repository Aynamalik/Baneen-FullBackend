# Flutter Team — Baneen Backend Integration Guide

Ye document Flutter app ke liye hai: **kya karna hai, kis order me, aur kaise** (REST + Socket.IO). Sab backend ke current code ke mutabiq hai.

---

## 1) Base URL (fixed)

| Use | URL |
|-----|-----|
| **REST API base** | `https://baneen-fullbackend.onrender.com/api/v1` |
| **Socket.IO connect** | `https://baneen-fullbackend.onrender.com` |

**Important:** Socket pe `/api/v1` **mat** lagana — sirf server root. REST calls me har request ke aage base + path jodein.

**Example full REST URL:**

`https://baneen-fullbackend.onrender.com/api/v1/rides/request`

---

## 2) Har request pe kya lagta hai

- **Header:** `Authorization: Bearer <JWT>`
- **Content-Type:** `application/json` (jab body ho)
- **Role:** JWT me role hota hai — passenger routes passenger token se, driver routes driver token se.

---

## 3) Flutter side pe kya install / setup karein

1. **HTTP:** `dio` ya `http` package — saari REST calls ke liye.
2. **Socket:** `socket_io_client` — live ride updates ke liye.
3. **Storage:** JWT save karein (`flutter_secure_storage` / `shared_preferences`).
4. **Env:** Base URL ek jagah rakhein (const / `--dart-define` / env file) taake staging/production switch asaan ho.

---

## 4) Passenger flow — step by step (kya karna hai)

### Step A — Login / register

Pehle auth APIs se JWT lo (auth routes backend me `/api/v1/auth` ke under). Bina token ke ride routes 401 denge.

### Step B — Ride maango

- **POST** `{{base}}/rides/request`
- Body backend ke `rideRequestSchema` ke mutabiq (pickup, dropoff, payment, vehicle type, etc.).
- Response me **`data.rideId`** save karein — ye hi **ride ki ID** hai, baaki saari APIs isi se link hoti hain.

### Step C — Socket connect (passenger)

1. URL: `https://baneen-fullbackend.onrender.com` (HTTPS wahi jo upar hai, path nahi).
2. Handshake me token bhejein: `auth: { "token": "<passenger JWT>" }` (backend `socket.handshake.auth.token` read karta hai).
3. Connect ke baad ye events **listen** karein:

| Event | Kaam |
|--------|------|
| `ride:accepted` | Driver ne accept kiya — isi se UI me driver name, rating, vehicle, phone, ETA waghera dikhao |
| `ride:driver_location` | Map pe driver marker update — lat/lng |
| `ride:started` | Ride start |
| `ride:completed` | Ride khatam |
| `ride:cancelled` | Cancel |
| `ride:disconnected` | Connection issue hint |

### Step D — Agar socket miss ho ya app band khuli

- **GET** `{{base}}/rides/{{rideId}}` — poori ride + driver details refresh.
- **GET** `{{base}}/rides/active` — kaun si ride abhi active hai (restore state).

### Step E — Cancel / SOS (same screen buttons)

- **POST** `{{base}}/rides/{{rideId}}/cancel` — body: `{ "reason": "..." }` (required).
- **POST** `{{base}}/rides/sos/alert` — SOS; body backend ke SOS validator ke hisaab se.

### Step F — Chat (agar screen pe chat hai)

- **GET** `{{base}}/chat/rides/{{rideId}}/messages`
- **POST** `{{base}}/chat/rides/{{rideId}}/messages`

### Step G — Call button

Alag API zaroori nahi — `ride:accepted` / ride details response se **driver phone** lo aur `url_launcher` se `tel:+92...` khol do.

### Step H — Share ride

Dedicated share API nahi — `GET /rides/:id` ka data le kar app me text bana ke `Share.share()` karein.

---

## 5) Driver flow — short (accept + location)

### Accept ride (REST)

- **PUT** `{{base}}/rides/{{rideId}}/accept`
- `:rideId` wahi jo passenger request ke response / pending list me mile.
- Sirf **driver** token.

### Ya accept socket se (optional)

- Emit: `ride:accept` with `{ "rideId": "<id>" }`.

### Live location bhejna

**REST:**

- **PUT** `{{base}}/rides/{{rideId}}/location` — body: latitude, longitude, etc.

**Socket:**

- Emit: `ride:location_update` with `rideId`, `latitude`, `longitude`, optional `speed`, `heading`.

Driver app ko location stream + in dono me se ek consistent approach use karni chahiye (backend dono support karta hai; service layer passenger ko `ride:driver_location` bhejta hai).

---

## 6) Endpoint quick reference (rides + related)

Base: `https://baneen-fullbackend.onrender.com/api/v1`

| Method | Path | Role / Note |
|--------|------|----------------|
| POST | `/rides/request` | Passenger — save `rideId` |
| PUT | `/rides/:id/accept` | Driver — `:id` = **rideId** |
| GET | `/rides/:id` | Details |
| GET | `/rides/active` | Active rides |
| POST | `/rides/:id/cancel` | Passenger/Driver + `reason` |
| POST | `/rides/sos/alert` | SOS body per validator |
| PUT | `/rides/:id/location` | Driver |
| PUT | `/rides/:id/start` | Driver (multipart + body per backend) |
| PUT | `/rides/:id/complete` | Driver |
| GET | `/chat/rides/:rideId/messages` | Chat |
| POST | `/chat/rides/:rideId/messages` | Chat |

Baki modules (`/auth`, `/drivers`, `/passengers`, etc.) alag docs / Postman collection se dekhein.

---

## 7) Parsing / errors se bachen (important)

- Response shape aksar: `{ "success": true/false, "message": "...", "data": { ... } }`.
- **`rideId`** kabhi `data.rideId`, kabhi nested object me — parse karte waqt `data` ka type check karein (`Map` vs `List`).
- Error: `type 'String' is not a subtype of type 'int' of 'index'` — zyada tar **List ko Map ki tarah** `['key']` se access karne se aata hai. Pehle `json.runtimeType` / `data is List` check karein.

---

## 8) Testing checklist (Flutter QA)

- [ ] Base URL exactly `https://baneen-fullbackend.onrender.com/api/v1` for REST.
- [ ] Socket `https://baneen-fullbackend.onrender.com` without `/api/v1`.
- [ ] Passenger token se `ride:accepted` sun raha hai accept ke baad.
- [ ] `rideId` path me sahi string hai (Mongo ObjectId format).
- [ ] Cancel me `reason` bhej rahe hain.
- [ ] Reopen app par `GET /rides/active` ya `GET /rides/:id` se state restore.

---

## 9) Related files in repo

- Quick socket + ride list: `FLUTTER_RIDE_API_SOCKET_HANDOFF.md`
- Postman: `Baneen_API_Postman_Collection.json`

---

**Short summary for daily standup:**  
REST base = `https://baneen-fullbackend.onrender.com/api/v1`, Socket = same host without `/api/v1`, JWT in header + socket `auth.token`, passenger `ride:accepted` + `ride:driver_location` suno, `rideId` hamesha request response se save karo.
