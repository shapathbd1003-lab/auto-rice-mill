const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');

// Route imports
const authRoutes         = require('./modules/auth/auth.routes');
const dashboardRoutes    = require('./modules/dashboard/dashboard.routes');
const customerRoutes     = require('./modules/customers/customers.routes');
const supplierRoutes     = require('./modules/suppliers/suppliers.routes');
const purchaseRoutes     = require('./modules/purchases/purchases.routes');
const productionRoutes   = require('./modules/production/production.routes');
const inventoryRoutes    = require('./modules/inventory/inventory.routes');
const salesRoutes        = require('./modules/sales/sales.routes');
const accountingRoutes   = require('./modules/accounting/accounting.routes');
const employeeRoutes     = require('./modules/employees/employees.routes');
const vehicleRoutes      = require('./modules/vehicles/vehicles.routes');
const reportRoutes       = require('./modules/reports/reports.routes');
const notificationRoutes = require('./modules/notifications/notifications.routes');
const syncRoutes         = require('./modules/sync/sync.routes');
const khataRoutes        = require('./modules/khata/khata.routes');
const cashbookRoutes     = require('./modules/khata/cashbook.routes');

const app = express();

// Trust Railway/Render proxy
app.set('trust proxy', 1);

// Security
app.use(helmet());
const allowedOrigins = process.env.ALLOWED_ORIGINS || '*';
app.use(cors({
  origin: allowedOrigins === '*' ? '*' : allowedOrigins.split(','),
  credentials: allowedOrigins !== '*',
}));

// Rate limiting
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 300 }));

// Parsing & logging
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// API routes
app.use('/api/auth',          authRoutes);
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/customers',     customerRoutes);
app.use('/api/suppliers',     supplierRoutes);
app.use('/api/purchases',     purchaseRoutes);
app.use('/api/production',    productionRoutes);
app.use('/api/inventory',     inventoryRoutes);
app.use('/api/sales',         salesRoutes);
app.use('/api/accounting',    accountingRoutes);
app.use('/api/employees',     employeeRoutes);
app.use('/api/vehicles',      vehicleRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/sync',          syncRoutes);
app.use('/api/khata',         khataRoutes);
app.use('/api/khata/cashbook', cashbookRoutes);

// 404
app.use((_req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }));

// Global error handler
app.use(errorHandler);

module.exports = app;
