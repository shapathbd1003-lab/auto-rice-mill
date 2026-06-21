# Mithila Auto Rice Mill — User Manual
# মিথিলা অটো রাইস মিল — ব্যবহারকারী নির্দেশিকা

**Website:** https://auto-rice-mill-production.up.railway.app  
**Version:** 1.0 | June 2026

---

## Login / লগইন

Open the website in any browser.

**Default credentials:**
| Field | Value |
|---|---|
| Email | admin@ricemill.com |
| Password | Admin@1234 |

> **Important:** Change your password after first login via Company Settings → Users.

---

## Language Switch / ভাষা পরিবর্তন

Click **বাংলা | EN** in the top-right corner to switch between Bengali and English.

---

## Navigation / নেভিগেশন

The left sidebar has 4 sections:

| Section | Purpose |
|---|---|
| **Dashboard** | Daily summary overview |
| **Khata Book** | Simple daily bookkeeping |
| **Tally ERP** | Full double-entry accounting |
| **Rice Mill** | Mill operations (purchase, production, sales) |

On mobile, tap the **☰** menu icon (top-left) to open the sidebar.

---

## SECTION 1 — Dashboard / ড্যাশবোর্ড

Shows 6 key numbers at a glance:

| Card | What it shows |
|---|---|
| Today's Sales | Total sales amount for today |
| Today's Purchases | Total paddy purchased today |
| Customer Due | Total money customers owe you |
| Supplier Due | Total money you owe suppliers |
| Cash Balance | Current cash + bank balance |
| Low Stock | Items below reorder level |

**Recent Transactions** — last 10 sales/purchases/cash entries.  
**Quick Actions** — buttons to jump to New Sale, New Purchase, Cash In, Expense, Customer, Supplier.

Click any card to go directly to that section.

---

## SECTION 2 — Khata Book / খাতা বই

Simple bookkeeping like a traditional khata. No accounting knowledge needed.

### 2.1 Customer Khata / কাস্টমার খাতা

Use this to track money customers owe you.

**To add a new customer:**
1. Click **Add Customer**
2. Enter Name, Phone, Address
3. If the customer already owes you money, enter Opening Balance
4. Click **Save**

**To record a sale on credit (Add Due):**
1. Select the customer from the list (left panel)
2. Click **Add Due** (red button)
3. Enter amount, date, note (e.g. "Rice sold on credit")
4. Click **Add Due**

**To record payment received:**
1. Select the customer
2. Click **Receive Payment** (green button)
3. Enter amount received, date, note
4. Click **Receive Payment**

**To send WhatsApp reminder:**
1. Select a customer who has a due
2. Click **WhatsApp** — opens WhatsApp with a pre-written message

**Transaction History** tab — shows all Dr/Cr entries with running balance.

---

### 2.2 Supplier Khata / সাপ্লায়ার খাতা

Use this to track money you owe suppliers (paddy farmers, etc.)

**To add a supplier:**
1. Click **Add Supplier**
2. Enter Name, Phone, Address
3. Click **Save**

**To record a purchase due:**
1. Select the supplier
2. Click **Add Purchase Due** (orange button)
3. Enter amount, date, note
4. Click **Add Due**

**To record payment to supplier:**
1. Select the supplier
2. Click **Pay Supplier** (green button)
3. Enter amount paid, date, note
4. Click **Pay Supplier**

---

### 2.3 Cash Book / নগদ বই

Track all cash coming in and going out.

**To add Cash In:**
1. Click **Cash In** button
2. Select Category (Sales Income / Payment Received / Other Income)
3. Enter Description and Amount
4. Click **Save**

**To add Cash Out:**
1. Click **Cash Out** button
2. Select Category (Paddy Purchase / Salary / Transport / Electricity / Fuel / etc.)
3. Enter Description and Amount
4. Click **Save**

**Summary cards** at the top show total Cash In, Cash Out, and Balance for the selected date.

Use the **Date** filter to view any day. Use **All / In / Out** toggle to filter by type.

