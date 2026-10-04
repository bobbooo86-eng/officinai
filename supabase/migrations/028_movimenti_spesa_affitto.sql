-- ============================================
-- OfficinAI - Migrazione 028
-- Nuovo tipo movimento "spesa_affitto" (spesa fissa per l'affitto
-- dell'officina): va aggiunto al vincolo CHECK su movimenti.tipo (027),
-- altrimenti salvarlo fallisce con "violates check constraint
-- movimenti_tipo_check".
--
-- Allineato anche ai tipi aggiunti dopo (029): un elenco piu' corto di
-- quello attuale farebbe fallire questa stessa migrazione se rieseguita
-- dopo che esistono gia' righe con quei tipi. Idempotente: sicura da
-- eseguire piu' volte, in qualsiasi ordine rispetto alle altre.
-- ============================================

ALTER TABLE movimenti DROP CONSTRAINT IF EXISTS movimenti_tipo_check;

ALTER TABLE movimenti ADD CONSTRAINT movimenti_tipo_check CHECK (tipo IN (
  'incasso_extra','spesa_officina','spesa_titolare','spesa_affitto',
  'spesa_autoricambi','spesa_monti',
  'anticipo_dipendente','spesa_dipendente',
  'spesa_revisione_gianni','spesa_centraline_daniele',
  'costo_lavorazione','spesa_lavorazione'
));

NOTIFY pgrst, 'reload schema';
