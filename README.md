# Baneen Backend API

Backend API for Baneen ride-sharing platform built with Express.js, MongoDB, and Socket.io.

## Features

- User authentication and authorization (JWT)
- Ride management and real-time tracking
- Payment processing (Easypaisa, JazzCash)
- Subscription management
- SOS emergency alerts
- In-app chat and AI chatbot
- Push notifications (FCM) and SMS
- Admin dashboard APIs
- Safety features (helmet/seatbelt detection)

## Technology Stack

- **Runtime:** Node.js v18+
- **Framework:** Express.js v4.x
- **Database:** MongoDB with Mongoose
- **Real-time:** Socket.io
- **Authentication:** JWT (jsonwebtoken, bcryptjs)
- **Validation:** Joi
- **Logging:** Winston

## Getting Started

### Prerequisites

- Node.js v18 or higher
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your configuration values

5. Start the development server:
   ```bash
   npm run dev
   ```

6. The API will be available at `http://localhost:3000`

## Project Structure

```
baneen-backend/
├── src/
│   ├── config/          # Configuration files
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── controllers/     # Route controllers
│   ├── services/        # Business logic services
│   ├── middleware/      # Express middleware
│   ├── utils/           # Utility functions
│   ├── socket/          # Socket.io handlers
│   ├── jobs/            # Background jobs
│   ├── app.js           # Express app setup
│   └── server.js        # Server entry point
├── tests/               # Test files
├── .env.example         # Environment variables template
└── package.json
```

## API Endpoints

Base URL: `http://localhost:3000/api/v1`

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/verify-otp` - Verify OTP
- `GET /auth/me` - Get current user

### Rides
- `POST /rides/request` - Request a ride
- `GET /rides/estimate` - Get fare estimate
- `POST /rides/:id/accept` - Accept ride
- `POST /rides/:id/complete` - Complete ride

### Admin
- `GET /admin/users` - Get all users
- `GET /admin/drivers` - Get all drivers
- `GET /admin/rides` - Get all rides

See full API documentation in `BACKEND_PLAN.md`

## Development

### Running in Development Mode

```bash
npm run dev
```

### Running Tests

```bash
npm test
npm run test:watch
npm run test:coverage
```

## Environment Variables

See `.env.example` for all required environment variables.

## Deployment

The application is configured for deployment on Vercel and Railway. See deployment guides for details.

## License

ISC

## Author

Baneen Development Team

