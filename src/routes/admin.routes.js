import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { USER_ROLES } from '../config/constants.js';
import {
  getDashboardStats,
  getAllUsers,
  getUserDetails,
  createUser,
  verifyUser,
  blockUser,
  unblockUser,
  deleteUser,
  getAllDrivers,
  getDriverDetails,
  getPendingDrivers,
  approveDriver,
  rejectDriver,
  getAllRides,
  getActiveRidesAdmin,
  getRideDetailsAdmin,
  cancelRideAdmin,
  getRideReports,
  getEarningsReports,
  getUserReports,
  getDriverReports,
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  getSystemStats,
  getAllComplaints,
  getComplaintDetails,
  resolveComplaint,
  getAllSOSAlerts,
  getActiveSOSAlerts,
  getSOSAlertDetails,
  resolveSOSAlert,
  getSystemSettings,
  updateSystemSettings,
  getChatbotConversations,
  getChatbotAnalytics,
} from '../controllers/admin.controller.js';

const router = express.Router();

router.use(authenticate);
router.use(requireRole([USER_ROLES.ADMIN]));

router.get('/dashboard', getDashboardStats);

router.get('/users', getAllUsers);
router.post('/users', createUser);
router.get('/users/:id', getUserDetails);
router.put('/users/:id/verify', verifyUser);
router.put('/users/:id/block', blockUser);
router.put('/users/:id/unblock', unblockUser);
router.delete('/users/:id', deleteUser);

router.get('/drivers', getAllDrivers);
router.get('/drivers/pending', getPendingDrivers);
router.get('/drivers/:id', getDriverDetails);
router.put('/drivers/:id/approve', approveDriver);
router.put('/drivers/:id/reject', rejectDriver);

router.get('/rides', getAllRides);
router.get('/rides/active', getActiveRidesAdmin);
router.get('/rides/:id', getRideDetailsAdmin);
router.put('/rides/:id/cancel', cancelRideAdmin);

router.get('/reports/rides', getRideReports);
router.get('/reports/earnings', getEarningsReports);
router.get('/reports/users', getUserReports);
router.get('/reports/drivers', getDriverReports);

router.get('/subscriptions/plans', getSubscriptionPlans);
router.post('/subscriptions/plans', createSubscriptionPlan);
router.put('/subscriptions/plans/:id', updateSubscriptionPlan);
router.delete('/subscriptions/plans/:id', deleteSubscriptionPlan);

router.get('/complaints', getAllComplaints);
router.get('/complaints/:id', getComplaintDetails);
router.put('/complaints/:id/resolve', resolveComplaint);

router.get('/sos/alerts', getAllSOSAlerts);
router.get('/sos/alerts/active', getActiveSOSAlerts);
router.get('/sos/alerts/:id', getSOSAlertDetails);
router.put('/sos/alerts/:id/resolve', resolveSOSAlert);

router.get('/chatbot/conversations', getChatbotConversations);
router.get('/chatbot/analytics', getChatbotAnalytics);

router.get('/system/stats', getSystemStats);
router.get('/system/settings', getSystemSettings);
router.put('/system/settings', updateSystemSettings);

export default router;