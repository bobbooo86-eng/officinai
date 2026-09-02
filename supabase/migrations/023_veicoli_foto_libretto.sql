-- Foto del libretto di circolazione, caricata quando si registra o modifica
-- un veicolo. Riusa lo storage bucket "foto-lavorazione" gia' esistente
-- (path libretto/<veicolo_id>/...), niente bucket nuovo da provisionare.
ALTER TABLE veicoli ADD COLUMN IF NOT EXISTS foto_libretto_url text;

NOTIFY pgrst, 'reload schema';
