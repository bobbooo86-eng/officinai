-- ============================================
-- OfficinAI - Migrazione 010
-- Notifiche realtime per CLIENTI (bidirezionale)
--
-- Fino ad ora notifiche era staff-only:
--   - utente_id NOT NULL → solo staff officina
--   - triggers inserivano solo per utenti (cliente non veniva mai notificato)
--   - RLS permetteva SELECT/UPDATE solo a utenti
--
-- Questa migrazione:
--   1. Aggiunge colonna cliente_id (nullable)
--   2. Rende utente_id nullable (almeno uno dei due deve essere valorizzato)
--   3. Aggiunge RLS per clienti
--   4. Crea trigger che notificano il CLIENTE quando:
--      - staff cambia stato appuntamento (conferma / in_lavorazione /
--        attesa_ricambi / pronto / consegnato)
--      - staff crea/aggiorna un preventivo ("inviato" al cliente)
-- ============================================

-- -----------------------------------------------------
-- 1. Schema: aggiungi cliente_id, rendi utente_id nullable
-- -----------------------------------------------------
ALTER TABLE notifiche
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clienti(id) ON DELETE CASCADE;

ALTER TABLE notifiche
  ALTER COLUMN utente_id DROP NOT NULL;

-- Almeno uno dei due destinatari deve essere valorizzato
ALTER TABLE notifiche
  DROP CONSTRAINT IF EXISTS notifiche_destinatario_check;
