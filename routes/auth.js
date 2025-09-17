const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const User = require('../models/User');

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required()
});

const resetPasswordSchema = Joi.object({
  password: Joi.string().min(6).required(),
  confirmPassword: Joi.string().min(6).required()
});

// Register route
router.post('/register', async (req, res) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) {
      return res.render('layouts/main', {
        body: 'auth/register',
        title: 'Register',
        user: null,
        error: error.details[0].message
      });
    }

    const { username, email, password } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return res.render('layouts/main', {
        body: 'auth/register',
        title: 'Register',
        user: null,
        error: 'User already exists'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({ username, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.redirect('/dashboard');
  } catch (err) {
    res.render('layouts/main', {
      body: 'auth/register',
      title: 'Register',
      user: null,
      error: 'Server error'
    });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.render('layouts/main', {
        body: 'auth/login',
        title: 'Login',
        user: null,
        error: error.details[0].message
      });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.render('layouts/main', {
        body: 'auth/login',
        title: 'Login',
        user: null,
        error: 'Invalid credentials'
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.render('layouts/main', {
        body: 'auth/login',
        title: 'Login',
        user: null,
        error: 'Invalid credentials'
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.redirect('/dashboard');
  } catch (err) {
    res.render('layouts/main', {
      body: 'auth/login',
      title: 'Login',
      user: null,
      error: 'Server error'
    });
  }
});

// Configure nodemailer
const transporter = nodemailer.createTransport({
  // For development, we'll use a fake email service
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USERNAME || 'demo@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'demopassword'
  }
});

// Forgot Password route
router.post('/forgot-password', async (req, res) => {
  try {
    const { error } = forgotPasswordSchema.validate(req.body);
    if (error) {
      return res.render('layouts/main', {
        body: 'auth/forgot-password',
        title: 'Forgot Password',
        user: null,
        error: error.details[0].message
      });
    }

    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.render('layouts/main', {
        body: 'auth/forgot-password',
        title: 'Forgot Password',
        user: null,
        error: 'No account found with that email address'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Create reset URL
    const resetURL = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;

    // For development, we'll just log the reset URL instead of sending email
    console.log('Password Reset URL:', resetURL);
    console.log('User:', email);
    
    // In production, you would send this via email:
    /*
    const message = {
      from: process.env.EMAIL_FROM || 'noreply@smartexpensetracker.com',
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <h2>Password Reset Request</h2>
        <p>You are receiving this email because you requested a password reset for your Smart Expense Tracker account.</p>
        <p>Please click the link below to reset your password:</p>
        <a href="${resetURL}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px;">Reset Password</a>
        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
        <p>This link will expire in 10 minutes.</p>
      `
    };
    
    await transporter.sendMail(message);
    */

    res.render('layouts/main', {
      body: 'auth/forgot-password-success',
      title: 'Reset Email Sent',
      user: null,
      email: user.email,
      resetURL: resetURL // For development only
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.render('layouts/main', {
      body: 'auth/forgot-password',
      title: 'Forgot Password',
      user: null,
      error: 'An error occurred. Please try again.'
    });
  }
});

// Reset Password route
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { error } = resetPasswordSchema.validate(req.body);
    if (error) {
      return res.render('layouts/main', {
        body: 'auth/reset-password',
        title: 'Reset Password',
        user: null,
        token: req.params.token,
        error: error.details[0].message
      });
    }

    const { password, confirmPassword } = req.body;
    
    if (password !== confirmPassword) {
      return res.render('layouts/main', {
        body: 'auth/reset-password',
        title: 'Reset Password',
        user: null,
        token: req.params.token,
        error: 'Passwords do not match'
      });
    }

    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.render('layouts/main', {
        body: 'auth/reset-password',
        title: 'Reset Password',
        user: null,
        token: req.params.token,
        error: 'Password reset token is invalid or has expired'
      });
    }

    // Update password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Auto login after password reset
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.redirect('/dashboard?message=Password successfully reset');
  } catch (err) {
    console.error('Reset password error:', err);
    res.render('layouts/main', {
      body: 'auth/reset-password',
      title: 'Reset Password',
      user: null,
      token: req.params.token,
      error: 'An error occurred. Please try again.'
    });
  }
});

module.exports = router;