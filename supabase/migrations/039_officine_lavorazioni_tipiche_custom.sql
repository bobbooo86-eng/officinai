-- ============================================
-- OfficinAI - Migrazione 039
-- Checkbox "Lavorazioni tipiche" personalizzabili dall'officina (es.
-- "Controllo livelli"), in aggiunta a quelle gia' fisse nell'app: ogni
-- officina ha il proprio elenco di voci aggiunte, riusate su ogni scheda
-- di lavoro.
--
-- Idempotente: sicura da eseguire piu' volte.
-- ============================================

ALTER TABLE officine ADD COLUMN IF NOT EXISTS lavorazioni_tipiche_custom jsonb NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
