-- ============================================
-- OfficinAI - Migrazione 029
-- Nuovi tipi movimento "spesa_autoricambi" e "spesa_monti": pagamenti ai
-- due fornitori di ricambi (il ricambista di fiducia e l'autodemolizioni
-- Monti), per tenere il conto di quanto gli si deve ancora. Vanno
-- aggiunti al vincolo CHECK su movimenti.tipo (027, esteso dalla 028),
-- altrimenti salvarli fallisce con "violates check constraint
-- movimenti_tipo_check".
--
-- Idempotente: sicura da eseguire piu' volte.
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
