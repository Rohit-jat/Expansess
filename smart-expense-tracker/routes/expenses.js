const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const Joi = require('joi');

// Validation schema
const expenseSchema = Joi.object({
  amount: Joi.number().positive().precision(2).required(),
  date: Joi.date().required(),
  category: Joi.string().valid('food', 'travel', 'bills', 'entertainment', 'other').required(),
  description: Joi.string().allow('').optional()
});

// Get all expenses (for API)
router.get('/', async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.user._id }).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add expense
router.post('/', async (req, res) => {
  try {
    const { error } = expenseSchema.validate(req.body);
    if (error) {
      const errorMessage = error.details[0].message;
      // Check if request accepts JSON (API call) or HTML (form submission)
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(400).json({ error: errorMessage });
      } else {
        return res.status(400).render('layouts/main', {
          body: 'dashboard/expense-form',
          title: 'Add Expense',
          user: req.user,
          error: errorMessage
        });
      }
    }

    const expense = new Expense({
      ...req.body,
      userId: req.user._id
    });
    await expense.save();

    // Check response type for redirect vs JSON
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.status(201).json(expense);
    } else {
      res.redirect('/expenses');
    }
  } catch (err) {
    console.error('Error adding expense:', err);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.status(500).json({ error: 'Server error' });
    } else {
      res.status(500).render('layouts/main', {
        body: 'dashboard/expense-form',
        title: 'Add Expense',
        user: req.user,
        error: 'Server error while adding expense'
      });
    }
  }
});

// Delete expense
router.post('/:id/delete', async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.redirect('/expenses');
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;