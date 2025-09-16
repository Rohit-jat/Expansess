const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
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

module.exports = router;