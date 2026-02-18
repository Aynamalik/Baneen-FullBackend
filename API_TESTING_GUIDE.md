# 🚀 Baneen Backend API Testing Guide

## 📋 Prerequisites

### 1. Environment Setup
```bash
# Install dependencies
npm install

# Set up environment variables (.env file)
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/baneen
JWT_SECRET=your-jwt-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
# ... other env vars
```

### 2. Start the Server
```bash
npm run dev
# Server should start on http://localhost:3000
```

### 3. Testing Tools
- **Postman** (Recommended)
- **Thunder Client** (VS Code extension)
- **curl** (Command line)
- **Insomnia**

---

## 🔐 Phase 1: Authentication Testing

### 1. Register a Passenger
```bash
POST /api/v1/auth/register-passenger
Content-Type: multipart/form-data

# Form Data:
name: John Doe
email: john@example.com
phone: +923001234567
cnic: 1234567890123
password: testpassword123

# File: cnicImage (upload any image file)
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Passenger registered successfully",
  "data": {
    "user": { "_id": "...", "email": "john@example.com", "role": "passenger" },
    "profile": { "name": "John Doe" },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### 2. Register a Driver
```bash
POST /api/v1/auth/register-driver
Content-Type: multipart/form-data

# Form Data:
name: Ahmed Khan
email: ahmed@example.com
phone: +923008765432
cnic: 9876543210987
password: driverpass123

# Files:
cnicImage: (upload image)
licensePic: (upload image)
vehiclePermitPic: (upload image)
```

### 3. Login
```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "phone": "+923001234567",
  "password": "testpassword123"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "_id": "...", "email": "john@example.com", "role": "passenger" },
    "profile": null,
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### 4. Get User Profile
```bash
GET /api/v1/auth/me
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

## 🚕 Phase 2: Ride Management Testing

### 📝 Important: Use Access Token
All ride endpoints require authentication. Include this header:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### 1. Get Fare Estimate
```bash
GET /api/v1/rides/estimate?pickupLat=31.5204&pickupLng=74.3587&dropoffLat=31.4504&dropoffLng=73.1350
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "distance": 1234,
    "duration": 1456,
    "fare": {
      "baseFare": 100,
      "distanceFare": 37,
      "total": 137
    },
    "currency": "PKR"
  }
}
```

### 2. Request a Ride (Passenger)
```bash
POST /api/v1/rides/request
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

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
  "paymentMethod": "cash",
  "rideType": "one-time",
  "notes": "Please be on time"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Ride requested successfully",
  "data": {
    "rideId": "...",
    "estimatedFare": 137,
    "distance": 1234,
    "duration": 1456,
    "status": "pending"
  }
}
```

### 3. Accept Ride (Driver)
First, login as a driver and get the rideId from the previous response.

```bash
PUT /api/v1/rides/{rideId}/accept
Authorization: Bearer DRIVER_ACCESS_TOKEN
```

### 4. Start Ride (Driver)
```bash
PUT /api/v1/rides/{rideId}/start
Authorization: Bearer DRIVER_ACCESS_TOKEN
Content-Type: application/json

{
  "startCoords": {
    "latitude": 31.5204,
    "longitude": 74.3587
  }
}
```

### 5. Update Ride Location (Driver - Real-time)
```bash
PUT /api/v1/rides/{rideId}/location
Authorization: Bearer DRIVER_ACCESS_TOKEN
Content-Type: application/json

{
  "latitude": 31.4804,
  "longitude": 74.2587,
  "speed": 45,
  "heading": 90
}
```

### 6. Complete Ride (Driver)
```bash
PUT /api/v1/rides/{rideId}/complete
Authorization: Bearer DRIVER_ACCESS_TOKEN
Content-Type: application/json

{
  "endCoords": {
    "latitude": 31.4504,
    "longitude": 73.1350
  },
  "finalDistance": 1300,
  "finalDuration": 1500
}
```

### 7. Rate Ride (Passenger/Driver)
```bash
POST /api/v1/rides/{rideId}/rate
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json

