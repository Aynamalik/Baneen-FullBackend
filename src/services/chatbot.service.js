import logger from '../utils/logger.js';
import Ride from '../models/Ride.js';
import User from '../models/User.js';
import AiInteraction from '../models/ChatbotAndVoiceLogs.js';

// AI Chatbot Service for Baneen Ride-Sharing Platform
class ChatbotService {
  constructor() {
    this.conversationHistory = new Map(); // Store conversation context
    this.maxHistoryLength = 50;

    // Knowledge base for FAQs and responses
    this.knowledgeBase = {
      greetings: [
        'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
        'assalamualaikum', 'سلام', 'ہیلو', 'ہائے'
      ],
      fare: [
        'fare', 'cost', 'price', 'rate', 'charges', 'amount', 'payment',
        'کرایہ', 'قیمت', 'رقم', 'ادا'
      ],
      booking: [
        'book', 'ride', 'booking', 'request', 'order', 'reserve',
        'بک', 'سواری', 'بکنگ', 'آرڈر'
      ],
      cancellation: [
        'cancel', 'cancellation', 'cancelled', 'abort', 'stop',
        'منسوخ', 'کینسل', 'روک'
      ],
      driver: [
        'driver', 'captain', 'rider', 'chauffeur',
        'ڈرائیور', 'کیپٹن', 'سواریوالا'
      ],
      location: [
        'where', 'location', 'address', 'place', 'destination',
        'کہاں', 'لوکیشن', 'پتہ', 'جگہ'
      ],
      emergency: [
        'emergency', 'sos', 'help', 'accident', 'problem',
        'ایمرجنسی', 'مدد', 'حادثہ', 'مسئلہ'
      ],
      payment: [
        'pay', 'payment', 'cash', 'card', 'wallet', 'easypaisa', 'jazzcash',
        'ادا', 'پیسہ', 'کارڈ', 'والیٹ'
      ]
    };
  }

  /**
   * Process user message and generate response
   */
  async processMessage(message, userId, userRole = 'passenger', context = {}) {
    try {
      logger.info(`Processing chatbot message from user ${userId}: ${message}`);

      const messageLower = message.toLowerCase().trim();
      const intent = this.classifyIntent(messageLower);
      const entities = this.extractEntities(messageLower);

      // Store conversation context
      this.updateConversationContext(userId, {
        lastMessage: message,
        lastIntent: intent,
        timestamp: new Date(),
        context
      });

      // Generate response based on intent
      const response = await this.generateResponse(intent, entities, userId, userRole, context);

      // Log chatbot interaction for admin review
      this.logChatbotInteraction(userId, message, response, intent);

      return {
        response,
        intent,
        entities,
        confidence: this.calculateConfidence(intent, messageLower),
        suggestedActions: this.getSuggestedActions(intent, userRole)
      };

    } catch (error) {
      logger.error('Chatbot processing error:', error);
      return {
        response: 'Sorry, I\'m having trouble processing your message right now. Please try again or contact support.',
        intent: 'ERROR',
        entities: {},
        confidence: 0,
        suggestedActions: []
      };
    }
  }

  /**
   * Classify user intent from message
   */
  classifyIntent(message) {
    // Check for greetings first
    if (this.containsKeywords(message, this.knowledgeBase.greetings)) {
      return 'GREETING';
    }

    // Check for fare inquiries
    if (this.containsKeywords(message, this.knowledgeBase.fare)) {
      return 'FARE_INQUIRY';
    }

    // Check for booking requests
    if (this.containsKeywords(message, this.knowledgeBase.booking)) {
      return 'BOOKING_REQUEST';
    }

    // Check for cancellation
    if (this.containsKeywords(message, this.knowledgeBase.cancellation)) {
      return 'CANCEL_RIDE';
    }

    // Check for driver queries
    if (this.containsKeywords(message, this.knowledgeBase.driver)) {
      return 'DRIVER_QUERY';
    }

    // Check for location queries
    if (this.containsKeywords(message, this.knowledgeBase.location)) {
      return 'LOCATION_QUERY';
    }

    // Check for emergency
    if (this.containsKeywords(message, this.knowledgeBase.emergency)) {
      return 'EMERGENCY';
    }

    // Check for payment queries
    if (this.containsKeywords(message, this.knowledgeBase.payment)) {
      return 'PAYMENT_QUERY';
    }

    // Check for common questions
    if (message.includes('how') || message.includes('what') || message.includes('when') || message.includes('why')) {
      return 'GENERAL_QUESTION';
    }

    // Check for gratitude
    if (message.includes('thank') || message.includes('thanks') || message.includes('شکر') || message.includes('شکریہ')) {
      return 'GRATITUDE';
    }

    return 'UNKNOWN';
  }

