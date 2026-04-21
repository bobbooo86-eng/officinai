-- ============================================================================
-- OfficinAI — script consolidato migration 010 + 011 + 012
--
-- Copia-incolla TUTTO questo file nel SQL Editor di Supabase e premi Run.
-- Lo script e' idempotente: puoi eseguirlo piu' volte senza danni.
--
-- Cosa fa:
--   010 - estende `notifiche` al cliente + trigger per chat/stato + RLS cliente
--   011 - aggiunge appuntamenti/preventivi/messaggi alla publication realtime
--   012 - colonne data_proposta/nota_officina, enum 'consegnato', foto realtime
-- ============================================================================


-- ============================================================================
-- MIGRATION 010 — notifiche estese al cliente
-- ============================================================================

-- Schema: utente_id nullable, nuova cliente_id
ALTER TABLE notifiche ALTER COLUMN utente_id DROP NOT NULL;

ALTER TABLE notifiche
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clienti(id) ON DELETE CASCADE;

ALTER TABLE notifiche DROP CONSTRAINT IF EXISTS notifiche_destinatario_chk;
ALTER TABLE notifiche
  ADD CONSTRAINT notifiche_destinatario_chk
  CHECK (
    (utente_id IS NOT NULL AND cliente_id IS NULL) OR
    (utente_id IS NULL AND cliente_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_notifiche_cliente_id      ON notifiche(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notifiche_cliente_letto   ON notifiche(cliente_id, letto);


-- Trigger: cambio stato → notifica anche il cliente
CREATE OR REPLACE FUNCTION notify_stato_change()
RETURNS trigger AS $$
DECLARE
  r RECORD;
  cliente_nome TEXT;
  veicolo_info TEXT;
  titolo_cliente TEXT;
  messaggio_cliente TEXT;
BEGIN
  IF OLD.stato = NEW.stato THEN
    RETURN NEW;
  END IF;

  IF NEW.stato NOT IN ('pronto', 'in_lavorazione', 'attesa_ricambi', 'consegnato') THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO cliente_nome FROM clienti WHERE id = NEW.cliente_id;
  SELECT marca || ' ' || modello INTO veicolo_info FROM veicoli WHERE id = NEW.veicolo_id;

  FOR r IN SELECT id FROM utenti WHERE officina_id = NEW.officina_id
  LOOP
    INSERT INTO notifiche (officina_id, utente_id, tipo, titolo, messaggio, link_tipo, link_id)
    VALUES (
      NEW.officina_id, r.id, 'appuntamento',
      CASE NEW.stato
        WHEN 'pronto' THEN 'Veicolo pronto per la consegna'
        WHEN 'in_lavorazione' THEN 'Lavorazione iniziata'
        WHEN 'attesa_ricambi' THEN 'In attesa ricambi'
        WHEN 'consegnato' THEN 'Veicolo consegnato'
        ELSE 'Stato aggiornato'
      END,
      COALESCE(veicolo_info, 'Veicolo') || ' di ' || COALESCE(cliente_nome, 'cliente') ||
        ' — stato: ' || NEW.stato,
      'appuntamento', NEW.id
    );
  END LOOP;

  IF NEW.cliente_id IS NOT NULL THEN
    titolo_cliente := CASE NEW.stato
      WHEN 'pronto'          THEN 'Il tuo veicolo è pronto'
      WHEN 'in_lavorazione'  THEN 'Lavorazione iniziata'
      WHEN 'attesa_ricambi'  THEN 'In attesa ricambi'
      WHEN 'consegnato'      THEN 'Veicolo consegnato'
      ELSE 'Aggiornamento appuntamento'
    END;

    messaggio_cliente := CASE NEW.stato
      WHEN 'pronto'          THEN 'Il tuo ' || COALESCE(veicolo_info, 'veicolo') || ' è pronto per il ritiro.'
      WHEN 'in_lavorazione'  THEN 'Abbiamo iniziato a lavorare sul tuo ' || COALESCE(veicolo_info, 'veicolo') || '.'
      WHEN 'attesa_ricambi'  THEN 'Siamo in attesa dei ricambi per il tuo ' || COALESCE(veicolo_info, 'veicolo') || '.'
      WHEN 'consegnato'      THEN 'Il tuo ' || COALESCE(veicolo_info, 'veicolo') || ' è stato consegnato. Grazie!'
      ELSE COALESCE(veicolo_info, 'Veicolo') || ' — nuovo stato: ' || NEW.stato
    END;

    INSERT INTO notifiche (officina_id, cliente_id, tipo, titolo, messaggio, link_tipo, link_id)
    VALUES (NEW.officina_id, NEW.cliente_id, 'appuntamento', titolo_cliente, messaggio_cliente,
            'appuntamento', NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Trigger: nuovo messaggio chat → notifica controparte
CREATE OR REPLACE FUNCTION notify_new_messaggio()
RETURNS trigger AS $$
DECLARE
  app_officina uuid;
  app_cliente  uuid;
  r RECORD;
  mittente_e_staff boolean;
  mittente_e_cliente boolean;
  preview TEXT;
BEGIN
  SELECT officina_id, cliente_id INTO app_officina, app_cliente
  FROM appuntamenti WHERE id = NEW.appuntamento_id;

  IF app_officina IS NULL THEN RETURN NEW; END IF;
  preview := LEFT(COALESCE(NEW.testo, ''), 120);

  mittente_e_staff := EXISTS (
    SELECT 1 FROM utenti
    WHERE auth_id = auth.uid() AND officina_id = app_officina
  );
  mittente_e_cliente := EXISTS (
    SELECT 1 FROM clienti
    WHERE auth_id = auth.uid() AND id = app_cliente
  );

  IF mittente_e_cliente THEN
    FOR r IN SELECT id FROM utenti WHERE officina_id = app_officina
    LOOP
      INSERT INTO notifiche (officina_id, utente_id, tipo, titolo, messaggio, link_tipo, link_id)
      VALUES (app_officina, r.id, 'messaggio',
              'Nuovo messaggio dal cliente', preview,
              'appuntamento', NEW.appuntamento_id);
    END LOOP;
  ELSIF mittente_e_staff AND app_cliente IS NOT NULL THEN
    INSERT INTO notifiche (officina_id, cliente_id, tipo, titolo, messaggio, link_tipo, link_id)
    VALUES (app_officina, app_cliente, 'messaggio',
            'Nuovo messaggio dall''officina', preview,
            'appuntamento', NEW.appuntamento_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_new_messaggio ON messaggi;
CREATE TRIGGER trg_new_messaggio
  AFTER INSERT ON messaggi
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_messaggio();


-- RLS cliente sulle proprie notifiche
DROP POLICY IF EXISTS notifiche_cliente_select ON notifiche;
CREATE POLICY notifiche_cliente_select ON notifiche
  FOR SELECT TO authenticated
  USING (cliente_id = get_client_id());

DROP POLICY IF EXISTS notifiche_cliente_update ON notifiche;
CREATE POLICY notifiche_cliente_update ON notifiche
  FOR UPDATE TO authenticated
  USING (cliente_id = get_client_id())
  WITH CHECK (cliente_id = get_client_id());


-- ============================================================================
-- MIGRATION 011 — realtime publication per appuntamenti/preventivi/messaggi
-- ============================================================================

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


-- ============================================================================
-- MIGRATION 012 — schema gaps (data_proposta, consegnato, foto realtime)
-- ============================================================================

ALTER TABLE appuntamenti
  ADD COLUMN IF NOT EXISTS data_proposta timestamptz,
  ADD COLUMN IF NOT EXISTS nota_officina text;

-- ALTER TYPE ... ADD VALUE deve girare fuori transazione in alcuni client.
-- SQL editor Supabase lo accetta in uno script; in caso di errore
-- "ALTER TYPE ... cannot run inside a transaction block", esegui solo
-- questa riga in una singola query.
ALTER TYPE stato_appuntamento ADD VALUE IF NOT EXISTS 'consegnato' AFTER 'pronto';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'foto'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE foto;
  END IF;
END $$;
