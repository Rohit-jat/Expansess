const PDFDocument = require('pdfkit');

const createPDF = (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', (err) => {
        reject(err);
      });

      // Title
      doc.fontSize(25).text('Expense Report', { align: 'center' });
      doc.moveDown();

      // User and total
      doc.fontSize(14).text(`User: ${data.user}`);
      doc.text(`Total Spent: $${data.total.toFixed(2)}`);
      doc.text(`Report Period: ${data.period}`);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`);
      doc.moveDown();

      // Categories
      if (data.categories && data.categories.length > 0) {
        doc.fontSize(16).text('Category Breakdown:', { underline: true });
        doc.fontSize(12);
        data.categories.forEach((cat) => {
          doc.text(`${cat._id.charAt(0).toUpperCase() + cat._id.slice(1)}: $${cat.total.toFixed(2)}`);
        });
      } else {
        doc.fontSize(16).text('Category Breakdown:', { underline: true });
        doc.fontSize(12).text('No expense categories found.');
      }
      doc.moveDown();

      // Trends
      if (data.trends && data.trends.length > 0) {
        doc.fontSize(16).text(`Trends (${data.period}):`, { underline: true });
        doc.fontSize(12);
        data.trends.forEach((tr) => {
          let label;
          if (data.period === 'weekly') {
            label = `Week ${tr._id.week}, ${tr._id.year}`;
          } else {
            label = `${tr._id.month.toString().padStart(2, '0')}/${tr._id.year}`;
          }
          doc.text(`${label}: $${tr.total.toFixed(2)}`);
        });
      } else {
        doc.fontSize(16).text(`Trends (${data.period}):`, { underline: true });
        doc.fontSize(12).text('No spending trends found for the selected period.');
      }

      // Finalize the PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { createPDF };