  /**
   * Extract entities from message
   */
  extractEntities(message) {
    const entities = {};

    // Extract locations
    const locationPatterns = [
      /(?:to|from|at)\s+([a-zA-Z\s,]+)/i,
      /([a-zA-Z\s,]+)(?:\s+(area|sector|phase))/i
    ];

    for (const pattern of locationPatterns) {
      const match = message.match(pattern);
      if (match) {
        entities.location = match[1].trim();
        break;
      }
    }

    // Extract amounts/numbers
    const numberMatch = message.match(/(\d+(\.\d+)?)/);
    if (numberMatch) {
      entities.amount = parseFloat(numberMatch[1]);
    }

    // Extract time references
    if (message.includes('now') || message.includes('immediately') || message.includes('ابھی')) {
      entities.timePreference = 'now';
    }

    return entities;
  }

  /**
   * Generate response based on intent
   */
  async generateResponse(intent, entities, userId, userRole, context) {
    const responses = {
      GREETING: [
        'Hello! How can I help you with your ride today?',
        'Hi there! Ready to book a ride?',
        'Hello! What can I do for you?',
        'Assalamualaikum! How can I assist you?'
      ],

      FARE_INQUIRY: [
        'Our fares start from PKR 100 and depend on distance and time. Would you like me to estimate a fare for a specific route?',
        'Fare calculation is based on distance, time, and surge pricing. Use our fare estimator to get an accurate quote.',
        'Minimum fare is PKR 100. Additional charges apply for longer distances and peak hours.'
      ],

      BOOKING_REQUEST: [
        'I can help you book a ride! Where would you like to go?',
        'Great! Let me help you book a ride. Please tell me your pickup location and destination.',
        'Ready to book? Just share your pickup and drop-off locations.'
      ],

      CANCEL_RIDE: [
        'To cancel a ride, go to your active ride screen and tap "Cancel Ride". Note that cancellation fees may apply.',
        'You can cancel your ride from the app. Please check the cancellation policy for any applicable fees.',
        'Ride cancellation is available up to 2 minutes before pickup. After that, cancellation fees apply.'
      ],

      DRIVER_QUERY: [
        'Your driver information will be available once they accept your ride request.',
        'Driver details including name, rating, and vehicle info will be shown when they arrive.',
        'You can contact your driver through the in-app chat once they accept your ride.'
      ],

      LOCATION_QUERY: [
        'You can track your driver\'s live location in the app once they start the ride.',
        'Driver location tracking is available during active rides.',
        'Live location sharing starts when your driver begins the trip.'
      ],

      EMERGENCY: [
        'For emergencies, please use the SOS button in the app or call emergency services directly.',
        'In case of emergency, tap the red SOS button or call 1122 (Pakistan) or 911.',
        'Safety first! Use the SOS feature in the app for immediate assistance.'
      ],

      PAYMENT_QUERY: [
        'We accept cash, Easypaisa, and JazzCash payments. Digital payments are recommended for contactless experience.',
        'Payment methods include cash on delivery, Easypaisa, and JazzCash wallets.',
        'Cash payment is available, but we recommend digital wallets for faster checkout.'
      ],

      GENERAL_QUESTION: [
        'I\'d be happy to help! Could you please provide more details about your question?',
        'I\'m here to assist. What specific information do you need?',
        'Let me help you with that. Can you tell me more about what you\'re looking for?'
      ],

      GRATITUDE: [
        'You\'re welcome! Is there anything else I can help you with?',
        'Happy to help! Have a great ride!',
        'My pleasure! Safe travels!'
      ],

      UNKNOWN: [
        'I\'m not sure I understand. Could you please rephrase your question?',
        'Sorry, I didn\'t catch that. Try asking about booking rides, fares, or driver information.',
        'I\'m still learning! Please try asking in a different way or contact support.'
      ]
    };

    const responseArray = responses[intent] || responses.UNKNOWN;
    return responseArray[Math.floor(Math.random() * responseArray.length)];
  }