To **edit** a transaction: click the pencil icon.  
To **delete**: click the trash icon (will reverse the balance).

---

### 2.4 Expense Book / খরচের বই

Track business expenses separately from cash.

**Daily Expenses tab:**
- Select a date to view expenses for that day
- Click **Add Expense** to record a new expense

**Monthly Expenses tab:**
- Select a month to see all expenses grouped by category
- Color-coded breakdown shows which category spent the most

**Categories:** Labor, Transport, Fuel, Packaging, Electricity, Maintenance, Salary, Other

---

### 2.5 Daily Sales Book / দৈনিক বিক্রয় বই

View all sales for a specific date and create new sales.

**To create a new sale:**
1. Click **New Sale**
2. Select Customer
3. Select Type: Retail or Wholesale
4. Add Products — select item, enter quantity and price
5. Click **+ Add Product** for more items
6. Enter Paid Amount (leave 0 if fully on credit)
7. Click **Save Sale**

The Due amount is calculated automatically.

---

### 2.6 Daily Purchase Book / দৈনিক ক্রয় বই

View all paddy purchases for a specific date and create new purchases.

**To record a paddy purchase:**
1. Click **New Purchase**
2. Select Supplier
3. Enter Gross Weight (with vehicle) and Tare Weight (empty vehicle)
4. Net Weight is calculated automatically
5. Enter Rate per kg
6. Enter Transport Cost if any
7. Enter Paid Now amount
8. Due amount is calculated automatically
9. Click **Save**

---

## SECTION 3 — Tally ERP

Full double-entry accounting system for professional bookkeeping.

### 3.1 Accounts Dashboard / হিসাব

Overview of all ledger groups organized by nature (Assets, Liabilities, Income, Expenses, Capital).

Click any group row to open its Khata ledger and see individual accounts.

---

### 3.2 Ledger Groups / লেজার গ্রুপ

Create any custom Khata group without developer help.

**Built-in groups:**
- Customer Khata, Supplier Khata, Employee Khata, Bank Khata, Loan Khata, Farmer Khata, Dealer Khata, Transport Khata

**To create a custom group:**
1. Click **New Group**
2. Enter Group Name (e.g. "Machine Maintenance Khata")
3. Select Nature: Assets / Liabilities / Income / Expenses
4. Select Group Type (what kind of accounts)
5. Select Parent Group if it belongs under another group
6. Click **Create Group**

After creating, go to the group and add individual ledgers.

---

### 3.3 Chart of Accounts / হিসাবের তালিকা

**Account Tree tab** — shows all groups and ledgers in a hierarchy. Click to expand/collapse.

**Ledger List tab** — flat list of all ledgers with current balances.

**To create a new ledger:**
1. Click **New Ledger** (or **Add Ledger** button next to a group in the tree)
2. Select Ledger Group
3. Enter Name (English and Bengali)
4. Enter Opening Balance if the account has an existing balance
5. Select Dr (Debit) or Cr (Credit) for the opening balance type
6. Click **Save**

**Cannot delete** a ledger that has posted transactions.

---

### 3.4 Universal Khata / যেকোনো খাতা

This works for ANY ledger group — Customer, Supplier, Employee, Bank, or any custom group.

**Left panel:** list of ledgers (accounts) in the group.  
**Right panel:** transaction history + Add Due / Receive Payment buttons.

The button labels adapt automatically:
- Customer group → "Add Due" + "Receive Payment"
- Supplier group → "Add Purchase Due" + "Pay Supplier"
- Employee group → "Add Salary Due" + "Pay Salary"
- Bank group → "Deposit" + "Withdrawal"

On mobile: tap a ledger to see its transactions, tap **Back** to return to the list.

---

### 3.5 Voucher Entry / ভাউচার এন্ট্রি

Full Tally-style double-entry accounting. Every transaction must have equal Debit and Credit.

**8 Voucher Types:**

