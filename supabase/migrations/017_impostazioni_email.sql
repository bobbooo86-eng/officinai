-- ============================================
-- OfficinAI - Migrazione 017
--
-- Unica lacuna reale rimasta dopo aver ispezionato lo schema effettivo
-- del database di produzione (vedi commit precedenti): la tabella
-- impostazioni_email, usata da EmailSettings.tsx, non esiste.
--
-- Le migrazioni 014 e 015 sono state ritirate dal ciclo di applicazione:
-- si basavano sullo schema descritto in 001_rls_policies.sql, che non
-- corrisponde affatto al database reale (RLS disattivata su tutte le
-- tabelle principali, nessuna delle funzioni/trigger che presumevano,
-- nessun vincolo sullo stato appuntamento). Non c'e' nulla, in quei due
-- file, che si applichi correttamente a questo database.
-- ============================================

CREATE TABLE IF NOT EXISTS impostazioni_email (
  officina_id  uuid PRIMARY KEY REFERENCES officine(id) ON DELETE CASCADE,
  impostazioni jsonb NOT NULL DEFAULT '{}',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- La sicurezza sulle altre tabelle applicative e' disattivata in questo
-- database: per coerenza con quello schema, niente RLS neanche qui.

NOTIFY pgrst, 'reload schema';