  /**
   * Get suggested actions based on intent
   */
  getSuggestedActions(intent, userRole) {
    const actions = {
      BOOKING_REQUEST: [
        { type: 'NAVIGATE', screen: 'RideBooking', label: 'Book a Ride' },
        { type: 'NAVIGATE', screen: 'FareEstimate', label: 'Estimate Fare' }
      ],
      FARE_INQUIRY: [
        { type: 'NAVIGATE', screen: 'FareCalculator', label: 'Calculate Fare' }
      ],
      DRIVER_QUERY: [
        { type: 'NAVIGATE', screen: 'ActiveRide', label: 'View Active Ride' },
        { type: 'ACTION', action: 'CONTACT_DRIVER', label: 'Contact Driver' }
      ],
      EMERGENCY: [
        { type: 'ACTION', action: 'TRIGGER_SOS', label: 'Trigger SOS' },
        { type: 'ACTION', action: 'CALL_EMERGENCY', label: 'Call Emergency' }
      ],
      LOCATION_QUERY: [
        { type: 'NAVIGATE', screen: 'RideTracking', label: 'Track Ride' }
      ]
    };

    return actions[intent] || [];
  }

  /**
   * Calculate confidence score for intent classification
   */
  calculateConfidence(intent, message) {
    if (intent === 'UNKNOWN') return 0.1;
    if (intent === 'GREETING') return 0.9;

    // Count matching keywords
    const keywords = this.knowledgeBase[intent.toLowerCase().split('_')[0]] || [];
    const matches = keywords.filter(keyword => message.includes(keyword)).length;

    return Math.min(matches * 0.3 + 0.5, 0.95);
  }

  /**
   * Update conversation context
   */
  updateConversationContext(userId, context) {
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, []);
    }

    const history = this.conversationHistory.get(userId);
    history.push(context);

    // Keep only recent history
    if (history.length > this.maxHistoryLength) {
      history.shift();
    }
  }

  /**
   * Get conversation context for user
   */
  getConversationContext(userId) {
    return this.conversationHistory.get(userId) || [];
  }

  /**
   * Log chatbot interactions for admin review
   */
  async logChatbotInteraction(userId, userMessage, botResponse, intent) {
    try {
      // In production, save to database for admin review
      logger.info(`Chatbot Interaction - User: ${userId}, Intent: ${intent}, Message: ${userMessage}`);

      // Save to AiInteraction model for admin monitoring
      try {
        await AiInteraction.create({
          user: userId,
          type: 'chat',
          input: userMessage,
          response: botResponse,
          intent,
        });
      } catch (logError) {
        logger.warn('Failed to save chatbot interaction:', logError.message);
      }

    } catch (error) {
      logger.error('Failed to log chatbot interaction:', error);
    }
  }

  /**
   * Check if message contains keywords
   */
  containsKeywords(message, keywords) {
    return keywords.some(keyword => message.includes(keyword));
  }

  /**
   * Get help topics
   */
  getHelpTopics() {
    return {
      booking: 'How to book a ride, fare estimation, ride types',
      payment: 'Payment methods, digital wallets, cash payments',
      safety: 'SOS feature, emergency contacts, safety tips',
      account: 'Profile management, ride history, ratings',
      driver: 'Driver information, contact, ratings',
      cancellation: 'Ride cancellation policy, fees, refunds'
    };
  }
}

// Export singleton instance
const chatbotService = new ChatbotService();
export default chatbotService;