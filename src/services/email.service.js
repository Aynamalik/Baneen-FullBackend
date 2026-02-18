import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

export const sendEmail = async (to, subject, html) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info(`Email sent successfully to ${to}: ${info.messageId}`);

    return { success: true, message: 'Email sent successfully', messageId: info.messageId };
  } catch (error) {
    logger.error('Email sending error:', error);
    throw new Error('Failed to send email');
  }
};

export const sendOTPEmail = async (email, otp) => {
  const subject = 'Baneen - Password Reset OTP';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Password Reset Request</h2>
      <p>Hello,</p>
      <p>You have requested to reset your password for your Baneen account.</p>
      <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px; text-align: center;">
        <h3 style="color: #007bff; margin: 0; font-size: 24px;">${otp}</h3>
        <p style="margin: 10px 0 0 0; color: #666;">Your OTP code</p>
      </div>
      <p>This OTP will expire in 10 minutes.</p>
      <p>If you didn't request this password reset, please ignore this email.</p>
      <p>Best regards,<br>Baneen Team</p>
    </div>
  `;

  return await sendEmail(email, subject, html);
};