-- Esegui questa query nel SQL Editor di Supabase
-- Aggiunge la colonna home_type alla tabella coaches

alter table coaches add column if not exists home_type text default 'turns';

-- Imposta Deborah come vista "phases" (sostituisci con la sua email reale)
-- update coaches set home_type = 'phases' where email = 'email-di-deborah@esempio.com';
