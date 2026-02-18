import axios from 'axios';
import Payment from '../models/Payment.js';
import logger from '../utils/logger.js';

// Payment gateway configurations
const PAYMENT_CONFIG = {
  EASYPAISA: {
    baseUrl: process.env.EASYPAISA_BASE_URL || 'https://api.easypaisa.com.pk',
    merchantId: process.env.EASYPAISA_MERCHANT_ID,
    password: process.env.EASYPAISA_PASSWORD,
    hashKey: process.env.EASYPAISA_HASH_KEY
  },
  JAZZCASH: {
    baseUrl: process.env.JAZZCASH_BASE_URL || 'https://sandbox.jazzcash.com.pk',
    merchantId: process.env.JAZZCASH_MERCHANT_ID,
    password: process.env.JAZZCASH_PASSWORD,
    integritySalt: process.env.JAZZCASH_INTEGRITY_SALT
  },
  STRIPE: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
  }
};

/**
 * Process payment through appropriate gateway
 */
export const processPayment = async (paymentData) => {
  const { rideId, amount, method, userId, orderId } = paymentData;

  // Validate payment method
  if (!['easypaisa', 'jazzcash', 'card'].includes(method)) {
    throw new Error('Invalid payment method');
  }

  // Create payment record
  const payment = await Payment.create({
    rideId,
    userId,
    type: 'ride',
    amount,
    currency: 'PKR',
    method,
    status: 'pending',
    gateway: method
  });

  try {
    let paymentResult;

    switch (method) {
      case 'easypaisa':
        paymentResult = await processEasypaisaPayment(payment, orderId);
        break;
      case 'jazzcash':
        paymentResult = await processJazzCashPayment(payment, orderId);
        break;
      case 'card':
        paymentResult = await processCardPayment(payment, orderId);
        break;
      default:
        throw new Error('Unsupported payment method');
    }

    // Update payment record with result
    payment.status = paymentResult.success ? 'completed' : 'failed';
    payment.transactionId = paymentResult.transactionId;
    payment.gatewayResponse = paymentResult.response;
    payment.processedAt = new Date();

    await payment.save();

    logger.info(`Payment processed: ${payment._id} - ${payment.status}`);

    return {
      success: paymentResult.success,
      transactionId: paymentResult.transactionId,
      paymentId: payment._id,
      status: payment.status,
      message: paymentResult.message
    };

  } catch (error) {
    // Update payment record with failure
    payment.status = 'failed';
    payment.gatewayResponse = { error: error.message };
    await payment.save();

    logger.error('Payment processing failed:', error);
    throw new Error(`Payment failed: ${error.message}`);
  }
};

/**
 * Process EasyPaisa payment
 */
const processEasypaisaPayment = async (payment, orderId) => {
  const config = PAYMENT_CONFIG.EASYPAISA;

  if (!config.merchantId || !config.password || !config.hashKey) {
    throw new Error('EasyPaisa configuration incomplete');
  }

  // Generate unique order reference
  const orderRef = orderId || `EP-${Date.now()}-${payment._id.toString().slice(-6)}`;

  // Create payment request payload based on EasyPaisa Merchant API
  const payload = {
    storeId: config.merchantId,
    orderRefNumber: orderRef,
    transactionAmount: payment.amount.toString(),
    transactionType: 'MA', // Mobile Account transaction
    msisdn: '', // Will be filled by user on EasyPaisa page
    emailAddress: '',
    transactionDateTime: new Date().toISOString().replace(/[:-]/g, '').split('.')[0] + '000000',
    tokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace(/[:-]/g, '').split('.')[0] + '000000'
  };

  // Generate secure hash for EasyPaisa
  const hashString = `${config.hashKey}${payload.storeId}${payload.orderRefNumber}${payload.transactionAmount}${payload.transactionType}`;
  payload.secureHash = require('crypto').createHash('sha256').update(hashString).digest('hex');

  try {
    // For EasyPaisa, we typically redirect to their payment page
    // The actual API call depends on the integration method (Payrails, direct, etc.)
    // For now, we'll simulate the payment initiation

    const paymentUrl = `${config.baseUrl}/easypay-portal?storeId=${payload.storeId}&orderRef=${payload.orderRefNumber}&amount=${payload.transactionAmount}&hash=${payload.secureHash}`;

    // Store payment details for webhook verification
    payment.transactionId = orderRef;
    payment.gatewayResponse = {
      ...payment.gatewayResponse,
      paymentUrl,
      orderRef: payload.orderRefNumber,
      initiatedAt: new Date()
    };

    return {
      success: true,
      transactionId: orderRef,
      paymentUrl: paymentUrl,
      response: {
        orderRef: payload.orderRefNumber,
        paymentUrl: paymentUrl,
        status: 'initiated'
      },
      message: 'EasyPaisa payment initiated. Redirect user to payment URL.'
    };

  } catch (error) {
    logger.error('EasyPaisa API Error:', error.response?.data || error.message);
    throw new Error('EasyPaisa payment processing failed');
  }
};

