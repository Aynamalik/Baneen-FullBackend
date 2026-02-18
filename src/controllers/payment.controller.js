import Payment from '../models/Payment.js';
import {
  processPayment,
  processRefund,
  getPaymentHistory,
  handlePaymentWebhook,
  verifyPaymentTransaction,
  getPaymentStatistics
} from '../services/payment.service.js';
import { USER_ROLES } from '../config/constants.js';
import logger from '../utils/logger.js';

export const processPaymentRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, method, rideId, orderId } = req.body;

    if (!amount || !method) {
      return res.status(400).json({
        success: false,
        message: 'Amount and payment method are required'
      });
    }

  
    if (!['easypaisa', 'jazzcash', 'card'].includes(method)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method'
      });
    }

    const result = await processPayment({
      rideId,
      amount,
      method,
      userId,
      orderId
    });

    res.json({
      success: true,
      data: result,
      message: 'Payment initiated successfully'
    });

  } catch (error) {
    logger.error('Payment processing error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { transactionId, gateway } = req.body;

    if (!transactionId || !gateway) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID and gateway are required'
      });
    }

    const result = await verifyPaymentTransaction(transactionId, gateway);

    res.json({
      success: true,
      data: result,
      message: 'Payment verification completed'
    });

  } catch (error) {
    logger.error('Payment verification error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getUserPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page, limit, type, status, startDate, endDate } = req.query;

    const filters = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      type,
      status,
      startDate,
      endDate
    };

    const result = await getPaymentHistory(userId, filters);

    res.json({
      success: true,
      data: result,
      message: 'Payment history retrieved successfully'
    });

  } catch (error) {
    logger.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const requestRefund = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { paymentId, amount, reason } = req.body;

    if (!paymentId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID and amount are required'
      });
    }

    const result = await processRefund({
      paymentId,
      userId,
      amount,
      reason
    });

    res.json({
      success: true,
      data: result,
      message: 'Refund request submitted successfully'
    });

  } catch (error) {
    logger.error('Refund request error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


export const handleEasypaisaWebhook = async (req, res) => {
  try {
    const webhookData = req.body;
    logger.info('Received EasyPaisa webhook:', webhookData);

    const result = await handlePaymentWebhook('easypaisa', webhookData);

    res.json({
      responseCode: result.success ? '00' : '01',
      responseDesc: result.message
    });

  } catch (error) {
    logger.error('EasyPaisa webhook error:', error);
    res.status(500).json({
      responseCode: '01',
      responseDesc: 'Internal server error'
    });
  }
};

export const handleJazzCashWebhook = async (req, res) => {
  try {
    const webhookData = req.body;
    logger.info('Received JazzCash webhook:', webhookData);

    const result = await handlePaymentWebhook('jazzcash', webhookData);

    // JazzCash expects specific response format
    res.json({
      pp_ResponseCode: result.success ? '000' : '001',
      pp_ResponseMessage: result.message
    });

  } catch (error) {
    logger.error('JazzCash webhook error:', error);
    res.status(500).json({
      pp_ResponseCode: '001',
      pp_ResponseMessage: 'Internal server error'
    });
  }
};

export const handleStripeWebhook = async (req, res) => {
  try {
    const webhookData = {
      body: req.body,
      headers: req.headers,
      rawBody: req.body // Stripe needs raw body for signature verification
    };

    logger.info('Received Stripe webhook:', { type: req.body.type, id: req.body.id });

    const result = await handlePaymentWebhook('stripe', webhookData);

    res.json({
      received: true,
      message: result.message
    });

  } catch (error) {
    logger.error('Stripe webhook error:', error);
    res.status(400).json({
      error: 'Webhook processing failed',
      message: error.message
    });
  }
};

export const getPaymentStats = async (req, res) => {
  try {
    const { startDate, endDate, gateway } = req.query;

    const stats = await getPaymentStatistics({ startDate, endDate, gateway });

    res.json({
      success: true,
      data: stats,
      message: 'Payment statistics retrieved successfully'
    });

  } catch (error) {
    logger.error('Get payment stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


export const processRefundAdmin = async (req, res) => {
  try {
    const { paymentId, amount, reason } = req.body;

    if (!paymentId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID and amount are required'
      });
    }

    const result = await processRefund({
      paymentId,
      amount,
      reason,
      adminInitiated: true
    });

    res.json({
      success: true,
      data: result,
      message: 'Refund processed successfully'
    });

  } catch (error) {
    logger.error('Admin refund error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getAllPayments = async (req, res) => {
  try {
    const { page, limit, userId, type, status, gateway, startDate, endDate } = req.query;

    let query = {};

    if (userId) query.userId = userId;
    if (type) query.type = type;
    if (status) query.status = status;
    if (gateway) query.gateway = gateway;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const payments = await Payment.find(query)
      .populate('userId', 'name email phone')
      .populate('rideId', 'pickup dropoff status')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) || 50)
      .skip(((parseInt(page) || 1) - 1) * (parseInt(limit) || 50));

    const total = await Payment.countDocuments(query);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 50,
          total,
          pages: Math.ceil(total / (parseInt(limit) || 50))
        }
      },
      message: 'Payments retrieved successfully'
    });

  } catch (error) {
    logger.error('Get all payments error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};