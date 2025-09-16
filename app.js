require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Expense = require('./models/Expense');
const connectDB = require('./config/database');
const authMiddleware = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const insightsRoutes = require('./routes/insights');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to database
connectDB();

// Middleware - Configure Helmet with CSP for Google Charts


app.use(cors());
app.use(morgan('combined'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
// Serve Chart.js from node_modules
app.use('/node_modules/chart.js', express.static(path.join(__dirname, 'node_modules/chart.js')));

// Rate limiting for auth routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/auth', limiter);

// View routes
app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', async (req, res) => {
  // Check if already logged in
  try {
    const token = req.cookies.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user) return res.redirect('/dashboard');
    }
  } catch (err) {
    // Invalid token, proceed to login
  }
  res.render('layouts/main', { 
    body: 'auth/login', 
    title: 'Login', 
    user: null, 
    error: null 
  });
});

app.get('/register', async (req, res) => {
  // Check if already logged in
  try {
    const token = req.cookies.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user) return res.redirect('/dashboard');
    }
  } catch (err) {
    // Invalid token, proceed to register
  }
  res.render('layouts/main', { 
    body: 'auth/register', 
    title: 'Register', 
    user: null, 
    error: null 
  });
});

app.get('/dashboard', authMiddleware, async (req, res) => {
  const totalSpent = await Expense.aggregate([
    { $match: { userId: req.user._id } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const total = totalSpent[0]?.total || 0;
  res.render('layouts/main', { 
    body: 'dashboard/index', 
    title: 'Dashboard', 
    user: req.user, 
    totalSpent: total 
  });
});

// API for Chart.js expenses data
app.get('/api/expenses/chartjs-data', authMiddleware, async (req, res) => {
  try {
    const period = req.query.period || 'monthly'; // 'weekly' or 'monthly'
    console.log(`Chart.js data requested for period: ${period}`);
    
    // Validate period
    if (!['weekly', 'monthly'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period. Must be "weekly" or "monthly"' });
    }
    
    const dateGroup = period === 'weekly' 
      ? { year: { $year: '$date' }, week: { $week: '$date' } }
      : { year: { $year: '$date' }, month: { $month: '$date' } };

    // Get aggregated data for chart
    const chartData = await Expense.aggregate([
      { $match: { userId: req.user._id } },
      { 
        $group: { 
          _id: dateGroup, 
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        } 
      },
      { $sort: { '_id.year': 1, '_id.week': 1, '_id.month': 1 } }
    ]);
    
    // Get individual expenses for table
    const expenses = await Expense.find({ userId: req.user._id })
      .sort({ date: -1 })
      .limit(50); // Limit to recent 50 expenses
    
    // Format chart data for Chart.js
    const labels = [];
    const amounts = [];
    
    chartData.forEach(item => {
      let label;
      if (period === 'weekly') {
        label = `Week ${item._id.week}, ${item._id.year}`;
      } else {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label = `${months[item._id.month - 1]} ${item._id.year}`;
      }
      labels.push(label);
      amounts.push(item.total);
    });
    
    // Format expenses for table
    const formattedExpenses = expenses.map(expense => ({
      date: expense.date.toISOString().split('T')[0],
      description: expense.description,
      amount: expense.amount,
      category: expense.category
    }));
    
    res.json({
      chartData: {
        labels,
        amounts
      },
      tableData: formattedExpenses,
      period: period,
      totalExpenses: expenses.length
    });
    
  } catch (error) {
    console.error('Chart.js data API error:', error);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

// Dashboard analytics API endpoint
app.get('/dashboard/analytics', authMiddleware, async (req, res) => {
  try {
    console.log('Dashboard analytics accessed by user:', req.user._id);
    const expenses = await Expense.aggregate([
      { $match: { userId: req.user._id } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } }
    ]);

    const labels = expenses.map(expense => 
      expense._id.charAt(0).toUpperCase() + expense._id.slice(1)
    );
    const amounts = expenses.map(expense => expense.total);
    
    const result = { labels, amounts };
    console.log('Sending dashboard analytics data:', result);
    res.json(result);
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

app.get('/add-expense', authMiddleware, (req, res) => {
  res.render('layouts/main', { 
    body: 'dashboard/expense-form', 
    title: 'Add Expense', 
    user: req.user,
    error: null 
  });
});

app.get('/expenses', authMiddleware, async (req, res) => {
  const expenses = await Expense.find({ userId: req.user._id }).sort({ date: -1 });
  res.render('layouts/main', { 
    body: 'dashboard/expense-list', 
    title: 'Expenses', 
    user: req.user, 
    expenses 
  });
});

app.get('/charts-chartjs', authMiddleware, (req, res) => {
  res.render('layouts/main', { 
    body: 'dashboard/charts-chartjs', 
    title: 'Charts - Chart.js', 
    user: req.user 
  });
});

app.get('/charts', authMiddleware, async (req, res) => {
  try {
    console.log('Charts route accessed by user:', req.user._id);
    console.log('Request headers:', {
      accept: req.headers.accept,
      userAgent: req.headers['user-agent']?.substring(0, 50) + '...'
    });
    
    // If requesting JSON data
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      console.log('Fetching chart data from MongoDB...');
      const expenses = await Expense.aggregate([
        { $match: { userId: req.user._id } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } }
      ]);

      console.log('Raw expense data:', expenses);
      
      const labels = expenses.map(expense => 
        expense._id.charAt(0).toUpperCase() + expense._id.slice(1)
      );
      const amounts = expenses.map(expense => expense.total);
      
      const result = { labels, amounts };
      console.log('Sending chart data:', result);
      return res.json(result);
    }
    
    // Otherwise render the charts page
    console.log('Rendering charts page');
    res.render('layouts/main', { 
      body: 'dashboard/charts', 
      title: 'Charts', 
      user: req.user 
    });
  } catch (error) {
    console.error('Charts error:', error);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.status(500).json({ error: 'Failed to fetch chart data' });
    } else {
      res.status(500).render('500', { title: '500 - Server Error' });
    }
  }
});

app.get('/insights', authMiddleware, (req, res) => {
  res.render('layouts/main', { 
    body: 'dashboard/insights', 
    title: 'Weekly/Monthly Insights', 
    user: req.user 
  });
});

app.get('/reports', authMiddleware, (req, res) => {
  res.render('layouts/main', { 
    body: 'dashboard/insights-report', 
    title: 'Reports', 
    user: req.user 
  });
});

app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', authMiddleware, expenseRoutes);
app.use('/api/insights', authMiddleware, insightsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: '404 - Not Found' });
});

// 500 handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('500', { title: '500 - Server Error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Visit http://localhost:3000 to view the application');
  console.log('Expense functionality updated');
  console.log('Charts debugging enabled');
});