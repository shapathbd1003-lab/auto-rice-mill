# Deployment Guide — Auto Rice Mill Management System

## Prerequisites
- Docker + Docker Compose (recommended)
- OR: Node.js 18+, PostgreSQL 14+

---

## Option 1: Docker Deployment (Recommended)

### 1. Clone / copy project to server

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env — set DB_PASSWORD, JWT_SECRET, Firebase credentials
```

### 3. Start all services
```bash
cd docker
docker-compose up -d
```

### 4. Verify
- Web App: http://your-server-ip
- API Health: http://your-server-ip:3001/health
- Default login: admin@ricemill.com / Admin@1234 / Mill ID: 1

### 5. SSL (Production)
- Place SSL certificates in `/etc/ssl/` and update nginx.conf
- Or use Certbot with nginx for free Let's Encrypt

---

## Option 2: Manual Deployment

### Backend (Node.js)
```bash
cd backend
cp .env.example .env   # fill in values
npm install
node server.js
# OR with PM2:
npm install -g pm2
pm2 start server.js --name rice-mill-api
pm2 save && pm2 startup
```

### Database
```bash
# Create PostgreSQL database
psql -U postgres -c "CREATE USER ricemill WITH PASSWORD 'yourpassword';"
psql -U postgres -c "CREATE DATABASE rice_mill OWNER ricemill;"
# Run migration
psql -U ricemill -d rice_mill -f backend/migrations/001_init.sql
```

### Web Frontend
```bash
cd web
npm install
npm run build
# Serve dist/ with nginx or Apache
# Point /api requests to backend port 3001
```

---

## Desktop App (Windows)

### Build installer
```bash
cd desktop
npm install
npm run dist
# Output: desktop/dist/Auto Rice Mill Setup.exe
```

### Configure server URL
1. Open desktop app
2. Go to Settings
3. Enter server URL: http://your-server-ip
4. Login with your credentials

---

## Default Admin Credentials
```
Email:    admin@ricemill.com
Password: Admin@1234
Mill ID:  1
```
**⚠️ Change password immediately after first login!**

---

## Backup Strategy
- PostgreSQL: `pg_dump -U ricemill rice_mill > backup.sql`
- Desktop SQLite: automatic daily backup in `%APPDATA%\rice-mill-desktop\backups\`
- Firebase Storage: managed by Google

---

## Environment Variables Reference

| Variable | Description | Required |
|---|---|---|
| DATABASE_URL | PostgreSQL connection string | Yes |
| JWT_SECRET | 64+ char random secret | Yes |
| PORT | API port (default 3001) | No |
| FIREBASE_PROJECT_ID | Firebase project ID | For file uploads |
| FIREBASE_CLIENT_EMAIL | Firebase service account email | For file uploads |
| FIREBASE_PRIVATE_KEY | Firebase private key | For file uploads |
| FIREBASE_STORAGE_BUCKET | Firebase storage bucket | For file uploads |
