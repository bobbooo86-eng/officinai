-- ============================================
-- OfficinAI - Migrazione 010
-- Aggiunge la policy RLS che permette al cliente di accettare
-- o rifiutare la controproposta di data dell'officina.
--
-- Senza questa policy l'UPDATE viene silenziosamente bloccato da
-- RLS (0 righe modificate, nessun errore) e i bottoni
-- "Accetto la proposta" / "No, grazie" non hanno effetto.
--
-- Sicurezza:
--   - il cliente puo aggiornare solo i propri appuntamenti
--   - solo quando lo stato corrente e 'richiesta'
--   - il nuovo stato puo essere solo 'richiesta' (rifiuto) o
--     'prenotato' (accettazione), evitando salti di stato
-- ============================================

DROP POLICY IF EXISTS appuntamenti_client_update ON appuntamenti;
CREATE POLICY appuntamenti_client_update ON appuntamenti
  FOR UPDATE
  USING (
    cliente_id = get_client_id()
    AND stato = 'richiesta'
  )
  WITH CHECK (
    cliente_id = get_client_id()
    AND stato IN ('richiesta', 'prenotato')
  );
