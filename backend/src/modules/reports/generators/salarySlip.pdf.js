const { createDoc, pageHeader, tableRow, pageFooter, mmToPt, BRAND_COLOR } = require('./pdfHelper');

const fmt = (n) => Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2 });

async function generateSalarySlipPDF(salary, millName = 'Auto Rice Mill') {
  const { doc, finalize } = createDoc();
  const left  = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  let y = pageHeader(doc, millName, 'SALARY SLIP', `Month: ${salary.month}`);
  y += 12;

  // Employee info box
  doc.rect(left, y, right - left, 64).stroke('#dddddd');
  doc.fontSize(9).font('Helvetica-Bold').fillColor(BRAND_COLOR)
     .text('Employee Details', left + 8, y + 6);
  doc.font('Helvetica').fillColor('#212121').fontSize(9);
  const mid = left + (right - left) / 2;
  [
    ['Name',        salary.employee_name,  'Employee ID',   salary.employee_code],
    ['Designation', salary.designation,    'Department',    salary.department ?? '-'],
    ['Join Date',   salary.join_date ?? '-','Phone',        salary.phone ?? '-'],
  ].forEach(([l1, v1, l2, v2], i) => {
    const rowY = y + 18 + i * 14;
    doc.font('Helvetica-Bold').text(l1 + ':', left + 8,  rowY);
    doc.font('Helvetica').text(v1,            left + 80, rowY);
    doc.font('Helvetica-Bold').text(l2 + ':', mid,       rowY);
    doc.font('Helvetica').text(v2,            mid + 80,  rowY);
  });
  y += 76;

  // Earnings / Deductions side-by-side
  const colW = (right - left - 8) / 2;

  const boxLeft  = left;
  const boxRight = left + colW + 8;

  const sectionHeader = (x, bY, title, color = '#e8f5e9') => {
    doc.rect(x, bY, colW, 18).fill(color);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND_COLOR).text(title, x + 6, bY + 5);
    doc.fillColor('#212121');
    return bY + 18;
  };

  const itemRow = (x, bY, label, value) => {
    doc.font('Helvetica').fontSize(8).fillColor('#212121')
       .text(label, x + 6, bY + 3, { width: colW - 80 })
       .text(`BDT ${fmt(value)}`, x + 6, bY + 3, { width: colW - 10, align: 'right' });
    doc.moveTo(x, bY + 16).lineTo(x + colW, bY + 16).stroke('#eeeeee');
    return bY + 16;
  };

  let lY = sectionHeader(boxLeft, y, 'EARNINGS');
  lY = itemRow(boxLeft, lY, 'Basic Salary',  salary.basic_salary);
  lY = itemRow(boxLeft, lY, 'House Rent',    salary.house_rent ?? 0);
  lY = itemRow(boxLeft, lY, 'Medical',       salary.medical_allowance ?? 0);
  lY = itemRow(boxLeft, lY, 'Transport',     salary.transport_allowance ?? 0);
  lY = itemRow(boxLeft, lY, 'Bonus',         salary.bonus ?? 0);
  lY = itemRow(boxLeft, lY, 'Overtime',      salary.overtime_amount ?? 0);

  let rY = sectionHeader(boxRight, y, 'DEDUCTIONS', '#fce4ec');
  rY = itemRow(boxRight, rY, 'Provident Fund', salary.provident_fund ?? 0);
  rY = itemRow(boxRight, rY, 'Tax',            salary.tax_deduction ?? 0);
  rY = itemRow(boxRight, rY, 'Advance',        salary.advance_deduction ?? 0);
  rY = itemRow(boxRight, rY, 'Other',          salary.other_deductions ?? 0);

  const maxY = Math.max(lY, rY) + 4;

  // Totals
  const grossEarnings  = [salary.basic_salary, salary.house_rent, salary.medical_allowance, salary.transport_allowance, salary.bonus, salary.overtime_amount].reduce((s, v) => s + Number(v || 0), 0);
  const totalDeductions = [salary.provident_fund, salary.tax_deduction, salary.advance_deduction, salary.other_deductions].reduce((s, v) => s + Number(v || 0), 0);

  doc.rect(boxLeft,  maxY, colW, 20).fill('#e8f5e9');
  doc.rect(boxRight, maxY, colW, 20).fill('#fce4ec');
  doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND_COLOR)
     .text('Gross Earnings',  boxLeft  + 6, maxY + 6)
     .text(`BDT ${fmt(grossEarnings)}`,  boxLeft  + 6, maxY + 6, { width: colW - 10, align: 'right' });
  doc.fillColor('#c62828')
     .text('Total Deductions', boxRight + 6, maxY + 6)
     .text(`BDT ${fmt(totalDeductions)}`, boxRight + 6, maxY + 6, { width: colW - 10, align: 'right' });

  const netY = maxY + 24;
  doc.rect(left, netY, right - left, 24).fill(BRAND_COLOR);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff')
     .text('NET PAY', left + 8, netY + 7)
     .text(`BDT ${fmt(salary.net_salary ?? (grossEarnings - totalDeductions))}`, left + 8, netY + 7, { width: right - left - 16, align: 'right' });

  // Signature line
  const sigY = netY + 50;
  doc.moveTo(right - 160, sigY).lineTo(right - 10, sigY).stroke('#aaaaaa');
  doc.fontSize(8).font('Helvetica').fillColor('#888888')
     .text('Authorized Signature', right - 160, sigY + 4, { width: 150, align: 'center' });

  pageFooter(doc, 1);
  return finalize();
}

module.exports = { generateSalarySlipPDF };
