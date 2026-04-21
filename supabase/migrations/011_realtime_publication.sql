-- ============================================
-- OfficinAI - Migrazione 011
-- Garantisce che le tabelle a cui si abbonano web/mobile
-- siano nella publication `supabase_realtime`.
--
-- Fino a 010 solo `notifiche` e `scansioni_obd` erano aggiunte
-- esplicitamente; `appuntamenti`, `preventivi` e `messaggi`
-- venivano abilitate solo manualmente via dashboard.
-- Su ambienti ricreati da zero la chat e gli aggiornamenti live
-- risultavano silenziosamente muti.
-- ============================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['appuntamenti', 'preventivi', 'messaggi']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;
