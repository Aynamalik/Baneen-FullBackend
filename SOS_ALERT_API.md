# SOS Alert – API for Flutter

This document describes the **SOS (emergency) alert** feature: how to trigger it from the passenger or driver app and what the backend does.

---

## Base URL and auth

- **Base URL:** `https://baneen-fullbackend.onrender.com/api/v1`
- **Auth:** `Authorization: Bearer <access_token>` (passenger or driver token)
- **Who can trigger:** Passengers and drivers only (not admin or unauthenticated)

---

## What happens when SOS is triggered

1. **Alert is created** in the database (status `active`) with user, **live location**, optional ride link.
2. **Live location** is taken from (in order):
   - **Request body** (`latitude`, `longitude`, optional `address`) – **recommended**: Flutter should send the user’s current GPS when they tap SOS so emergency contacts get their **live location**.
   - If user has an **active ride** and no body location: from the ride’s **current tracking** location (driver’s last update), or pickup.
   - If neither is available, the API returns an error (location required).
3. **Emergency contacts (passenger and driver):** If the user has emergency contacts saved in their profile (passenger or driver), the backend sends **each contact an SMS** with:
   - “URGENT: [Name] has triggered an SOS alert.”
   - **Location** (address or coordinates).
   - **Google Maps link** to open the exact spot: `https://www.google.com/maps?q=lat,lng`.
   So when driver/passenger hits SOS, their **live location is sent to their emergency contacts** via SMS.
4. **Admins:** All admins are notified (in-app notification) so they can see and resolve the alert in the admin panel.
5. **If there is an active ride:** The alert is linked to that ride and stored in `ride.safety.sosAlerts` for history.

---

## API: Trigger SOS

**Endpoint:** `POST /rides/sos/alert`

**Headers:**

| Header          | Value                         |
|-----------------|-------------------------------|
| `Authorization` | `Bearer <passenger_or_driver_token>` |
| `Content-Type`  | `application/json`            |

**Body (all fields optional but recommended):**

| Field         | Type   | Required | Description |
|---------------|--------|----------|-------------|
| `location`   | object | No*      | User’s current location. |
| `location.latitude`  | number | If `location` sent | Latitude |
| `location.longitude` | number | If `location` sent | Longitude |
| `location.address`   | string | No       | Human-readable address |
| `rideId`      | string | No       | Active ride ID (if user is in a ride). Backend can also detect active ride automatically. |
| `description` | string | No       | Short description (max 500 chars) |
| `severity`    | string | No       | `low` \| `medium` \| `high` \| `critical` (default: `high`) |
| `source`      | string | No       | e.g. `voice_command` for voice-activated SOS |

\* If **location** is not sent and the user has an **active ride**, the backend uses the ride’s current tracking location (or pickup). If there is no ride or no location on the ride, the backend returns **400** and asks for location (e.g. “Enable GPS and try again”).

**Example 1 – With explicit location (recommended in app):**

```http
POST https://baneen-fullbackend.onrender.com/api/v1/rides/sos/alert
Authorization: Bearer <token>
Content-Type: application/json

{
  "location": {
    "latitude": 31.5204,
    "longitude": 74.3587,
    "address": "Near Mall Road, Lahore"
  },
  "description": "Need help immediately",
  "severity": "critical"
}
```

**Example 2 – During an active ride (location can be omitted):**

```http
POST https://baneen-fullbackend.onrender.com/api/v1/rides/sos/alert
Authorization: Bearer <token>
Content-Type: application/json

{
  "rideId": "507f1f77bcf86cd799439011",
  "description": "Emergency during ride"
}
```

Backend will use the ride’s live location (or pickup) if `location` is not provided.

**Success response (201):**

```json
{
  "success": true,
  "message": "SOS alert triggered. Help has been notified.",
  "data": {
    "alert": {
      "_id": "507f1f77bcf86cd799439099",
      "status": "active",
      "location": {
        "latitude": 31.5204,
        "longitude": 74.3587,
        "address": "Near Mall Road, Lahore"
      },
      "createdAt": "2025-03-07T12:00:00.000Z",
      "emergencyContactsNotified": 2
    },
    "rideId": "507f1f77bcf86cd799439011"
  }
}
```

**Error responses:**

- **400** – Missing location (and no active ride with location), or validation error.
- **403** – User is not passenger or driver.
- **401** – Invalid or missing token.

---

## Flutter implementation guide

### When to call the API

- User taps a dedicated **“SOS”** or **“Emergency”** button (e.g. on ride screen or home).
- Optionally: after voice command “SOS” / “emergency” (your app can then call this API with `source: "voice_command"`).

### What to send

1. **Best practice:** Get device location (GPS) and send it in `location` so the alert always has coordinates (and optional `address` from reverse geocode).
2. If the user is in an **active ride**, you can also send `rideId`; backend will link the alert to the ride and can fall back to ride location if you don’t send `location`.
3. Optional: `description` (user message), `severity` (e.g. `critical` for one-tap SOS).

### What to do after calling

- Show a clear message: “SOS sent. Emergency contacts and Baneen have been notified.”
- If you have emergency contacts in the passenger profile, you can mention “Your emergency contacts have been messaged.”
- Optionally open dialer for emergency number (e.g. 1122 / 911) for the user to call as well.

### Emergency contacts (passenger and driver)

- **Passenger:** Emergency contacts are stored in the passenger profile (`POST/PUT/DELETE /passengers/emergency-contacts`). When a passenger triggers SOS, the backend sends SMS with **live location** and Maps link to those contacts.
- **Driver:** Emergency contacts are stored in the driver profile (`POST/PUT/DELETE /drivers/emergency-contacts`). When a driver triggers SOS, the backend sends SMS with **live location** and Maps link to those contacts.
- No extra API call is needed at SOS time; just trigger SOS. Ensure the user has added emergency contacts in profile/settings so they receive the SMS.

---

## Admin side (for reference)

Admins use the **admin** API/panel, not the Flutter app:

- **GET** `/admin/sos/alerts` – list SOS alerts (with filters).
- **GET** `/admin/sos/alerts/active` – active alerts only.
- **GET** `/admin/sos/alerts/:id` – single alert details.
- **PUT** `/admin/sos/alerts/:id/resolve` – mark alert as resolved (with notes).

Flutter app only needs to **trigger** SOS via `POST /rides/sos/alert`.

---

## Summary

| Item | Details |
|------|--------|
| **Endpoint** | `POST /rides/sos/alert` |
| **Auth** | Passenger or driver JWT |
| **Body** | Optional `location` (recommended for live location), optional `rideId`, `description`, `severity`, `source` |
| **Live location** | From body (current GPS), or from active ride’s tracking/pickup if no body location. This location is sent to emergency contacts via SMS with a Google Maps link. |
| **Backend actions** | Creates alert; sends **SMS to user’s emergency contacts** (passenger or driver) with **live location and Maps link**; notifies admins; links to ride if present |
| **Flutter** | One-tap SOS; get current GPS and send in `location` so emergency contacts get live location; show “Help has been notified. Your emergency contacts have been messaged.” |
| **Driver emergency contacts** | Add/edit via `POST /drivers/emergency-contacts`, `PUT /drivers/emergency-contacts/:id`, `DELETE /drivers/emergency-contacts/:id`; returned in `GET /drivers/profile` |
