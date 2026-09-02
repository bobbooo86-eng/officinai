-- Tempo stimato di fermo macchina (quanto il cliente deve lasciare
-- l'auto in officina), da indicare nel preventivo e mostrare nel
-- documento inviato al cliente. Testo libero (es. "1 giorno", "2-3 ore").
ALTER TABLE preventivi ADD COLUMN IF NOT EXISTS fermo_macchina text;

NOTIFY pgrst, 'reload schema';
