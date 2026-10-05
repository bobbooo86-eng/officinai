-- ============================================
-- OfficinAI - Migrazione 032
-- Acconti presi mentre l'auto e' ancora in lavorazione, prima della
-- consegna finale. Oggi "pagamento" si scrive solo alla consegna: un
-- acconto preso un mese prima non restava registrato da nessuna parte
-- sull'appuntamento. Un semplice array jsonb di { data_acconto, importo,
-- movimento_id, nota }, non una tabella a parte.
--
-- Idempotente: sicura da eseguire piu' volte.
-- ============================================

ALTER TABLE appuntamenti ADD COLUMN IF NOT EXISTS acconti jsonb DEFAULT '[]';

NOTIFY pgrst, 'reload schema';
