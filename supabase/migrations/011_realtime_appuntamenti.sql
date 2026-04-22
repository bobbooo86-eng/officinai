-- ============================================
-- OfficinAI - Migrazione 011
-- Abilita Supabase Realtime su appuntamenti e preventivi.
-- Senza questo, le subscription .on('postgres_changes', ...)
-- non emettono eventi quindi cliente e officina non si
-- sincronizzano in tempo reale.
-- ============================================

-- Abilita realtime su appuntamenti (richieste, conferme, cambi stato)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'appuntamenti'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE appuntamenti';
  END IF;
END $$;

-- Abilita realtime su preventivi
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'preventivi'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE preventivi';
  END IF;
END $$;
