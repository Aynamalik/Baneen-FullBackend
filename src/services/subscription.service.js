import Subscription from '../models/Subscription.js';
import Passenger from '../models/Passenger.js';
import Payment from '../models/Payment.js';
import { processPayment } from './payment.service.js';
import logger from '../utils/logger.js';

/**
 * Get all active subscription plans
 */
export const getActiveSubscriptionPlans = async () => {
  try {
    const plans = await Subscription.find({ isActive: true })
      .sort({ sortOrder: 1 })
      .populate('createdBy', 'name');

    return plans.map(plan => ({
      id: plan._id,
      name: plan.name,
      description: plan.description,
      ridesIncluded: plan.ridesIncluded,
      price: plan.price,
      currency: plan.currency,
      validityDays: plan.validityDays,
      validityMonths: plan.validityMonths,
      pricePerRide: plan.pricePerRide,
      features: plan.features,
      isPopular: plan.isPopular,
      badge: plan.badge,
      savings: plan.calculateSavings()
    }));
  } catch (error) {
    logger.error('Error getting subscription plans:', error);
    throw new Error('Failed to fetch subscription plans');
  }
};

/**
 * Get subscription plan by ID
 */
export const getSubscriptionPlanById = async (planId) => {
  try {
    const plan = await Subscription.findById(planId);
    if (!plan || !plan.isActive) {
      throw new Error('Subscription plan not found');
    }
    return plan;
  } catch (error) {
    logger.error('Error getting subscription plan:', error);
    throw new Error('Failed to fetch subscription plan');
  }
};

/**
 * Subscribe user to a plan
 */
export const subscribeToPlan = async (userId, planId, paymentMethod) => {
  try {
    // Get plan details
    const plan = await getSubscriptionPlanById(planId);

    // Get passenger
    const passenger = await Passenger.findOne({ userId });
    if (!passenger) {
      throw new Error('Passenger profile not found');
    }

    // Check if user already has an active subscription
    if (passenger.hasActiveSubscription()) {
      throw new Error('User already has an active subscription');
    }

    // Process payment
    const paymentResult = await processPayment({
      amount: plan.price,
      method: paymentMethod,
      userId,
      type: 'subscription',
      metadata: {
        planId: plan._id,
        planName: plan.name,
        ridesIncluded: plan.ridesIncluded
      }
    });

    if (paymentResult.status !== 'completed') {
      throw new Error('Payment failed');
    }

    // Update passenger subscription
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + plan.validityDays);

    passenger.subscription = {
      isActive: true,
      planId: plan._id,
      ridesRemaining: plan.ridesIncluded,
      expiryDate: expiryDate
    };

    await passenger.save();

    // Update plan statistics
    plan.totalSubscriptions += 1;
    plan.activeSubscriptions += 1;
    await plan.save();

    logger.info(`User ${userId} subscribed to plan ${plan.name}`);

    return {
      subscription: {
        planId: plan._id,
        planName: plan.name,
        ridesRemaining: plan.ridesIncluded,
        expiryDate: expiryDate,
        features: plan.features
      },
      payment: {
        id: paymentResult.paymentId,
        amount: paymentResult.amount,
        status: paymentResult.status
      }
    };
  } catch (error) {
    logger.error('Error subscribing to plan:', error);
    throw error;
  }
};

/**
 * Get user's current subscription status
 */
export const getUserSubscriptionStatus = async (userId) => {
  try {
    const passenger = await Passenger.findOne({ userId })
      .populate('subscription.planId');

    if (!passenger) {
      throw new Error('Passenger profile not found');
    }

    const subscription = passenger.subscription;

    if (!subscription || !subscription.isActive) {
      return {
        hasActiveSubscription: false,
        message: 'No active subscription'
      };
    }

    // Check if subscription has expired
    const now = new Date();
    const isExpired = subscription.expiryDate && subscription.expiryDate < now;

    if (isExpired) {
      // Auto-deactivate expired subscription
      subscription.isActive = false;
      await passenger.save();

      return {
        hasActiveSubscription: false,
        message: 'Subscription expired',
        expiryDate: subscription.expiryDate
      };
    }

    const plan = subscription.planId;
    return {
      hasActiveSubscription: true,
      plan: plan ? {
        id: plan._id,
        name: plan.name,
        ridesIncluded: plan.ridesIncluded,
        features: plan.features
      } : null,
      ridesRemaining: subscription.ridesRemaining,
      expiryDate: subscription.expiryDate,
      daysRemaining: Math.ceil((subscription.expiryDate - now) / (1000 * 60 * 60 * 24))
    };
  } catch (error) {
    logger.error('Error getting subscription status:', error);
    throw new Error('Failed to fetch subscription status');
  }
};

/**
 * Cancel user subscription
 */
