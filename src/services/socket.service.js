import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import Ride from '../models/Ride.js';
import User from '../models/User.js';
import { USER_ROLES } from '../config/constants.js';

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId
    this.activeRides = new Map(); // rideId -> { passengerSocket, driverSocket }
  }

  initialize(server) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.io.use(this.authenticateSocket);
    this.setupEventHandlers();

    logger.info('Socket.io initialized successfully');
  }

  // Middleware to authenticate socket connections
  authenticateSocket = async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication token missing'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;

      // Store user connection
      this.connectedUsers.set(decoded.userId, socket.id);

      next();
    } catch (error) {
      logger.error('Socket authentication failed:', error.message);
      next(new Error('Authentication failed'));
    }
  };

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const userId = socket.userId;
      const userRole = socket.userRole;

      logger.info(`User ${userId} (${userRole}) connected with socket ${socket.id}`);

      // Join user-specific room
      socket.join(`user_${userId}`);

      // Handle ride-related events
      this.setupRideEvents(socket);

      // Handle disconnect
      socket.on('disconnect', () => {
        logger.info(`User ${userId} disconnected`);
        this.connectedUsers.delete(userId);

        // Clean up active ride connections
        this.cleanupUserConnections(userId);
      });

      // Handle connection errors
      socket.on('error', (error) => {
        logger.error(`Socket error for user ${userId}:`, error);
      });
    });
  }

  setupRideEvents(socket) {
    const userId = socket.userId;
    const userRole = socket.userRole;

    // Request ride (Passenger) - Alternative socket-based ride request
    socket.on('ride:request', async (data) => {
      try {
        logger.info(`Ride request via socket from passenger ${userId}`);

        // This is an alternative way to request rides via socket
        // The primary method is through the REST API
        // This handler is for socket-based ride requests if needed

        socket.emit('ride:request_received', {
          message: 'Ride request received via socket. Please use REST API for ride requests.',
          data: data
        });

      } catch (error) {
        logger.error('Ride request socket error:', error);
        socket.emit('ride:error', {
          type: 'request_failed',
          message: error.message || 'Failed to process ride request'
        });
      }
    });

    // Accept ride (Driver) - Socket handler
    socket.on('ride:accept', async (data) => {
      try {
        const { rideId } = data;
        const driverId = socket.userId;

        // Import and call the service method
        const { acceptRideService } = await import('./ride.service.js');
        const result = await acceptRideService(driverId, rideId);

        // Confirm to driver via socket
        socket.emit('ride:accept_confirmed', {
          rideId: result.rideId,
          status: result.status,
          driver: result.driver,
          message: result.message
        });

        logger.info(`Ride ${rideId} accepted via socket by driver ${driverId}`);

      } catch (error) {
        logger.error('Ride accept socket error:', error);
        socket.emit('ride:error', {
          type: 'accept_failed',
          message: error.message || 'Failed to accept ride'
        });
      }
    });

    // Start ride (Driver)
    socket.on('ride:start', async (data) => {
      try {
        const { rideId } = data;

        // Update active ride tracking
        const activeRide = this.activeRides.get(rideId);
        if (activeRide) {
          activeRide.status = 'in-progress';

          // Notify passenger
          if (activeRide.passengerSocket) {
            this.io.to(activeRide.passengerSocket).emit('ride:started', {
              rideId,
              message: 'Your ride has started!'
            });
          }
        }

      } catch (error) {
        logger.error('Ride start socket error:', error);
      }
    });

    // Update location (Driver - Real-time tracking)
    socket.on('ride:location_update', async (data) => {
      try {
        const { rideId, latitude, longitude, speed, heading } = data;

        const activeRide = this.activeRides.get(rideId);
        if (activeRide && activeRide.passengerSocket) {
          // Send location update to passenger
          this.io.to(activeRide.passengerSocket).emit('ride:driver_location', {
            rideId,
            location: { latitude, longitude },
            speed,
            heading,
            timestamp: new Date()
          });
        }

      } catch (error) {
        logger.error('Location update socket error:', error);
      }
    });

    // Complete ride (Driver)
    socket.on('ride:complete', async (data) => {
      try {
        const { rideId, finalFare, paymentStatus } = data;

        const activeRide = this.activeRides.get(rideId);
        if (activeRide) {
          // Notify passenger
          if (activeRide.passengerSocket) {
            this.io.to(activeRide.passengerSocket).emit('ride:completed', {
              rideId,
              finalFare,
              paymentStatus,
              message: 'Ride completed successfully!'
            });
          }

          // Clean up
          this.activeRides.delete(rideId);
        }

      } catch (error) {
        logger.error('Ride complete socket error:', error);
      }
    });

    // Cancel ride
    socket.on('ride:cancel', async (data) => {
      try {
        const { rideId, cancelledBy, reason } = data;

        const activeRide = this.activeRides.get(rideId);
        if (activeRide) {
          // Notify the other party
          const notifySocket = cancelledBy === 'passenger'
            ? activeRide.driverSocket
            : activeRide.passengerSocket;

          if (notifySocket) {
            this.io.to(notifySocket).emit('ride:cancelled', {
              rideId,
              cancelledBy,
              reason,
              message: `Ride cancelled by ${cancelledBy}`
            });
          }

          // Clean up
          this.activeRides.delete(rideId);
        }

      } catch (error) {
        logger.error('Ride cancel socket error:', error);
      }
    });

    // Rate ride
    socket.on('ride:rate', async (data) => {
      try {
        const { rideId, rating, review, ratedBy } = data;

        // Notify the other party about the rating
        const activeRide = this.activeRides.get(rideId);
        if (activeRide) {
          const notifySocket = ratedBy === USER_ROLES.PASSENGER
            ? activeRide.driverSocket
            : activeRide.passengerSocket;

          if (notifySocket) {
            this.io.to(notifySocket).emit('ride:rated', {
              rideId,
              rating,
              review,
              ratedBy,
              message: `You received a ${rating}-star rating`
            });
          }
        }

      } catch (error) {
        logger.error('Ride rating socket error:', error);
      }
    });

    // Chat messages
    socket.on('chat:send', async (data) => {
      try {
        const { rideId, message, messageType = 'text' } = data;

        const activeRide = this.activeRides.get(rideId);
        if (activeRide) {
          const targetSocket = userRole === USER_ROLES.PASSENGER
            ? activeRide.driverSocket
            : activeRide.passengerSocket;

          if (targetSocket) {
            this.io.to(targetSocket).emit('chat:receive', {
              rideId,
              message,
              messageType,
              senderId: userId,
              senderRole: userRole,
              timestamp: new Date()
            });
          }
        }

      } catch (error) {
        logger.error('Chat send socket error:', error);
      }
    });

    // Typing indicators
    socket.on('chat:typing', (data) => {
      const { rideId, isTyping } = data;

      const activeRide = this.activeRides.get(rideId);
      if (activeRide) {
        const targetSocket = userRole === USER_ROLES.PASSENGER
          ? activeRide.driverSocket
          : activeRide.passengerSocket;

        if (targetSocket) {
          this.io.to(targetSocket).emit('chat:typing', {
            rideId,
            senderId: userId,
            isTyping
          });
        }
      }
    });
  }

  // Find nearby available drivers
  async findNearbyDrivers(pickupCoords, radiusKm = 5) {
    try {
      // Import Driver model
      const Driver = (await import('../models/Driver.js')).default;

      // Find drivers within radius (simplified - in production use geospatial queries)
      const drivers = await Driver.find({
        'availability.status': 'available',
        isApproved: true,
        isActive: true,
        isBlocked: false
      })
      .populate('userId', 'name phone')
      .limit(10); // Limit to prevent spam

      return drivers;
    } catch (error) {
      logger.error('Find nearby drivers error:', error);
      return [];
    }
  }

  // Clean up user connections when they disconnect
  cleanupUserConnections(userId) {
    // Remove from active rides
    for (const [rideId, rideData] of this.activeRides.entries()) {
      if (rideData.passengerSocket === this.connectedUsers.get(userId) ||
          rideData.driverSocket === this.connectedUsers.get(userId)) {
        // Notify the other party
        const otherSocket = rideData.passengerSocket === this.connectedUsers.get(userId)
          ? rideData.driverSocket
          : rideData.passengerSocket;

        if (otherSocket) {
          this.io.to(otherSocket).emit('ride:disconnected', {
            rideId,
            message: 'Connection lost. Please check your internet connection.'
          });
        }

        this.activeRides.delete(rideId);
      }
    }
  }

  // Add active ride tracking
  addActiveRide(rideId, passengerUserId, driverUserId) {
    const passengerSocket = this.connectedUsers.get(passengerUserId);
    const driverSocket = this.connectedUsers.get(driverUserId);

    this.activeRides.set(rideId, {
      passengerSocket,
      driverSocket,
      passengerUserId,
      driverUserId
    });

    logger.info(`Active ride tracking added: ${rideId}`);
  }

  // Send notification to specific user
  notifyUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  // Broadcast to all connected users
  broadcast(event, data) {
    this.io.emit(event, data);
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // Get active rides count
  getActiveRidesCount() {
    return this.activeRides.size;
  }
}

export default new SocketService();