/**
 * Process JazzCash payment
 */
const processJazzCashPayment = async (payment, orderId) => {
  const config = PAYMENT_CONFIG.JAZZCASH;

  if (!config.merchantId || !config.password || !config.integritySalt) {
    throw new Error('JazzCash configuration incomplete');
  }

  // Generate unique transaction reference
  const txnRefNo = orderId || `JC-${Date.now()}-${payment._id.toString().slice(-6)}`;

  // Create payment request payload based on JazzCash API v4.2
  const payload = {
    pp_MerchantID: config.merchantId,
    pp_Password: config.password,
    pp_OrderRef: txnRefNo,
    pp_Amount: payment.amount.toString(), // Amount in rupees (not paisas for this API)
    pp_Description: `Ride payment - ${payment.rideId}`,
    pp_SuccessURL: `${process.env.BASE_URL}/api/v1/payments/jazzcash/success`,
    pp_FailureURL: `${process.env.BASE_URL}/api/v1/payments/jazzcash/failure`,
    pp_TxnCurrency: 'PKR',
    pp_TxnDateTime: new Date().toISOString().replace(/[:-]/g, '').split('.')[0] + '000000',
    pp_TxnExpiryDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace(/[:-]/g, '').split('.')[0] + '000000',
    ppmpf_1: '1', // Mobile payment flag
    ppmpf_2: '', // Mobile number (to be filled by user)
    ppmpf_3: '', // Reserved
    ppmpf_4: '', // Reserved
    ppmpf_5: ''  // Reserved
  };

  // Generate integrity hash as per JazzCash documentation
  const hashString = `${config.integritySalt}&${payload.pp_Amount}&${payload.pp_OrderRef}&${payload.pp_TxnCurrency}&${payload.pp_TxnDateTime}`;
  payload.pp_SecureHash = require('crypto').createHash('sha256').update(hashString).digest('hex');

  try {
    // For JazzCash, redirect to their hosted payment page
    const paymentUrl = `${config.baseUrl}/CustomerPortal/transactionmanagement/merchantform`;

    // Store payment details for webhook verification
    payment.transactionId = txnRefNo;
    payment.gatewayResponse = {
      ...payment.gatewayResponse,
      paymentUrl,
      orderRef: payload.pp_OrderRef,
      initiatedAt: new Date()
    };

    return {
      success: true,
      transactionId: txnRefNo,
      paymentUrl: paymentUrl,
      response: {
        orderRef: payload.pp_OrderRef,
        paymentUrl: paymentUrl,
        status: 'initiated'
      },
      message: 'JazzCash payment initiated. Redirect user to payment URL.'
    };

  } catch (error) {
    logger.error('JazzCash API Error:', error.response?.data || error.message);
    throw new Error('JazzCash payment processing failed');
  }
};

/**
 * Process card payment using Stripe
 */
const processCardPayment = async (payment, orderId) => {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PUBLISHABLE_KEY) {
    throw new Error('Stripe configuration incomplete');
  }

  try {
    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(payment.amount * 100), // Stripe expects amount in cents
      currency: payment.currency.toLowerCase(),
      metadata: {
        orderId: orderId || `CARD-${payment._id}`,
        rideId: payment.rideId,
        userId: payment.userId
      },
      description: `Ride payment - ${payment.rideId}`,
      receipt_email: payment.userEmail || undefined,
      // Enable automatic payment methods for the checkout
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      success: true,
      transactionId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      response: {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status
      },
      message: 'Card payment initiated successfully'
    };

  } catch (error) {
    logger.error('Stripe API Error:', error.message);
    throw new Error('Card payment processing failed');
  }
};

