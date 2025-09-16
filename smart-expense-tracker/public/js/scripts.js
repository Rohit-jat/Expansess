// Google Charts integration for expense tracking
let isGoogleChartsLoaded = false;

/**
 * Loads Google Charts library and initializes charts
 */
function initializeGoogleCharts() {
  console.log('Initializing Google Charts...');
  google.charts.load('current', {'packages':['corechart']});
  google.charts.setOnLoadCallback(() => {
    console.log('Google Charts loaded successfully');
    isGoogleChartsLoaded = true;
    
    // Load appropriate chart based on current page
    const chartElement = document.getElementById('myChart');
    const dashboardChartElement = document.getElementById('dashboardChart');
    
    if (chartElement) {
      loadChart(); // Pie chart for /charts page
    }
    if (dashboardChartElement) {
      loadDashboardChart(); // Bar chart for dashboard
    }
  });
}

/**
 * Fetches chart data from API and renders chart
 */
async function loadChart() {
  console.log('loadChart called, isGoogleChartsLoaded:', isGoogleChartsLoaded);
  
  if (!isGoogleChartsLoaded) {
    console.log('Google Charts not yet loaded, waiting...');
    return;
  }
  
  try {
    console.log('Fetching chart data from /charts...');
    
    const response = await fetch('/charts', {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', {
      'content-type': response.headers.get('content-type')
    });
    
    if (!response.ok) {
      throw new Error(`API failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Chart data received:', data);
    
    renderChart(data);
  } catch (error) {
    console.error('Error loading chart:', error);
    showError(error.message);
  }
}

/**
 * Fetches dashboard analytics data and renders bar chart
 */
async function loadDashboardChart() {
  console.log('loadDashboardChart called, isGoogleChartsLoaded:', isGoogleChartsLoaded);
  
  if (!isGoogleChartsLoaded) {
    console.log('Google Charts not yet loaded, waiting...');
    return;
  }
  
  try {
    console.log('Fetching dashboard analytics data...');
    
    const response = await fetch('/dashboard/analytics', {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log('Dashboard analytics response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Dashboard analytics API failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Dashboard analytics data received:', data);
    
    renderDashboardChart(data);
  } catch (error) {
    console.error('Error loading dashboard chart:', error);
    showDashboardError(error.message);
  }
}

/**
 * Renders Google Chart with provided data
 * @param {Object} data - Chart data with labels and amounts
 */
function renderChart(data) {
  const chartDiv = document.getElementById('myChart');
  if (!chartDiv) {
    console.error('Chart div not found');
    return;
  }
  
  // Handle empty data
  if (!data.labels || data.labels.length === 0) {
    showNoData();
    return;
  }
  
  // Convert data to Google Charts format
  const chartData = [['Category', 'Amount']];
  for (let i = 0; i < data.labels.length; i++) {
    chartData.push([data.labels[i], data.amounts[i]]);
  }
  
  const dataTable = google.visualization.arrayToDataTable(chartData);
  
  const options = {
    title: 'Expense Breakdown by Category',
    titleTextStyle: {
      fontSize: 18,
      bold: true
    },
    pieHole: 0,
    width: '100%',
    height: 400,
    legend: {
      position: 'bottom',
      alignment: 'center'
    },
    colors: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
    backgroundColor: 'transparent',
    chartArea: {
      left: 20,
      top: 60,
      width: '100%',
      height: '75%'
    }
  };
  
  const chart = new google.visualization.PieChart(chartDiv);
  chart.draw(dataTable, options);
  
  console.log('Google Pie Chart rendered successfully');
}

/**
 * Renders Google Bar Chart for dashboard
 * @param {Object} data - Chart data with labels and amounts
 */
function renderDashboardChart(data) {
  const chartDiv = document.getElementById('dashboardChart');
  if (!chartDiv) {
    console.error('Dashboard chart div not found');
    return;
  }
  
  // Handle empty data
  if (!data.labels || data.labels.length === 0) {
    showDashboardNoData();
    return;
  }
  
  // Convert data to Google Charts format
  const chartData = [['Category', 'Amount']];
  for (let i = 0; i < data.labels.length; i++) {
    chartData.push([data.labels[i], data.amounts[i]]);
  }
  
  const dataTable = google.visualization.arrayToDataTable(chartData);
  
  const options = {
    title: 'Spending by Category',
    titleTextStyle: {
      fontSize: 16,
      bold: true
    },
    width: '100%',
    height: 300,
    legend: { position: 'none' },
    colors: ['#007bff'],
    backgroundColor: 'transparent',
    hAxis: {
      title: 'Amount ($)',
      minValue: 0,
      textStyle: { fontSize: 12 }
    },
    vAxis: {
      title: 'Categories',
      textStyle: { fontSize: 12 }
    },
    chartArea: {
      left: 80,
      top: 50,
      width: '75%',
      height: '70%'
    },
    bar: { groupWidth: '60%' }
  };
  
  const chart = new google.visualization.BarChart(chartDiv);
  chart.draw(dataTable, options);
  
  console.log('Google Bar Chart rendered successfully');
}

/**
 * Shows error message to user
 * @param {string} message - Error message
 */
function showError(message) {
  const container = document.querySelector('.chart-container');
  if (container) {
    container.innerHTML = `
      <div class="error-message">
        <p>❌ Error loading chart: ${message}</p>
        <button onclick="loadChart()" class="btn btn-primary">Retry</button>
      </div>
    `;
  }
}

/**
 * Shows dashboard error message
 * @param {string} message - Error message
 */
function showDashboardError(message) {
  const container = document.getElementById('dashboardChart');
  if (container) {
    container.innerHTML = `
      <div class="error-message">
        <p>❌ Error loading analytics: ${message}</p>
        <button onclick="loadDashboardChart()" class="btn btn-primary">Retry</button>
      </div>
    `;
  }
}

/**
 * Shows no data message
 */
function showNoData() {
  const container = document.querySelector('.chart-container');
  if (container) {
    container.innerHTML = `
      <div class="no-data-message">
        <p>📊 No data available</p>
        <p>Add some expenses to see your spending breakdown.</p>
        <a href="/add-expense" class="btn btn-primary">Add Expense</a>
      </div>
    `;
  }
}

/**
 * Shows dashboard no data message
 */
function showDashboardNoData() {
  const container = document.getElementById('dashboardChart');
  if (container) {
    container.innerHTML = `
      <div class="no-data-message">
        <p>📊 No expense data yet</p>
        <p>Start by adding your first expense to see analytics.</p>
        <a href="/add-expense" class="btn btn-primary">Add Expense</a>
      </div>
    `;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, looking for chart elements...');
  const chartElement = document.getElementById('myChart');
  const dashboardChartElement = document.getElementById('dashboardChart');
  
  if (chartElement || dashboardChartElement) {
    console.log('Chart elements found, checking Google Charts availability...');
    
    // Check if Google Charts API is available
    if (typeof google !== 'undefined' && google.charts) {
      console.log('Google Charts API already available');
      initializeGoogleCharts();
    } else {
      console.log('Waiting for Google Charts to load...');
      // Wait for Google Charts to load
      let attempts = 0;
      const maxAttempts = 100; // 10 seconds
      
      const checkGoogle = setInterval(() => {
        attempts++;
        console.log(`Checking for Google Charts (attempt ${attempts}/${maxAttempts})...`);
        
        if (typeof google !== 'undefined' && google.charts) {
          console.log('Google Charts found!');
          clearInterval(checkGoogle);
          initializeGoogleCharts();
        } else if (attempts >= maxAttempts) {
          console.error('Google Charts failed to load after 10 seconds');
          clearInterval(checkGoogle);
          
          // Show error on both chart containers if they exist
          if (chartElement) {
            showError('Google Charts failed to load. Please refresh the page.');
          }
          if (dashboardChartElement) {
            showDashboardError('Google Charts failed to load. Please refresh the page.');
          }
        }
      }, 100);
    }
  } else {
    console.log('No chart elements found - not on a page with charts');
  }
});