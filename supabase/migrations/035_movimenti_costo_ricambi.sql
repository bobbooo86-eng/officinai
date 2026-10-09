-- ============================================
-- OfficinAI - Migrazione 035
-- Costo ricambi complessivo su Revisione (Gianni) / Centraline (Daniele),
-- con lo stesso quadratino "conta come spesa" gia' usato sul costo ricambi
-- di una consegna auto: finche' non lo spunti resta solo informativo, non
-- un costo per l'officina.
--
-- Idempotente: sicura da eseguire piu' volte.
-- ============================================

ALTER TABLE movimenti ADD COLUMN IF NOT EXISTS costo_ricambi numeric(10,2);
ALTER TABLE movimenti ADD COLUMN IF NOT EXISTS ricambi_pagati_subito boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
