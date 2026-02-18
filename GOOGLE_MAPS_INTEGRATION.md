# 🗺️ Google Maps API Integration Guide

## Overview

The Baneen backend integrates Google Maps API for:
- **Route Calculation**: Get directions, distance, and duration between locations
- **Geocoding**: Convert addresses to coordinates
- **Reverse Geocoding**: Convert coordinates to addresses
- **Place Search**: Search for places and locations
- **Fare Estimation**: Calculate ride fares based on route distance

---

## 🔑 Setup

### 1. Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - **Directions API**
   - **Distance Matrix API**
   - **Geocoding API**
   - **Places API** (optional, for place search)
4. Create credentials (API Key)
5. Restrict the API key (recommended for production)

### 2. Configure Environment Variable

Add to your `.env` file:

```env
GOOGLE_MAPS_API_KEY=your-api-key-here
```

### 3. Required APIs

Make sure these APIs are enabled in Google Cloud Console:
- ✅ Directions API
- ✅ Distance Matrix API
- ✅ Geocoding API
- ✅ Places API (optional)

---

## 📍 API Endpoints

### 1. Geocode Address
Convert an address to coordinates.

**Endpoint:** `GET /api/v1/maps/geocode`

**Query Parameters:**
- `address` (required): Address string

**Example:**
```bash
GET /api/v1/maps/geocode?address=Johar Town, Lahore, Pakistan
```

**Response:**
```json
{
  "success": true,
  "data": {
    "latitude": 31.5204,
    "longitude": 74.3587,
    "formattedAddress": "Johar Town, Lahore, Punjab, Pakistan",
    "placeId": "ChIJ...",
    "types": ["neighborhood", "political"],
    "addressComponents": [...]
  }
}
```

---

### 2. Reverse Geocode
Convert coordinates to an address.

**Endpoint:** `GET /api/v1/maps/reverse-geocode`

**Query Parameters:**
- `latitude` (required): Latitude coordinate
- `longitude` (required): Longitude coordinate

**Example:**
```bash
GET /api/v1/maps/reverse-geocode?latitude=31.5204&longitude=74.3587
```

**Response:**
```json
{
  "success": true,
  "data": {
    "formattedAddress": "Johar Town, Lahore, Punjab, Pakistan",
    "placeId": "ChIJ...",
    "types": ["neighborhood", "political"],
    "addressComponents": [...],
    "geometry": {...}
  }
}
```

---

### 3. Search Places
Search for places using text query.

**Endpoint:** `GET /api/v1/maps/places/search`

**Query Parameters:**
- `query` (required): Search query string
- `latitude` (optional): Center latitude for location-based search
- `longitude` (optional): Center longitude for location-based search
- `radius` (optional): Search radius in meters (default: 5000)

**Example:**
```bash
GET /api/v1/maps/places/search?query=restaurants&latitude=31.5204&longitude=74.3587&radius=2000
```

**Response:**
```json
{
  "success": true,
  "data": {
    "places": [
      {
        "placeId": "ChIJ...",
        "name": "Restaurant Name",
        "address": "123 Main St, Lahore",
        "location": {
          "latitude": 31.5204,
          "longitude": 74.3587
        },
        "types": ["restaurant", "food"],
        "rating": 4.5,
        "priceLevel": 2
      }
    ],
    "count": 1
  }
}
```

---

### 4. Get Directions
Get detailed directions between two points.

**Endpoint:** `GET /api/v1/maps/directions`

**Query Parameters:**
- `originLat` (required): Origin latitude
- `originLng` (required): Origin longitude
- `destLat` (required): Destination latitude
- `destLng` (required): Destination longitude

**Example:**
```bash
GET /api/v1/maps/directions?originLat=31.5204&originLng=74.3587&destLat=31.4504&destLng=73.1350
```

**Response:**
```json
{
  "success": true,
  "data": {
    "distance": 5000,
    "duration": 600,
    "distanceText": "5.0 km",
    "durationText": "10 mins",
    "polyline": "encoded_polyline_string",
    "bounds": {...},
    "steps": [...],
    "waypoints": [...]
  }
}
```

---

## 🚕 Ride Request Integration

### Automatic Geocoding

The ride request endpoint now supports **both coordinates and addresses**:

**Option 1: With Coordinates (existing)**
```json
{
  "pickupLocation": "Johar Town, Lahore",
  "dropoffLocation": "Model Town, Lahore",
  "pickupCoords": {
    "latitude": 31.5204,
    "longitude": 74.3587
  },
  "dropoffCoords": {
    "latitude": 31.4504,
    "longitude": 73.1350
  },
  "paymentMethod": "cash"
}
```

**Option 2: With Addresses Only (new)**
```json
{
  "pickupLocation": "Johar Town, Lahore, Pakistan",
  "dropoffLocation": "Model Town, Lahore, Pakistan",
  "paymentMethod": "cash"
}
```

If coordinates are not provided, the system will automatically geocode the addresses.

---

## 💰 Fare Estimate Integration

### Support for Addresses

The fare estimate endpoint now supports addresses:

**With Coordinates:**
```bash
GET /api/v1/rides/estimate?pickupLat=31.5204&pickupLng=74.3587&dropoffLat=31.4504&dropoffLng=73.1350
```

**With Addresses:**
```bash
GET /api/v1/rides/estimate?pickupAddress=Johar Town, Lahore&dropoffAddress=Model Town, Lahore
```

