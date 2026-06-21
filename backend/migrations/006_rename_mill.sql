-- Migration 006: Rename mill to Mithila Auto Rice Mill
UPDATE mills SET name = 'Mithila Auto Rice Mill', name_bn = 'মিথিলা অটো রাইস মিল', updated_at = NOW() WHERE id = 1;
UPDATE company_settings SET trade_name = 'Mithila Auto Rice Mill', trade_name_bn = 'মিথিলা অটো রাইস মিল', updated_at = NOW() WHERE mill_id = 1;
