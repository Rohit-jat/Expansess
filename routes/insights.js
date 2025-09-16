const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const { createPDF } = require('../services/pdfGenerator');

// Get category-wise spending
router.get('/categories', async (req, res) => {
  try {
    console.log('Categories API called for user:', req.user._id);
    console.log('User object:', req.user);
    
    const pipeline = [
      { $match: { userId: req.user._id } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } }
    ];
    
    const categories = await Expense.aggregate(pipeline);
    console.log('Categories result:', categories);
    
    // If no data, return empty array but log it
    if (categories.length === 0) {
      console.log('No expenses found for user:', req.user._id);
      // Let's check if there are any expenses at all for this user
      const allExpenses = await Expense.find({ userId: req.user._id });
      console.log('Total expenses for user:', allExpenses.length);
    }
    
    res.json(categories);
  } catch (err) {
    console.error('Categories API error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get spending trends
router.get('/trends', async (req, res) => {
  try {
    console.log('Trends API called for user:', req.user._id);
    const period = req.query.period || 'monthly'; // 'weekly' or 'monthly'
    const dateGroup = period === 'weekly' 
      ? { year: { $year: '$date' }, week: { $week: '$date' } }
      : { year: { $year: '$date' }, month: { $month: '$date' } };

    const pipeline = [
      { 
        $match: { 
          userId: req.user._id, 
          date: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } // Last year
        } 
      },
      { 
        $group: { 
          _id: dateGroup, 
          total: { $sum: '$amount' } 
        } 
      },
      { $sort: { '_id.year': 1, '_id.week': 1, '_id.month': 1 } }
    ];
    const trends = await Expense.aggregate(pipeline);
    console.log('Trends result:', trends);
    res.json(trends);
  } catch (err) {
    console.error('Trends API error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Generate report (PDF download)
router.post('/report', async (req, res) => {
  try {
    console.log('Report generation started for user:', req.user._id);
    console.log('Request body:', req.body);
    
    const { type } = req.body; // Only 'download' is supported
    const period = 'monthly'; // Fixed for simplicity; can be extended

    if (!type || type !== 'download') {
      return res.status(400).json({ error: 'Only download type is supported' });
    }

    // Fetch data
    const categoriesPipeline = [
      { $match: { userId: req.user._id } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } }
    ];
    const categories = await Expense.aggregate(categoriesPipeline);
    console.log('Categories found:', categories.length);

    const dateGroup = period === 'weekly' 
      ? { year: { $year: '$date' }, week: { $week: '$date' } }
      : { year: { $year: '$date' }, month: { $month: '$date' } };

    const trendsPipeline = [
      { 
        $match: { 
          userId: req.user._id, 
          date: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } 
        } 
      },
      { 
        $group: { 
          _id: dateGroup, 
          total: { $sum: '$amount' } 
        } 
      },
      { $sort: { '_id.year': 1, '_id.week': 1, '_id.month': 1 } }
    ];
    const trends = await Expense.aggregate(trendsPipeline);
    console.log('Trends found:', trends.length);

    const totalPipeline = [
      { $match: { userId: req.user._id } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ];
    const totalSpent = await Expense.aggregate(totalPipeline);
    const total = totalSpent[0]?.total || 0;
    console.log('Total spent:', total);

    const data = {
      categories,
      trends,
      total,
      user: req.user.username,
      period
    };

    console.log('Generating PDF...');
    const pdfBuffer = await createPDF(data);
    console.log('PDF generated, buffer size:', pdfBuffer.length);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=expense-report.pdf',
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Report generation error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;