export const cancelUserSubscription = async (userId) => {
  try {
    const passenger = await Passenger.findOne({ userId });
    if (!passenger) {
      throw new Error('Passenger profile not found');
    }

    if (!passenger.hasActiveSubscription()) {
      throw new Error('No active subscription to cancel');
    }

    // Deactivate subscription
    passenger.subscription.isActive = false;
    await passenger.save();

    // Update plan statistics
    if (passenger.subscription.planId) {
      const plan = await Subscription.findById(passenger.subscription.planId);
      if (plan && plan.activeSubscriptions > 0) {
        plan.activeSubscriptions -= 1;
        await plan.save();
      }
    }

    logger.info(`User ${userId} cancelled subscription`);

    return {
      message: 'Subscription cancelled successfully',
      refundEligible: false // For now, no refunds on cancellation
    };
  } catch (error) {
    logger.error('Error cancelling subscription:', error);
    throw error;
  }
};

/**
 * Use subscription credit for a ride
 */
export const useSubscriptionCredit = async (userId) => {
  try {
    const passenger = await Passenger.findOne({ userId });
    if (!passenger) {
      throw new Error('Passenger profile not found');
    }

    if (!passenger.hasActiveSubscription()) {
      return { usedCredit: false, reason: 'No active subscription' };
    }

    if (passenger.subscription.ridesRemaining <= 0) {
      return { usedCredit: false, reason: 'No rides remaining' };
    }

    // Deduct one ride
    passenger.subscription.ridesRemaining -= 1;
    await passenger.save();

    logger.info(`User ${userId} used subscription credit. Remaining: ${passenger.subscription.ridesRemaining}`);

    return {
      usedCredit: true,
      ridesRemaining: passenger.subscription.ridesRemaining
    };
  } catch (error) {
    logger.error('Error using subscription credit:', error);
    throw new Error('Failed to use subscription credit');
  }
};

/**
 * Admin: Create subscription plan
 */
export const createSubscriptionPlan = async (adminId, planData) => {
  try {
    const plan = new Subscription({
      ...planData,
      createdBy: adminId
    });

    await plan.save();

    logger.info(`Admin ${adminId} created subscription plan: ${plan.name}`);

    return plan;
  } catch (error) {
    logger.error('Error creating subscription plan:', error);
    if (error.code === 11000) {
      throw new Error('Plan name already exists');
    }
    throw new Error('Failed to create subscription plan');
  }
};

/**
 * Admin: Update subscription plan
 */
export const updateSubscriptionPlan = async (planId, updateData) => {
  try {
    const plan = await Subscription.findByIdAndUpdate(
      planId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!plan) {
      throw new Error('Subscription plan not found');
    }

    logger.info(`Subscription plan updated: ${plan.name}`);

    return plan;
  } catch (error) {
    logger.error('Error updating subscription plan:', error);
    throw new Error('Failed to update subscription plan');
  }
};

/**
 * Admin: Delete subscription plan
 */
export const deleteSubscriptionPlan = async (planId) => {
  try {
    const plan = await Subscription.findById(planId);
    if (!plan) {
      throw new Error('Subscription plan not found');
    }

    // Check if plan has active subscriptions
    if (plan.activeSubscriptions > 0) {
      throw new Error('Cannot delete plan with active subscriptions');
    }

    await Subscription.findByIdAndDelete(planId);

    logger.info(`Subscription plan deleted: ${plan.name}`);

    return { message: 'Subscription plan deleted successfully' };
  } catch (error) {
    logger.error('Error deleting subscription plan:', error);
    throw error;
  }
};

/**
 * Admin: Get subscription analytics
 */
export const getSubscriptionAnalytics = async () => {
  try {
    const plans = await Subscription.find({ isActive: true });

    const totalPlans = plans.length;
    const totalSubscriptions = plans.reduce((sum, plan) => sum + plan.totalSubscriptions, 0);
    const activeSubscriptions = plans.reduce((sum, plan) => sum + plan.activeSubscriptions, 0);

    // Get recent subscriptions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSubscriptions = await Payment.countDocuments({
      type: 'subscription',
      status: 'completed',
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get expiring subscriptions (next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const expiringSubscriptions = await Passenger.countDocuments({
      'subscription.isActive': true,
      'subscription.expiryDate': {
        $gte: new Date(),
        $lte: sevenDaysFromNow
      }
    });

    return {
      totalPlans,
      totalSubscriptions,
      activeSubscriptions,
      recentSubscriptions,
      expiringSubscriptions,
      plans: plans.map(plan => ({
        id: plan._id,
        name: plan.name,
        totalSubscriptions: plan.totalSubscriptions,
        activeSubscriptions: plan.activeSubscriptions,
        price: plan.price,
        ridesIncluded: plan.ridesIncluded
      }))
    };
  } catch (error) {
    logger.error('Error getting subscription analytics:', error);
    throw new Error('Failed to fetch subscription analytics');
  }
};