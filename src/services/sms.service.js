import twilio from 'twilio';
import logger from '../utils/logger.js';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Support both TWILIO_PHONE and TWILIO_PHONE_NUMBER (Twilio docs use TWILIO_PHONE_NUMBER)
const twilioFromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE;

export const sendSMS = async (to, message) => {
  try {
    logger.info(`Attempting to send SMS to: ${to}`);

    const result = await client.messages.create({
      body: message,
      from: twilioFromNumber,
      to,
    });

    logger.info(`SMS sent successfully to ${to}: ${result.sid}`);
    return result;
  } catch (error) {
    logger.error('Twilio SMS error:', error);
    logger.error('Phone number used:', to);
    logger.error('Twilio from number:', twilioFromNumber);

    // Provide more specific error message
    if (error.code === 21211) {
      throw new Error('SMS_REJECTED_PHONE: The phone number was rejected by the SMS provider. Use E.164 format (e.g. +923001234567). On Twilio trial accounts, the number must be verified in the Twilio console.');
    } else if (error.code === 21608) {
      throw new Error('Phone number is not verified for this Twilio account');
    } else if (error.code === 20003) {
      throw new Error('Twilio authentication failed');
    } else {
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }
};
