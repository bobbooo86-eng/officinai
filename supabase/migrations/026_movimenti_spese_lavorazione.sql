-- Spese sostenute dall'officina per eseguire la lavorazione, separate
-- dall'importo pagato al collaboratore esterno (Gianni per le revisioni,
-- Daniele per le centraline). Campo facoltativo, mostrato solo per quei
-- due tipi di movimento.
ALTER TABLE movimenti ADD COLUMN IF NOT EXISTS spese_lavorazione numeric(10,2);

NOTIFY pgrst, 'reload schema';
