-- Fix admin password hash for Admin@1234
UPDATE users
SET password_hash = '$2b$10$lFHsBM3Ua2fWCH/Yf7mkvOSAiGR1Bk3ulSDZ3faI2uUFnsBzRMggi'
WHERE email = 'admin@ricemill.com' AND mill_id = 1;