/**
 * Verify payment status
 */
export const verifyPayment = async (paymentId, gatewayResponse) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new Error('Payment not found');
  }

  try {
    let verificationResult;

    switch (payment.gateway) {
      case 'easypaisa':
        verificationResult = await verifyEasypaisaPayment(payment, gatewayResponse);
        break;
      case 'jazzcash':
        verificationResult = await verifyJazzCashPayment(payment, gatewayResponse);
        break;
      default:
        throw new Error('Unsupported payment gateway');
    }

    // Update payment status
    payment.status = verificationResult.success ? 'completed' : 'failed';
    payment.verifiedAt = new Date();
    payment.gatewayResponse = { ...payment.gatewayResponse, verification: gatewayResponse };

    await payment.save();

    logger.info(`Payment verified: ${paymentId} - ${payment.status}`);

    return {
      success: verificationResult.success,
      status: payment.status,
      amount: payment.amount,
      message: verificationResult.message
    };

  } catch (error) {
    logger.error('Payment verification failed:', error);
    throw new Error(`Payment verification failed: ${error.message}`);
  }
};

/**
 * Verify EasyPaisa payment
 */
const verifyEasypaisaPayment = async (payment, response) => {
  // Verify payment with EasyPaisa API
  const config = PAYMENT_CONFIG.EASYPAISA;

  try {
    const verificationResponse = await axios.post(`${config.baseUrl}/payments/verify`, {
      merchantId: config.merchantId,
      transactionId: response.transactionId
    }, {
      headers: {
        'Authorization': `Bearer ${config.password}`
      }
    });

    return {
      success: verificationResponse.data.success,
      message: verificationResponse.data.message
    };

  } catch (error) {
    logger.error('EasyPaisa verification error:', error);
    return {
      success: false,
      message: 'Payment verification failed'
    };
  }
};

/**
 * Verify JazzCash payment
 */
const verifyJazzCashPayment = async (payment, response) => {
  // Verify payment with JazzCash API
  const config = PAYMENT_CONFIG.JAZZCASH;

  try {
    const verificationResponse = await axios.post(`${config.baseUrl}/ApplicationAPI/API/2.0/Purchase/VerifyTransaction`, {
      pp_MerchantID: config.merchantId,
      pp_OrderRef: payment.transactionId
    });

    return {
      success: verificationResponse.data.pp_ResponseCode === '000',
      message: verificationResponse.data.pp_ResponseMessage
    };

  } catch (error) {
    logger.error('JazzCash verification error:', error);
    return {
      success: false,
      message: 'Payment verification failed'
    };
  }
};

/**
 * Process refund
 */
export const processRefund = async (paymentId, refundAmount, reason) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new Error('Payment not found');
  }

  if (payment.status !== 'completed') {
    throw new Error('Can only refund completed payments');
  }

  if (refundAmount > payment.amount) {
    throw new Error('Refund amount cannot exceed payment amount');
  }

  // Create refund payment record
  const refundPayment = await Payment.create({
    rideId: payment.rideId,
    userId: payment.userId,
    type: 'refund',
    amount: refundAmount,
    currency: payment.currency,
    method: payment.method,
    status: 'pending',
    gateway: payment.gateway,
    gatewayResponse: { originalPaymentId: paymentId, reason }
  });

  try {
    let refundResult;

    switch (payment.gateway) {
      case 'easypaisa':
        refundResult = await processEasypaisaRefund(refundPayment);
        break;
      case 'jazzcash':
        refundResult = await processJazzCashRefund(refundPayment);
        break;
      default:
        throw new Error('Refund not supported for this gateway');
    }

    refundPayment.status = refundResult.success ? 'completed' : 'failed';
    refundPayment.transactionId = refundResult.transactionId;
    refundPayment.gatewayResponse = { ...refundPayment.gatewayResponse, result: refundResult.response };
    refundPayment.processedAt = new Date();

    await refundPayment.save();

    logger.info(`Refund processed: ${refundPayment._id} - ${refundPayment.status}`);

    return {
      success: refundResult.success,
      refundId: refundPayment._id,
      amount: refundAmount,
      message: refundResult.message
    };

  } catch (error) {
    refundPayment.status = 'failed';
    await refundPayment.save();

    logger.error('Refund processing failed:', error);
    throw new Error(`Refund failed: ${error.message}`);
  }
};

