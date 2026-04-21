-- ============================================
-- OfficinAI - Migrazione 012
-- Schema gaps scoperti durante audit realtime:
--
-- 1) appuntamenti.data_proposta / nota_officina: il codice li usa
--    (accetta/rifiuta proposta date lato cliente, proposta nuova
--    data lato officina) ma non sono mai stati creati da nessuna
--    migration; l'UPDATE falliva silenziosamente.
--
-- 2) Enum stato_appuntamento mancava 'consegnato': il codice web
--    e mobile tenta UPDATE stato='consegnato' (dashboard consegnati,
--    KPI, trigger 010) e PostgreSQL ritorna
--    "invalid input value for enum".
--
-- 3) Tabella foto non in publication supabase_realtime: la
--    PhotoGallery ricaricava solo al mount e il cliente non vedeva
--    foto caricate dall'officina senza refresh manuale.
-- ============================================

-- 1) Colonne mancanti su appuntamenti
ALTER TABLE appuntamenti
  ADD COLUMN IF NOT EXISTS data_proposta timestamptz,
  ADD COLUMN IF NOT EXISTS nota_officina text;


-- 2) Enum stato_appuntamento: aggiunge 'consegnato' se manca.
--    ALTER TYPE ... ADD VALUE IF NOT EXISTS e' idempotente su PG >= 12.
--    Va eseguito fuori da blocchi di transazione impliciti di alcune tool,
--    ma il SQL editor Supabase lo accetta in un solo script.
ALTER TYPE stato_appuntamento ADD VALUE IF NOT EXISTS 'consegnato' AFTER 'pronto';


-- 3) Pubblicazione realtime per foto
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'foto'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE foto;
  END IF;
END $$;