| Type | Use case |
|---|---|
| Sales Voucher | Record a sale |
| Purchase Voucher | Record a purchase |
| Receipt Voucher | Money received from customer |
| Payment Voucher | Money paid to supplier |
| Journal Voucher | Any accounting adjustment |
| Contra Voucher | Transfer between cash/bank |
| Debit Note | Charge back to supplier |
| Credit Note | Refund to customer |

**To create a voucher:**
1. Select Voucher Type
2. Enter Date and Reference Number
3. Add ledger entries:
   - For each Dr entry: select ledger, choose **Dr (Debit)**, enter amount
   - For each Cr entry: select ledger, choose **Cr (Credit)**, enter amount
4. Total Dr must equal Total Cr — a "Balanced ✓" chip confirms this
5. Enter Narration (description)
6. Select **Post Now** to immediately update ledger balances, or **Save as Draft** to review later
7. Click **Save Voucher**

**Draft vouchers** can be approved later by clicking the ✓ button in the voucher list.

---

### 3.6 Accounting Reports / হিসাব রিপোর্ট

6 report types available:

| Report | What it shows |
|---|---|
| Trial Balance | All ledger Dr/Cr totals (must balance) |
| Profit & Loss | Income vs Expenses for a period |
| Balance Sheet | Assets vs Liabilities as of a date |
| Day Book | All transactions for a single day |
| Cash Flow | Cash in vs cash out for a period |
| General Ledger | All postings for all/selected ledgers |

**To generate a report:**
1. Select the report tab
2. Set the date or date range
3. Click **Generate**
4. Click **Print** to print

---

### 3.7 Banking / ব্যাংকিং

**All Accounts tab** — list of bank accounts with balances. Click a row to view transactions.

**To add a bank account:**
1. Click **Add Bank Account**
2. Enter Bank Name, Account Name, Account Number, Branch
3. Enter Opening Balance
4. Click **Save**

**To record a deposit or withdrawal:**
1. Click the account card to select it
2. Click **Deposit** (money going in) or **Withdrawal** (money going out)
3. Enter Date, Amount, Description
4. Click **Save**

**To transfer between accounts:**
1. Click **Transfer**
2. Select the destination account
3. Enter amount and description

**Cheques tab** — track issued and received cheques.
- **Clear** button: mark a cheque as cleared (paid/received)
- **Bounce** button: mark a cheque as bounced

---

### 3.8 Company Settings / কোম্পানি সেটিংস

**Company Info tab:**
- Update mill name, address, phone, email
- Enter trade license, TIN, BIN numbers
- Configure invoice prefix (default: INV), voucher prefix (default: VCH)

**Users & Roles tab:**
- Add new users (staff members) with different access levels
- Roles: Admin, Manager, Accountant, Store Keeper, Operator, Sales
- Click the edit icon to change a user's role or reset password

**Financial Years tab:**
- View all financial years
- **Activate** — set the current working year
- **Lock** — prevent changes to past year's entries
- **Unlock** — re-open a locked year (admin only)

**Preferences tab:**
- Enable/disable low stock alerts
- Set how many days before due to send alerts
- Change currency symbol

---

## SECTION 4 — Rice Mill Operations

### 4.1 Purchases / ক্রয়

Record paddy bought from suppliers.

**New Purchase:**
1. Select Supplier
2. Enter date and vehicle (optional)
3. Enter Gross Weight and Tare Weight → Net Weight auto-calculated
4. Enter Rate per kg and Transport Cost
5. Enter Paid Amount
6. Optionally select which Paddy Stock item to update
7. Click **Save**

---

### 4.2 Production / উৎপাদন

Track milling sessions.

**New Batch:**
1. Click **New Batch**
2. Select date and paddy quantity
3. Source: From Stock (use existing paddy) or Direct Purchase
4. Click **Create Batch**

**Complete Batch (after milling):**
1. Click the ✓ (green check) on an "In Progress" batch
2. For each output (Rice, Bran, Husk, Broken Rice):
   - Enter quantity produced
   - Select which inventory item to add it to
