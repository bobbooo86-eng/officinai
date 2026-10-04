-- ============================================
-- OfficinAI - Migrazione 027
-- Il vincolo CHECK su movimenti.tipo (creato dalla 013) elenca solo i tipi
-- che esistevano allora: incasso_extra, spesa_officina, spesa_titolare,
-- anticipo_dipendente, spesa_dipendente. Le voci aggiunte dopo (revisione
-- Gianni, centraline Daniele, costo/spese lavorazione) non sono mai state
-- incluse, cosi' salvare quei movimenti fallisce con
-- "violates check constraint movimenti_tipo_check".
--
-- Va ricreato con l'elenco completo di MovimentoTipo (src/types/database.ts).
-- Allineato anche ai tipi aggiunti dopo (028, 029): un elenco piu' corto di
-- quello attuale farebbe fallire questa stessa migrazione se rieseguita
-- dopo che esistono gia' righe con quei tipi (la ricreazione del vincolo
-- verifica tutte le righe esistenti). Idempotente: sicura da eseguire
-- piu' volte, in qualsiasi ordine rispetto alle altre.
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