**Mixed (coordinates + address):**
```bash
GET /api/v1/rides/estimate?pickupLat=31.5204&pickupLng=74.3587&dropoffAddress=Model Town, Lahore
```

---

## 🔄 Fallback Mechanism

The system includes **automatic fallback** when Google Maps API fails:

1. **Primary**: Google Maps Directions API
2. **Fallback**: Haversine distance calculation + estimated travel time

The fallback uses:
- **Haversine Formula**: Calculates straight-line distance between coordinates
- **Average Speed**: Estimates travel time based on 30 km/h average speed

**Note**: Fallback mode doesn't provide:
- Route polyline
- Turn-by-turn directions
- Real-time traffic data

---

## 🛠️ Service Functions

### Available Functions

Located in `src/services/maps.service.js`:

1. **`getDistanceFromGoogle(pickupCoords, dropoffCoords)`**
   - Uses Distance Matrix API
   - Returns distance and duration

2. **`getDirectionsFromGoogle(pickupCoords, dropoffCoords)`**
   - Uses Directions API
   - Returns full route information including polyline

3. **`geocodeAddress(address)`**
   - Uses Geocoding API
   - Converts address to coordinates

4. **`reverseGeocode(latitude, longitude)`**
   - Uses Geocoding API
   - Converts coordinates to address

5. **`searchPlaces(query, location, radius)`**
   - Uses Places API
   - Searches for places

6. **`calculateHaversineDistance(lat1, lon1, lat2, lon2)`** (Fallback)
   - Calculates straight-line distance

7. **`estimateTravelTime(distanceKm, averageSpeedKmh)`** (Fallback)
   - Estimates travel time

---

## ⚠️ Error Handling

### Common Errors

1. **API Key Not Configured**
   ```
   Error: Google Maps API key not configured
   ```
   **Solution**: Add `GOOGLE_MAPS_API_KEY` to `.env` file

2. **API Not Enabled**
   ```
   Error: Google Maps API error: This API project is not authorized to use this API
   ```
   **Solution**: Enable required APIs in Google Cloud Console

3. **Quota Exceeded**
   ```
   Error: Google Maps API error: OVER_QUERY_LIMIT
   ```
   **Solution**: Check API usage limits in Google Cloud Console

4. **Invalid Address**
   ```
   Error: Address not found
   ```
   **Solution**: Provide a more specific address

5. **No Route Found**
   ```
   Error: No route found between the specified locations
   ```
   **Solution**: Check if locations are accessible by road

---

## 📊 Rate Limits & Quotas

### Free Tier Limits (per month)

- **Directions API**: 40,000 requests
- **Distance Matrix API**: 40,000 requests
- **Geocoding API**: 40,000 requests
- **Places API**: 1,000 requests

### Best Practices

1. **Cache Results**: Cache geocoded addresses to reduce API calls
2. **Batch Requests**: Use Distance Matrix API for multiple origins/destinations
3. **Monitor Usage**: Set up billing alerts in Google Cloud Console
4. **Use Fallback**: System automatically falls back when API fails

---

## 🔒 Security

### API Key Restrictions

1. **Application Restrictions**:
   - Restrict by IP address (for server-side)
   - Restrict by HTTP referrer (for client-side)

2. **API Restrictions**:
   - Only enable required APIs
   - Disable unused APIs

3. **Environment Variables**:
   - Never commit API keys to version control
   - Use `.env` file (already in `.gitignore`)

---

## 📝 Example Usage

### Complete Ride Request Flow

```javascript
// 1. Geocode addresses (if needed)
GET /api/v1/maps/geocode?address=Johar Town, Lahore

// 2. Get fare estimate
GET /api/v1/rides/estimate?pickupLat=31.5204&pickupLng=74.3587&dropoffLat=31.4504&dropoffLng=73.1350

// 3. Request ride
POST /api/v1/rides/request
{
  "pickupLocation": "Johar Town, Lahore",
  "dropoffLocation": "Model Town, Lahore",
  "pickupCoords": { "latitude": 31.5204, "longitude": 74.3587 },
  "dropoffCoords": { "latitude": 31.4504, "longitude": 73.1350 },
  "paymentMethod": "cash"
}
```

---

## 🧪 Testing

### Test Geocoding

```bash
curl "http://localhost:3000/api/v1/maps/geocode?address=Johar Town, Lahore"
```

### Test Reverse Geocoding

```bash
curl "http://localhost:3000/api/v1/maps/reverse-geocode?latitude=31.5204&longitude=74.3587"
```

### Test Place Search

```bash
curl "http://localhost:3000/api/v1/maps/places/search?query=restaurants&latitude=31.5204&longitude=74.3587"
```

### Test Directions

```bash
curl "http://localhost:3000/api/v1/maps/directions?originLat=31.5204&originLng=74.3587&destLat=31.4504&destLng=73.1350"
```

---

## 📚 Additional Resources

- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
- [Directions API Guide](https://developers.google.com/maps/documentation/directions)
- [Geocoding API Guide](https://developers.google.com/maps/documentation/geocoding)
- [Places API Guide](https://developers.google.com/maps/documentation/places/web-service)

---

## ✅ Integration Checklist

- [x] Google Maps API key configured
- [x] Required APIs enabled
- [x] Geocoding support in ride request
- [x] Reverse geocoding endpoint
- [x] Place search endpoint
- [x] Directions endpoint
- [x] Fallback mechanism implemented
- [x] Error handling added
- [x] Address support in fare estimate
- [x] Documentation created

---

**Last Updated:** 2026-01-26
**Version:** 1.0.0
