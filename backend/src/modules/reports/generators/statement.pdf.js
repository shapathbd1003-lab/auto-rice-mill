const { createDoc, pageHeader, tableHeader, tableRow, totalRow, pageFooter, BRAND_COLOR } = require('./pdfHelper');

const fmt = (n) => Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2 });

/**
 * Generates a ledger-style statement for a customer or supplier.
 * @param {object} params
 * @param {string} params.type           - 'customer' | 'supplier'
 * @param {object} params.party          - { name, phone, address, balance }
 * @param {Array}  params.transactions   - array of ledger rows
 * @param {string} params.startDate
 * @param {string} params.endDate
 * @param {string} millName
 */
async function generateStatementPDF({ type, party, transactions, startDate, endDate }, millName = 'Auto Rice Mill') {
  const { doc, finalize } = createDoc();
  const left  = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  let pageNum = 1;

  let y = pageHeader(doc, millName,
    `${type === 'customer' ? 'Customer' : 'Supplier'} Statement`,
    `${startDate} → ${endDate}`
  );
  y += 10;

  // Party info
  doc.rect(left, y, right - left, 44).stroke('#dddddd');
  doc.fontSize(9).font('Helvetica-Bold').fillColor(BRAND_COLOR).text(party.name, left + 8, y + 6);
  doc.font('Helvetica').fillColor('#212121').fontSize(8)
     .text(party.phone  ?? '',   left + 8, y + 18)
     .text(party.address ?? '',  left + 8, y + 29, { width: (right - left) / 2 });

  const balColor = Number(party.balance) > 0 ? '#c62828' : '#2e7d32';
  doc.font('Helvetica-Bold').fontSize(11).fillColor(balColor)
     .text(`Balance: BDT ${fmt(party.balance)}`, right - 180, y + 16, { width: 172, align: 'right' });
  y += 56;

  // Transactions table
  const cols = [
    { label: 'Date',        width: 80 },
    { label: 'Reference',   width: 110 },
    { label: 'Description', width: 180 },
    { label: 'Debit',       width: 80,  align: 'right' },
    { label: 'Credit',      width: 80,  align: 'right' },
    { label: 'Balance',     width: 90,  align: 'right' },
  ];

  y = tableHeader(doc, y, cols);

  let runningBalance = 0;
  transactions.forEach((tx, i) => {
    if (y > doc.page.height - 80) {
      pageFooter(doc, pageNum++);
      doc.addPage();
      y = pageHeader(doc, millName, `${type === 'customer' ? 'Customer' : 'Supplier'} Statement (cont.)`, `${startDate} → ${endDate}`);
      y += 8;
      y = tableHeader(doc, y, cols);
    }
    runningBalance += Number(tx.debit || 0) - Number(tx.credit || 0);
    y = tableRow(doc, y, cols,
      [tx.date, tx.reference ?? '-', tx.description ?? '-', tx.debit ? fmt(tx.debit) : '', tx.credit ? fmt(tx.credit) : '', fmt(runningBalance)],
      i % 2 === 1
    );
  });

  y = totalRow(doc, y + 4, 'Closing Balance', party.balance);

  pageFooter(doc, pageNum);
  return finalize();
}

module.exports = { generateStatementPDF };
