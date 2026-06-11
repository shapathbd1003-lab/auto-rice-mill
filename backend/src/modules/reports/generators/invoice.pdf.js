const { createDoc, pageHeader, tableHeader, tableRow, totalRow, pageFooter, mmToPt, BRAND_COLOR } = require('./pdfHelper');

const fmt = (n) => Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2 });

async function generateInvoicePDF(order, millName = 'Auto Rice Mill') {
  const { doc, finalize } = createDoc();

  let y = pageHeader(doc, millName, `INVOICE  #${order.invoice_number}`, `Date: ${order.date}`);
  y += 10;

  // ── Bill To / Bill From ────────────────────────────────────────────────────
  const left  = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const mid   = left + (right - left) / 2 + 20;

  doc.fontSize(9).font('Helvetica-Bold').fillColor(BRAND_COLOR)
     .text('BILL TO', left, y).text('PAYMENT STATUS', mid, y);
  y += 13;
  doc.font('Helvetica').fillColor('#212121').fontSize(9)
     .text(order.customer_name, left, y)
     .text(order.customer_phone ?? '', left, y + 11)
     .text(order.customer_address ?? '', left, y + 22, { width: mid - left - 10 });

  const statusColor = order.payment_status === 'paid' ? '#2e7d32' : order.payment_status === 'partial' ? '#e65100' : '#c62828';
  doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(11)
     .text(String(order.payment_status ?? '').toUpperCase(), mid, y);
  doc.fillColor('#212121').font('Helvetica').fontSize(9)
     .text(`Paid: BDT ${fmt(order.paid_amount)}`, mid, y + 14)
     .text(`Due:  BDT ${fmt((order.total_amount || 0) - (order.paid_amount || 0))}`, mid, y + 26);

  y += 48;

  // ── Items Table ────────────────────────────────────────────────────────────
  const cols = [
    { label: '#',            width: 30 },
    { label: 'Item',         width: 180 },
    { label: 'Unit',         width: 60 },
    { label: 'Qty',          width: 70,  align: 'right' },
    { label: 'Unit Price',   width: 90,  align: 'right' },
    { label: 'Total (BDT)',  width: 110, align: 'right' },
  ];

  y = tableHeader(doc, y, cols);
  (order.items || []).forEach((item, i) => {
    y = tableRow(doc, y, cols,
      [i + 1, item.item_name, item.unit, fmt(item.quantity), fmt(item.unit_price), fmt(item.total_price)],
      i % 2 === 1
    );
  });

  y += 4;
  y = totalRow(doc, y, 'Sub Total', order.sub_total ?? order.total_amount);
  if (Number(order.discount_amount) > 0) y = totalRow(doc, y, 'Discount', order.discount_amount);
  if (Number(order.tax_amount) > 0)      y = totalRow(doc, y, 'VAT/Tax',  order.tax_amount);
  y = totalRow(doc, y, 'GRAND TOTAL', order.total_amount);

  // ── Notes ──────────────────────────────────────────────────────────────────
  if (order.notes) {
    y += 16;
    doc.fontSize(8).font('Helvetica-Bold').text('Notes:', left, y);
    doc.font('Helvetica').text(order.notes, left, y + 11, { width: right - left });
  }

  // ── Signature ──────────────────────────────────────────────────────────────
  const sigY = doc.page.height - doc.page.margins.bottom - 60;
  doc.moveTo(right - 150, sigY).lineTo(right - 10, sigY).stroke('#aaaaaa');
  doc.fontSize(8).font('Helvetica').fillColor('#888888')
     .text('Authorized Signature', right - 150, sigY + 4, { width: 140, align: 'center' });

  pageFooter(doc, 1);
  return finalize();
}

module.exports = { generateInvoicePDF };