/**
 * Handle webhook from payment gateway
 */
export const handlePaymentWebhook = async (gateway, webhookData) => {
  try {
    logger.info(`Processing ${gateway} webhook:`, webhookData);

    let paymentUpdate = {};
    let transactionId = null;
    let status = 'unknown';

    switch (gateway.toLowerCase()) {
      case 'easypaisa':
        ({ paymentUpdate, transactionId, status } = processEasypaisaWebhook(webhookData));
        break;
      case 'jazzcash':
        ({ paymentUpdate, transactionId, status } = processJazzCashWebhook(webhookData));
        break;
      case 'stripe':
        ({ paymentUpdate, transactionId, status } = await processStripeWebhook(webhookData));
        break;
      default:
        throw new Error(`Unsupported gateway: ${gateway}`);
    }

    // Find and update payment record
    const payment = await Payment.findOneAndUpdate(
      { transactionId: transactionId || webhookData.transactionId },
      {
        ...paymentUpdate,
        status: status,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!payment) {
      logger.warn(`Payment not found for webhook transaction: ${transactionId || webhookData.transactionId}`);
      return { success: false, message: 'Payment not found' };
    }

    // If payment was for a ride, update ride status
    if (payment.rideId && status === 'completed') {
      const Ride = (await import('../models/Ride.js')).default;
      await Ride.findByIdAndUpdate(payment.rideId, {
        'payment.status': 'completed',
        'payment.paidAt': new Date(),
        'payment.transactionId': transactionId
      });
    }

    // If payment was for subscription, mark as completed
    if (payment.type === 'subscription' && status === 'completed') {
      // Additional subscription processing can be added here
      logger.info(`Subscription payment completed: ${payment._id}`);
    }

    logger.info(`Webhook processed successfully for payment: ${payment._id}`);

    return {
      success: true,
      paymentId: payment._id,
      status: status,
      message: 'Webhook processed successfully'
    };

  } catch (error) {
    logger.error('Webhook processing failed:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Process EasyPaisa webhook data
 */
const processEasypaisaWebhook = (webhookData) => {
  // EasyPaisa webhook structure based on their API documentation
  const { orderRefNumber, transactionStatus, transactionAmount, storeId } = webhookData;

  const paymentUpdate = {
    gatewayResponse: webhookData,
    processedAt: new Date(),
    verifiedAt: new Date()
  };

  return {
    paymentUpdate,
    transactionId: orderRefNumber,
    status: transactionStatus === 'success' || transactionStatus === 'completed' ? 'completed' : 'failed'
  };
};

/**
 * Process JazzCash webhook data
 */
const processJazzCashWebhook = (webhookData) => {
  // JazzCash webhook structure based on their API v4.2 documentation
  const { pp_OrderRef, pp_ResponseCode, pp_ResponseMessage, pp_TxnRefNo, pp_Amount } = webhookData;

  const paymentUpdate = {
    gatewayResponse: webhookData,
    processedAt: new Date(),
    verifiedAt: new Date()
  };

  return {
    paymentUpdate,
    transactionId: pp_OrderRef || pp_TxnRefNo,
    status: pp_ResponseCode === '000' ? 'completed' : 'failed'
  };
};

/**
 * Process Stripe webhook data
 */
const processStripeWebhook = async (webhookData) => {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  // Verify webhook signature if webhook secret is configured
  if (PAYMENT_CONFIG.STRIPE.webhookSecret && webhookData.rawBody) {
    const sig = webhookData.headers['stripe-signature'];
    try {
      stripe.webhooks.constructEvent(webhookData.rawBody, sig, PAYMENT_CONFIG.STRIPE.webhookSecret);
    } catch (err) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }
  }

  const event = webhookData.body || webhookData;
  const paymentIntent = event.data.object;

  const paymentUpdate = {
    gatewayResponse: event,
    processedAt: new Date(),
    verifiedAt: new Date()
  };

  let status = 'failed';
  if (event.type === 'payment_intent.succeeded') {
    status = 'completed';
  } else if (event.type === 'payment_intent.payment_failed') {
    status = 'failed';
  }

  return {
    paymentUpdate,
    transactionId: paymentIntent.id,
    status: status
  };
};

/**
 * Verify payment transaction with gateway
 */
export const verifyPaymentTransaction = async (transactionId, gateway) => {
  try {
    logger.info(`Verifying transaction ${transactionId} with ${gateway}`);

    let verificationResult;

    switch (gateway.toLowerCase()) {
      case 'easypaisa':
        verificationResult = await verifyEasypaisaTransaction(transactionId);
        break;
      case 'jazzcash':
        verificationResult = await verifyJazzCashTransaction(transactionId);
        break;
      default:
        throw new Error(`Unsupported gateway for verification: ${gateway}`);
    }

    // Update payment record if found
    const payment = await Payment.findOne({ transactionId });
    if (payment) {
      payment.gatewayResponse = {
        ...payment.gatewayResponse,
        verification: verificationResult
      };
      await payment.save();
    }

    return verificationResult;

  } catch (error) {
    logger.error('Payment verification failed:', error);
    throw new Error(`Verification failed: ${error.message}`);
  }
};

/**
 * Verify EasyPaisa transaction
 */
const verifyEasypaisaTransaction = async (transactionId) => {
  const config = PAYMENT_CONFIG.EASYPAISA;

  try {
    const response = await axios.post(`${config.baseUrl}/verify-transaction`, {
      merchantId: config.merchantId,
      transactionId,
      // Add other required fields based on EasyPaisa API
    }, {
      headers: {
        'Authorization': `Bearer ${config.password}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      verified: response.data.status === 'success',
      status: response.data.status,
      details: response.data
    };

  } catch (error) {
    logger.error('EasyPaisa verification failed:', error);
    return {
      verified: false,
      status: 'verification_failed',
      error: error.message
    };
  }
};

/**
 * Verify JazzCash transaction
 */
const verifyJazzCashTransaction = async (transactionId) => {
  const config = PAYMENT_CONFIG.JAZZCASH;

  try {
    const response = await axios.post(`${config.baseUrl}/verify-transaction`, {
      merchantId: config.merchantId,
      transactionId,
      // Add other required fields based on JazzCash API
    }, {
      headers: {
        'Authorization': `Bearer ${config.password}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      verified: response.data.ppTxnStatus === 'success',
      status: response.data.ppTxnStatus,
      details: response.data
    };

  } catch (error) {
    logger.error('JazzCash verification failed:', error);
    return {
      verified: false,
      status: 'verification_failed',
      error: error.message
    };
  }
};

/**
 * Get payment statistics
 */
export const getPaymentStatistics = async (filters = {}) => {
  const { startDate, endDate, gateway } = filters;

  let matchQuery = {};
  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
  }
  if (gateway) matchQuery.gateway = gateway;

  const stats = await Payment.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalPayments: { $sum: 1 },
        completedPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        failedPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        totalAmount: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] }
        },
        refundedAmount: {
          $sum: { $cond: [{ $eq: ['$type', 'refund'] }, '$amount', 0] }
        },
        byGateway: {
          $push: {
            gateway: '$gateway',
            amount: '$amount',
            status: '$status'
          }
        }
      }
    }
  ]);

  return stats[0] || {
    totalPayments: 0,
    completedPayments: 0,
    failedPayments: 0,
    totalAmount: 0,
    refundedAmount: 0,
    byGateway: []
  };
};

/**
 * Get payment history for user
 */
export const getPaymentHistory = async (userId, filters = {}) => {
  const { page = 1, limit = 10, type, status, startDate, endDate } = filters;

  let query = { userId };

  if (type) query.type = type;
  if (status) query.status = status;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const payments = await Payment.find(query)
    .populate('rideId', 'pickup dropoff status')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);

  const total = await Payment.countDocuments(query);

  return {
    payments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};