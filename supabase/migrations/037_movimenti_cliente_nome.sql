-- ============================================
-- OfficinAI - Migrazione 037
-- Nome del cliente su Revisione (Gianni) / Centraline (Daniele): la
-- descrizione e' il pezzo (es. "Scatola sterzo"), questo e' di chi e',
-- per ritrovare facilmente le lavorazioni passate di un cliente.
--
-- Idempotente: sicura da eseguire piu' volte.
-- ============================================

ALTER TABLE movimenti ADD COLUMN IF NOT EXISTS cliente_nome text;

NOTIFY pgrst, 'reload schema';
