import {
  getActiveSubscriptionPlans,
  getSubscriptionPlanById,
  subscribeToPlan,
  getUserSubscriptionStatus,
  cancelUserSubscription,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  getSubscriptionAnalytics
} from '../services/subscription.service.js';
import { USER_ROLES } from '../config/constants.js';
import logger from '../utils/logger.js';

export const getSubscriptionPlans = async (req, res) => {
  try {
    const plans = await getActiveSubscriptionPlans();

    res.json({
      success: true,
      data: plans,
      message: 'Subscription plans retrieved successfully'
    });
  } catch (error) {
    logger.error('Get subscription plans error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


export const subscribe = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { planId, paymentMethod } = req.body;

    // Validate input
    if (!planId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID and payment method are required'
      });
    }

    if (!['easypaisa', 'jazzcash', 'card'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method'
      });
    }

    const result = await subscribeToPlan(userId, planId, paymentMethod);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Subscription created successfully'
    });
  } catch (error) {
    logger.error('Subscribe error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user.userId;

    const status = await getUserSubscriptionStatus(userId);

    res.json({
      success: true,
      data: status,
      message: 'Subscription status retrieved successfully'
    });
  } catch (error) {
    logger.error('Get subscription status error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await cancelUserSubscription(userId);

    res.json({
      success: true,
      data: result,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    logger.error('Cancel subscription error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


export const createPlan = async (req, res) => {
  try {
    const adminId = req.user.userId;
    const planData = req.body;

    const requiredFields = ['name', 'description', 'ridesIncluded', 'price', 'validityDays'];
    for (const field of requiredFields) {
      if (!planData[field]) {
        return res.status(400).json({
          success: false,
          message: `${field} is required`
        });
      }
    }

    const plan = await createSubscriptionPlan(adminId, planData);

    res.status(201).json({
      success: true,
      data: {
        id: plan._id,
        name: plan.name,
        description: plan.description,
        ridesIncluded: plan.ridesIncluded,
        price: plan.price,
        validityDays: plan.validityDays,
        features: plan.features,
        isActive: plan.isActive
      },
      message: 'Subscription plan created successfully'
    });
  } catch (error) {
    logger.error('Create subscription plan error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


export const updatePlan = async (req, res) => {
  try {
    const { id: planId } = req.params;
    const updateData = req.body;

    const plan = await updateSubscriptionPlan(planId, updateData);

    res.json({
      success: true,
      data: {
        id: plan._id,
        name: plan.name,
        description: plan.description,
        ridesIncluded: plan.ridesIncluded,
        price: plan.price,
        validityDays: plan.validityDays,
        features: plan.features,
        isActive: plan.isActive
      },
      message: 'Subscription plan updated successfully'
    });
  } catch (error) {
    logger.error('Update subscription plan error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const deletePlan = async (req, res) => {
  try {
    const { id: planId } = req.params;

    const result = await deleteSubscriptionPlan(planId);

    res.json({
      success: true,
      data: result,
      message: 'Subscription plan deleted successfully'
    });
  } catch (error) {
    logger.error('Delete subscription plan error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getAllPlansAdmin = async (req, res) => {
  try {
    
    const plans = await getActiveSubscriptionPlans();

    res.json({
      success: true,
      data: plans,
      message: 'Subscription plans retrieved successfully'
    });
  } catch (error) {
    logger.error('Get all plans admin error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getAnalytics = async (req, res) => {
  try {
    const analytics = await getSubscriptionAnalytics();

    res.json({
      success: true,
      data: analytics,
      message: 'Subscription analytics retrieved successfully'
    });
  } catch (error) {
    logger.error('Get subscription analytics error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};