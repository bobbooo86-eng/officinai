-- ============================================
-- OfficinAI - Migrazione 036
-- Ripensamento della migrazione 035: niente campo "costo ricambi" separato
-- su Revisione (Gianni) / Centraline (Daniele) — resta solo "spese
-- lavorazione", con lo stesso quadratino "conta come spesa" del costo
-- ricambi su una consegna auto, applicato pero' direttamente a questo
-- numero (spese_lavorazione_conta, default true per non cambiare il
-- comportamento di tutte le righe gia' salvate finora).
--
-- Idempotente: sicura da eseguire piu' volte.
-- ============================================

ALTER TABLE movimenti DROP COLUMN IF EXISTS costo_ricambi;
ALTER TABLE movimenti ADD COLUMN IF NOT EXISTS spese_lavorazione_conta boolean NOT NULL DEFAULT true;

NOTIFY pgrst, 'reload schema';
