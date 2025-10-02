const csv = require('csv-stringify');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

class ExportService {
  async exportToCsv(data, columns) {
    return new Promise((resolve, reject) => {
      csv.stringify(data, { header: true, columns: columns }, (err, output) => {
        if (err) return reject(err);
        resolve(output);
      });
    });
  }

  async exportToExcel(data, columns, sheetName = 'Data') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // Add headers
    worksheet.columns = columns.map(col => ({ header: col.header, key: col.key, width: col.width || 20 }));

    // Add rows
    worksheet.addRows(data);

    // Generate buffer
    return await workbook.xlsx.writeBuffer();
  }

  async exportToPdf(data, columns, title = 'Query Results') {
    return new Promise((resolve) => {
      const doc = new PDFDocument();
      let buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        let pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      doc.fontSize(16).text(title, { align: 'center' });
      doc.moveDown();

      // Table headers
      const tableTop = doc.y;
      const colWidth = doc.page.width / columns.length;
      let currentX = 50;

      doc.font('Helvetica-Bold').fontSize(10);
      columns.forEach(col => {
        doc.text(col.header, currentX, tableTop, { width: colWidth - 10, align: 'left' });
        currentX += colWidth;
      });
      doc.moveDown();

      // Table rows
      doc.font('Helvetica').fontSize(9);
      data.forEach(row => {
        currentX = 50;
        columns.forEach(col => {
          doc.text(String(row[col.key] || ''), currentX, doc.y, { width: colWidth - 10, align: 'left' });
          currentX += colWidth;
        });
        doc.moveDown();
      });

      doc.end();
    });
  }
}

module.exports = new ExportService();