ALTER TABLE notifiche
  ADD CONSTRAINT notifiche_destinatario_check
  CHECK (utente_id IS NOT NULL OR cliente_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_notifiche_cliente_id ON notifiche(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notifiche_cliente_letto ON notifiche(cliente_id, letto);

-- -----------------------------------------------------
-- 2. RLS: clienti possono leggere/aggiornare le proprie notifiche
-- -----------------------------------------------------
DROP POLICY IF EXISTS notifiche_cliente_select ON notifiche;
CREATE POLICY notifiche_cliente_select ON notifiche FOR SELECT TO authenticated
  USING (cliente_id IN (
    SELECT id FROM clienti WHERE email = auth.jwt()->>'email'
  ));

DROP POLICY IF EXISTS notifiche_cliente_update ON notifiche;
CREATE POLICY notifiche_cliente_update ON notifiche FOR UPDATE TO authenticated
  USING (cliente_id IN (
    SELECT id FROM clienti WHERE email = auth.jwt()->>'email'
  ));

-- -----------------------------------------------------
-- 3. Trigger: cambio stato appuntamento → notifica il CLIENTE
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION notify_cliente_stato_change()
RETURNS trigger AS $$
DECLARE
  veicolo_info TEXT;
  titolo_msg   TEXT;
  body_msg     TEXT;
BEGIN
  -- Solo se lo stato è cambiato
  IF OLD.stato IS NOT DISTINCT FROM NEW.stato THEN
    RETURN NEW;
  END IF;

  -- Notifica il cliente solo per transizioni guidate dallo staff
  IF NEW.stato NOT IN ('confermato', 'in_lavorazione', 'attesa_ricambi', 'pronto', 'consegnato') THEN
    RETURN NEW;
  END IF;

  IF NEW.cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT marca || ' ' || modello INTO veicolo_info
  FROM veicoli WHERE id = NEW.veicolo_id;

  titolo_msg := CASE NEW.stato
    WHEN 'confermato'      THEN 'Appuntamento confermato'
    WHEN 'in_lavorazione'  THEN 'Lavorazione iniziata'
    WHEN 'attesa_ricambi'  THEN 'In attesa ricambi'
    WHEN 'pronto'          THEN 'Il tuo veicolo è pronto'
    WHEN 'consegnato'      THEN 'Veicolo consegnato'
    ELSE 'Aggiornamento appuntamento'
  END;

  body_msg := COALESCE(veicolo_info, 'Il tuo veicolo') ||
    CASE NEW.stato
      WHEN 'confermato'      THEN ' — l''officina ha confermato la richiesta'
      WHEN 'in_lavorazione'  THEN ' — è ora in lavorazione'
      WHEN 'attesa_ricambi'  THEN ' — in attesa di ricambi'
      WHEN 'pronto'          THEN ' — puoi passare a ritirarlo'
      WHEN 'consegnato'      THEN ' — grazie per aver scelto la nostra officina'
      ELSE ''
    END;

  INSERT INTO notifiche (officina_id, cliente_id, tipo, titolo, messaggio, link_tipo, link_id)
  VALUES (NEW.officina_id, NEW.cliente_id, 'appuntamento', titolo_msg, body_msg, 'appuntamento', NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cliente_stato_change ON appuntamenti;
CREATE TRIGGER trg_cliente_stato_change
  AFTER UPDATE OF stato ON appuntamenti
  FOR EACH ROW
  EXECUTE FUNCTION notify_cliente_stato_change();

-- -----------------------------------------------------
-- 4. Trigger: nuovo preventivo → notifica il CLIENTE
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION notify_cliente_new_preventivo()
RETURNS trigger AS $$
DECLARE
  cliente_dest uuid;
  officina_dest uuid;
  totale_fmt   TEXT;
BEGIN
  SELECT cliente_id, officina_id INTO cliente_dest, officina_dest
  FROM appuntamenti WHERE id = NEW.appuntamento_id;

  IF cliente_dest IS NULL THEN
    RETURN NEW;
  END IF;

  totale_fmt := CASE
    WHEN NEW.totale IS NOT NULL THEN ' — Totale: € ' || ROUND(NEW.totale::numeric, 2)::text
    ELSE ''
  END;

  INSERT INTO notifiche (officina_id, cliente_id, tipo, titolo, messaggio, link_tipo, link_id)
  VALUES (
    officina_dest,
    cliente_dest,
    'preventivo',
    'Nuovo preventivo disponibile',
    'L''officina ha preparato un preventivo per il tuo intervento' || totale_fmt,
    'preventivo',
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_cliente_new_preventivo ON preventivi;
CREATE TRIGGER trg_cliente_new_preventivo
  AFTER INSERT ON preventivi
  FOR EACH ROW
  EXECUTE FUNCTION notify_cliente_new_preventivo();

-- -----------------------------------------------------
-- 5. Trigger: nuovo messaggio chat dallo staff → notifica il CLIENTE
--    (e viceversa: messaggio dal cliente → notifica lo staff)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION notify_new_chat_message()
RETURNS trigger AS $$
DECLARE
  appt_cliente_id  uuid;
  appt_officina_id uuid;
  is_from_cliente  boolean;
  r RECORD;
BEGIN
  SELECT cliente_id, officina_id INTO appt_cliente_id, appt_officina_id
  FROM appuntamenti WHERE id = NEW.appuntamento_id;

  IF appt_officina_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determina mittente: preferisci mittente_tipo, fallback su campo "da"
  is_from_cliente := COALESCE(NEW.mittente_tipo = 'cliente', LOWER(NEW.da) = 'cliente');

  IF is_from_cliente THEN
    -- Mittente cliente → notifica tutto lo staff
    FOR r IN SELECT id FROM utenti WHERE officina_id = appt_officina_id
    LOOP
      INSERT INTO notifiche (officina_id, utente_id, tipo, titolo, messaggio, link_tipo, link_id)
      VALUES (
        appt_officina_id, r.id, 'chat',
        'Nuovo messaggio dal cliente',
        COALESCE(LEFT(NEW.testo, 120), ''),
        'appuntamento', NEW.appuntamento_id
      );
    END LOOP;
  ELSIF appt_cliente_id IS NOT NULL THEN
    -- Mittente staff → notifica il cliente
    INSERT INTO notifiche (officina_id, cliente_id, tipo, titolo, messaggio, link_tipo, link_id)
    VALUES (
      appt_officina_id, appt_cliente_id, 'chat',
      'Nuovo messaggio dall''officina',
      COALESCE(LEFT(NEW.testo, 120), ''),
      'appuntamento', NEW.appuntamento_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_new_chat_message ON messaggi;
CREATE TRIGGER trg_new_chat_message
  AFTER INSERT ON messaggi
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_chat_message();
