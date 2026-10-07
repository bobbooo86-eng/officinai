-- ============================================
-- OfficinAI - Migrazione 033
-- Ricambi comprati mentre l'auto e' ancora in lavorazione, prima della
-- consegna finale: stesso pattern degli acconti (migrazione 032), ma per
-- una spesa invece che un incasso. Un array jsonb di { data_acquisto,
-- importo, descrizione, movimento_id }, non una tabella a parte.
--
-- Idempotente: sicura da eseguire piu' volte.
-- ============================================

ALTER TABLE appuntamenti ADD COLUMN IF NOT EXISTS ricambi_acquistati jsonb DEFAULT '[]';

NOTIFY pgrst, 'reload schema';