3. System calculates yield %
4. Click **Complete Batch** → stock is automatically updated

---

### 4.3 Inventory / ইনভেন্টরি

**View current stock levels** — shows all items with stock bar indicators.  
Red = below reorder level (low stock).

**Add new inventory item:**
1. Click **Add Item**
2. Enter Code, Name, Category, Unit
3. Set Reorder Level (minimum stock to trigger alert)
4. Set Sale Price
5. Click **Save**

**Adjust stock manually:**
1. Click the ⚙ (tune) icon on any item
2. Enter positive number to add stock, negative to deduct
3. Enter reason/notes
4. Click **Adjust**

---

### 4.4 Sales / বিক্রয়

**New Sale:**
1. Click **New Sale**
2. Select Customer
3. Select Type: Retail or Wholesale
4. Add items: select product, quantity, price
5. Enter Discount if any
6. Enter Paid Amount
7. Select Cash/Bank account to record payment
8. Click **Save**

---

### 4.5 Accounting / হিসাব

**Accounts tab** — cash and bank account balances.

**Expenses tab** — add business expenses:
1. Click **Add Expense**
2. Select date, category, enter description and amount
3. Select which account to deduct from
4. Click **Save**

**Profit & Loss tab** — auto-calculated based on sales revenue minus purchases and expenses.

---

### 4.6 Employees / কর্মচারী

**Employees tab:**
- View all employees with designation and salary
- Click **Add Employee** to register a new employee

**Attendance tab:**
1. Select a date
2. Mark each employee: Present / Half Day / Absent
3. Use **All Present** / **All Absent** for bulk marking
4. Click **Save Attendance**

**Salary tab:**
1. Select the month
2. Click **Generate Salary** — auto-calculates from attendance
3. Review salary list
4. Click the download icon to print salary slip PDF

---

### 4.7 Vehicles / যানবাহন

Track your vehicles and delivery trips.

**Add Vehicle:**
1. Click **Add Vehicle**
2. Enter Vehicle Number, Type, Driver Name, Driver Phone
3. Click **Save**

Edit any vehicle by clicking the pencil icon.

---

### 4.8 Reports / রিপোর্ট

**Available reports:**
- Daily Report — all transactions for a date
- Customer Due Report — list of all customers with outstanding dues
- Supplier Due Report — list of all suppliers you owe money to
- Inventory Report — current stock levels and values
- Production Report — batch-wise production data
- Salary Report — monthly employee salary summary

**To generate:**
1. Select report type
2. Set date/month/date range
3. Click **Download PDF** or **Export CSV**

---

## Tips & Common Tasks

### How to do daily closing
1. Go to **Cash Book** → verify today's Cash In and Cash Out
2. Go to **Daily Sales Book** → verify all sales are recorded
3. Go to **Expense Book** → add any expenses for today
4. Check **Dashboard** → all numbers should match

### How to create a custom Khata (e.g. "Machine Parts Dealer Khata")
1. Go to **Tally ERP → Ledger Groups**
2. Click **New Group**
3. Name: "Machine Parts Dealer Khata", Nature: Liabilities (they owe you or you owe them)
4. Click **Create Group**
5. Go to **Accounts Dashboard** → find your new group → click it
6. Click **Add Ledger** → add individual dealer accounts

### How to check if accounts are balanced
1. Go to **Tally ERP → Accounting Reports**
2. Select **Trial Balance** tab
3. Click **Generate**
4. Total Dr should equal Total Cr at the bottom

---

## User Roles Summary

| Role | What they can do |
|---|---|
| **Admin** | Everything — settings, users, all modules |
| **Manager** | All modules except user management |
| **Accountant** | Financial modules, vouchers, reports |
| **Store Keeper** | Inventory, production |
| **Operator** | Production only |
| **Sales** | Customers, sales, customer khata |

---

## Support

For any issues or help:
- Email: admin@ricemill.com
- System: https://auto-rice-mill-production.up.railway.app