{
  "rating": 5,
  "review": "Great service!"
}
```

### 8. Get Ride Details
```bash
GET /api/v1/rides/{rideId}
Authorization: Bearer ACCESS_TOKEN
```

### 9. Get Ride History
```bash
GET /api/v1/rides/history?page=1&limit=10&status=completed
Authorization: Bearer ACCESS_TOKEN
```

### 10. Get Active Rides
```bash
GET /api/v1/rides/active
Authorization: Bearer ACCESS_TOKEN
```

### 11. Get Ride Statistics
```bash
GET /api/v1/rides/stats
Authorization: Bearer ACCESS_TOKEN
```

---

## 👨‍💼 Phase 3: Admin Panel Testing

### 📊 Dashboard & Statistics

#### 1. Get Dashboard Statistics
```bash
GET /api/v1/admin/dashboard
Authorization: Bearer ADMIN_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 150,
      "totalDrivers": 45,
      "totalPassengers": 105,
      "activeRides": 8,
      "pendingApprovals": 12,
      "revenue": {
        "today": 25000,
        "week": 150000,
        "month": 600000
      }
    },
    "alerts": {
      "activeSOSAlerts": 2,
      "pendingComplaints": 5
    },
    "performance": {
      "completedRidesToday": 45,
      "cancelledRidesToday": 3,
      "completionRate": 93.8
    }
  }
}
```

### 👥 User Management

#### 2. Get All Users (with filters)
```bash
GET /api/v1/admin/users?page=1&limit=10&role=passenger&isVerified=true
Authorization: Bearer ADMIN_TOKEN
```

#### 3. Get User Details
```bash
GET /api/v1/admin/users/{userId}
Authorization: Bearer ADMIN_TOKEN
```

#### 4. Verify User Account
```bash
PUT /api/v1/admin/users/{userId}/verify
Authorization: Bearer ADMIN_TOKEN
```

#### 5. Block User Account
```bash
PUT /api/v1/admin/users/{userId}/block
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "reason": "Violation of terms of service"
}
```

#### 6. Unblock User Account
```bash
PUT /api/v1/admin/users/{userId}/unblock
Authorization: Bearer ADMIN_TOKEN
```

#### 7. Delete User Account
```bash
DELETE /api/v1/admin/users/{userId}
Authorization: Bearer ADMIN_TOKEN
```

### 🚗 Driver Management

#### 8. Get All Drivers
```bash
GET /api/v1/admin/drivers?page=1&limit=10&status=approved
Authorization: Bearer ADMIN_TOKEN
```

#### 9. Get Pending Driver Approvals
```bash
GET /api/v1/admin/drivers/pending
Authorization: Bearer ADMIN_TOKEN
```

#### 10. Approve Driver
```bash
PUT /api/v1/admin/drivers/{driverId}/approve
Authorization: Bearer ADMIN_TOKEN
```

#### 11. Reject Driver
```bash
PUT /api/v1/admin/drivers/{driverId}/reject
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "reason": "Incomplete documentation"
}
```

### 🚕 Ride Management

#### 12. Get All Rides
```bash
GET /api/v1/admin/rides?page=1&limit=10&status=completed&startDate=2024-01-01
Authorization: Bearer ADMIN_TOKEN
```

#### 13. Get Active Rides
```bash
GET /api/v1/admin/rides/active
Authorization: Bearer ADMIN_TOKEN
```

#### 14. Get Ride Details
```bash
GET /api/v1/admin/rides/{rideId}
Authorization: Bearer ADMIN_TOKEN
```

#### 15. Cancel Ride (Admin Override)
```bash
PUT /api/v1/admin/rides/{rideId}/cancel
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "reason": "Emergency maintenance",
  "refundAmount": 500
}
```

### 📈 Reports & Analytics

#### 16. Get Ride Reports
```bash
GET /api/v1/admin/reports/rides?startDate=2024-01-01&endDate=2024-01-31&groupBy=day
Authorization: Bearer ADMIN_TOKEN
```

#### 17. Get Earnings Reports
```bash
GET /api/v1/admin/reports/earnings?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer ADMIN_TOKEN
```

#### 18. Get User Reports
```bash
GET /api/v1/admin/reports/users
Authorization: Bearer ADMIN_TOKEN
```

#### 19. Get Driver Performance Reports
```bash
GET /api/v1/admin/reports/drivers
Authorization: Bearer ADMIN_TOKEN
```

### 💳 Subscription Management

#### 20. Get Subscription Plans
```bash
GET /api/v1/admin/subscriptions/plans?page=1&limit=10&status=active
Authorization: Bearer ADMIN_TOKEN
```

#### 21. Create Subscription Plan
```bash
POST /api/v1/admin/subscriptions/plans
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "name": "Premium Monthly",
  "description": "Unlimited rides for one month",
  "ridesIncluded": 100,
  "price": 5000,
  "validityDays": 30
}
```

#### 22. Update Subscription Plan
```bash
PUT /api/v1/admin/subscriptions/plans/{planId}
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "price": 5500,
  "isActive": true
}
```

#### 23. Delete Subscription Plan
```bash
DELETE /api/v1/admin/subscriptions/plans/{planId}
Authorization: Bearer ADMIN_TOKEN
```

### 🔧 System Management

#### 24. Get System Statistics
```bash
GET /api/v1/admin/system/stats
Authorization: Bearer ADMIN_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "database": {
      "collections": 8,
      "dataSize": 5242880,
      "storageSize": 8388608
    },
    "server": {
      "uptime": 3600,
      "memory": {
        "rss": 104857600,
        "heapTotal": 67108864,
        "heapUsed": 45000000
      }
    },
    "activity": {
      "activeRides": 5,
      "todayRides": 67,
      "todayCompleted": 62
    }
  }
}
```

---

## 🧪 Complete Testing Flow

### Test Scenario 1: Complete Ride Lifecycle
1. **Register 2 users** (1 passenger, 1 driver)
2. **Login** as passenger, get token
3. **Request ride** using passenger token
4. **Login** as driver, get token
5. **Accept ride** using driver token
6. **Start ride** using driver token
7. **Update location** multiple times (simulate GPS tracking)
8. **Complete ride** using driver token
9. **Rate ride** as passenger
10. **Rate ride** as driver
11. **Check ride history** for both users

### Test Scenario 2: Admin Monitoring
1. **Login** as admin
2. **View all rides** and users
3. **Generate reports** for different time periods
4. **Check system statistics**

---

## 🔧 Troubleshooting

### Common Issues:

#### 1. "Google Maps API key not configured"
**Solution:** Add `GOOGLE_MAPS_API_KEY=your_key_here` to `.env` file

#### 2. "No drivers nearby"
**Solution:** Make sure drivers are registered and set to "available" status

#### 3. "Ride cannot be started at this stage"
**Solution:** Ensure ride status is "accepted" before starting

#### 4. "Unauthorized" errors
**Solution:** Check that you're using the correct access token and user role

#### 5. MongoDB connection issues
**Solution:** Ensure MongoDB is running and connection string is correct

---

## 📊 Expected Response Codes

| Status Code | Meaning |
|-------------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## 🛠️ Sample Test Data

### Passenger Data:
```json
{
  "name": "Sarah Ahmed",
  "email": "sarah@example.com",
  "phone": "+923001234567",
  "cnic": "1234567890123",
  "password": "testpass123"
}
```

### Driver Data:
```json
{
  "name": "Mohammad Ali",
  "email": "ali@example.com",
  "phone": "+923008765432",
  "cnic": "9876543210987",
  "password": "driverpass123"
}
```

### Ride Request Data:
```json
{
  "pickupLocation": "Johar Town, Lahore",
  "dropoffLocation": "Mall Road, Lahore",
  "pickupCoords": { "latitude": 31.5204, "longitude": 74.3587 },
  "dropoffCoords": { "latitude": 31.5704, "longitude": 74.3087 },
  "paymentMethod": "cash",
  "rideType": "one-time"
}
```

---

## 📝 Testing Checklist

### Authentication
- [ ] Register passenger
- [ ] Register driver
- [ ] Login with both roles
- [ ] Get user profile
- [ ] OTP verification
- [ ] Password reset

### Ride Management
- [ ] Get fare estimate
- [ ] Request ride
- [ ] Accept ride (driver)
- [ ] Start ride (driver)
- [ ] Update location (real-time)
- [ ] Complete ride (driver)
- [ ] Rate ride (both parties)
- [ ] Get ride details
- [ ] Get ride history
- [ ] Get active rides
- [ ] Get statistics

### Admin Features
- [ ] View all users
- [ ] View all rides
- [ ] Generate reports
- [ ] System statistics

---

**🎯 Happy Testing! Your Baneen ride-sharing platform is now ready for comprehensive API testing.**