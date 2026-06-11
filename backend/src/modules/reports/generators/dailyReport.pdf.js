const { createDoc, pageHeader, tableHeader, tableRow, totalRow, pageFooter, mmToPt } = require('./pdfHelper');

const fmt = (n) => Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2 });

async function generateDailyReportPDF(data, millName = 'Auto Rice Mill') {
  const { doc, finalize } = createDoc();
  let y;
  let pageNum = 1;

  const newPage = () => {
    pageFooter(doc, pageNum++);
    doc.addPage();
    y = pageHeader(doc, millName, 'Daily Report', `Date: ${data.date}`);
  };

  y = pageHeader(doc, millName, 'Daily Report', `Date: ${data.date}`);

  // ── Sales ──────────────────────────────────────────────────────────────────
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a6b3a').text('Sales', doc.page.margins.left, y + 6);
  y += 20;
  const saleCols = [
    { label: '#',               width: 30 },
    { label: 'Customer',        width: 160 },
    { label: 'Invoice',         width: 100 },
    { label: 'Items',           width: 50,  align: 'right' },
    { label: 'Amount (BDT)',    width: 110, align: 'right' },
    { label: 'Status',          width: 80 },
  ];
  y = tableHeader(doc, y, saleCols);
  data.sales.items.forEach((s, i) => {
    if (y > doc.page.height - 80) newPage();
    y = tableRow(doc, y, saleCols, [i + 1, s.customer_name, s.invoice_number, s.items_count ?? '-', fmt(s.total_amount), s.payment_status ?? '-'], i % 2 === 1);
  });
  y = totalRow(doc, y + 4, 'Sales Total', data.sales.total);

  // ── Purchases ──────────────────────────────────────────────────────────────
  y += 14;
  if (y > doc.page.height - 100) newPage();
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a6b3a').text('Purchases', doc.page.margins.left, y);
  y += 16;
  const purchCols = [
    { label: '#',            width: 30 },
    { label: 'Supplier',     width: 160 },
    { label: 'Reference',    width: 100 },
    { label: 'Paddy (kg)',   width: 100, align: 'right' },
    { label: 'Amount (BDT)', width: 110, align: 'right' },
    { label: 'Status',       width: 80 },
  ];
  y = tableHeader(doc, y, purchCols);
  data.purchases.items.forEach((p, i) => {
    if (y > doc.page.height - 80) newPage();
    y = tableRow(doc, y, purchCols, [i + 1, p.supplier_name, p.reference_number ?? '-', fmt(p.quantity), fmt(p.total_amount), p.payment_status ?? '-'], i % 2 === 1);
  });
  y = totalRow(doc, y + 4, 'Purchases Total', data.purchases.total);

  // ── Production ─────────────────────────────────────────────────────────────
  y += 14;
  if (y > doc.page.height - 100) newPage();
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a6b3a').text('Production', doc.page.margins.left, y);
  y += 16;
  const prodCols = [
    { label: '#',              width: 30 },
    { label: 'Batch',          width: 120 },
    { label: 'Paddy In (kg)',  width: 120, align: 'right' },
    { label: 'Rice Out (kg)',  width: 120, align: 'right' },
    { label: 'Bran (kg)',      width: 100, align: 'right' },
    { label: 'Status',         width: 100 },
  ];
  y = tableHeader(doc, y, prodCols);
  data.production.items.forEach((b, i) => {
    if (y > doc.page.height - 80) newPage();
    y = tableRow(doc, y, prodCols, [i + 1, b.batch_number, fmt(b.paddy_quantity), fmt(b.rice_output ?? 0), fmt(b.bran_output ?? 0), b.status], i % 2 === 1);
  });
  y = totalRow(doc, y + 4, 'Total Paddy Processed', data.production.total);

  // ── Expenses ───────────────────────────────────────────────────────────────
  y += 14;
  if (y > doc.page.height - 100) newPage();
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a6b3a').text('Expenses', doc.page.margins.left, y);
  y += 16;
  const expCols = [
    { label: '#',            width: 30 },
    { label: 'Category',     width: 150 },
    { label: 'Description',  width: 200 },
    { label: 'Amount (BDT)', width: 110, align: 'right' },
  ];
  y = tableHeader(doc, y, expCols);
  data.expenses.items.forEach((e, i) => {
    if (y > doc.page.height - 80) newPage();
    y = tableRow(doc, y, expCols, [i + 1, e.category, e.description ?? '-', fmt(e.amount)], i % 2 === 1);
  });
  y = totalRow(doc, y + 4, 'Total Expenses', data.expenses.total);

  pageFooter(doc, pageNum);
  return finalize();
}

module.exports = { generateDailyReportPDF };
