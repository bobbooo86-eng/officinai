-- ============================================
-- OfficinAI - Migrazione 028
-- Nuovo tipo movimento "spesa_affitto" (spesa fissa per l'affitto
-- dell'officina): va aggiunto al vincolo CHECK su movimenti.tipo (027),
-- altrimenti salvarlo fallisce con "violates check constraint
-- movimenti_tipo_check".
--
-- Idempotente: sicura da eseguire piu' volte.
-- ============================================

ALTER TABLE movimenti DROP CONSTRAINT IF EXISTS movimenti_tipo_check;

ALTER TABLE movimenti ADD CONSTRAINT movimenti_tipo_check CHECK (tipo IN (
  'incasso_extra','spesa_officina','spesa_titolare','spesa_affitto',
  'anticipo_dipendente','spesa_dipendente',
  'spesa_revisione_gianni','spesa_centraline_daniele',
  'costo_lavorazione','spesa_lavorazione'
));

NOTIFY pgrst, 'reload schema';
