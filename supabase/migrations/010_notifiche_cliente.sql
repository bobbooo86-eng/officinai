-- ============================================
-- OfficinAI - Migrazione 010
-- Estende `notifiche` per supportare notifiche verso i clienti
-- (oltre a quelle per lo staff officina gia esistenti).
--
-- Contesto: fino a 009 la tabella notifiche era staff-only.
-- Il cliente mobile non riceveva aggiornamenti live su cambio
-- stato appuntamento, nuovi messaggi, ecc.
-- ============================================

-- --------------------------------------------
-- 1. Schema: utente_id ora nullable, aggiunta cliente_id
-- --------------------------------------------
ALTER TABLE notifiche ALTER COLUMN utente_id DROP NOT NULL;

ALTER TABLE notifiche
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clienti(id) ON DELETE CASCADE;

-- Esattamente uno fra utente_id e cliente_id deve essere valorizzato.
ALTER TABLE notifiche DROP CONSTRAINT IF EXISTS notifiche_destinatario_chk;
ALTER TABLE notifiche
  ADD CONSTRAINT notifiche_destinatario_chk
  CHECK (
    (utente_id IS NOT NULL AND cliente_id IS NULL) OR
    (utente_id IS NULL AND cliente_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_notifiche_cliente_id
  ON notifiche(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notifiche_cliente_letto
  ON notifiche(cliente_id, letto);


-- --------------------------------------------
-- 2. Trigger: cambio stato → notifica anche il cliente
-- --------------------------------------------
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

  -- Staff: una notifica per ogni utente dell'officina (comportamento preesistente)
  FOR r IN SELECT id FROM utenti WHERE officina_id = NEW.officina_id
  LOOP
    INSERT INTO notifiche (officina_id, utente_id, tipo, titolo, messaggio, link_tipo, link_id)
    VALUES (
      NEW.officina_id,
      r.id,
      'appuntamento',
      CASE NEW.stato
        WHEN 'pronto' THEN 'Veicolo pronto per la consegna'
        WHEN 'in_lavorazione' THEN 'Lavorazione iniziata'
        WHEN 'attesa_ricambi' THEN 'In attesa ricambi'
        WHEN 'consegnato' THEN 'Veicolo consegnato'
        ELSE 'Stato aggiornato'
      END,
      COALESCE(veicolo_info, 'Veicolo') || ' di ' || COALESCE(cliente_nome, 'cliente') ||
        ' — stato: ' || NEW.stato,
      'appuntamento',
      NEW.id
    );
  END LOOP;

  -- Cliente: una sola notifica al proprietario dell'appuntamento
  IF NEW.cliente_id IS NOT NULL THEN
    titolo_cliente := CASE NEW.stato
      WHEN 'pronto'          THEN 'Il tuo veicolo è pronto'
      WHEN 'in_lavorazione'  THEN 'Lavorazione iniziata'
      WHEN 'attesa_ricambi'  THEN 'In attesa ricambi'
      WHEN 'consegnato'      THEN 'Veicolo consegnato'
      ELSE 'Aggiornamento appuntamento'
    END;

    messaggio_cliente := CASE NEW.stato
      WHEN 'pronto'
        THEN 'Il tuo ' || COALESCE(veicolo_info, 'veicolo') || ' è pronto per il ritiro.'
      WHEN 'in_lavorazione'
        THEN 'Abbiamo iniziato a lavorare sul tuo ' || COALESCE(veicolo_info, 'veicolo') || '.'
      WHEN 'attesa_ricambi'
        THEN 'Siamo in attesa dei ricambi per il tuo ' || COALESCE(veicolo_info, 'veicolo') || '.'
      WHEN 'consegnato'
        THEN 'Il tuo ' || COALESCE(veicolo_info, 'veicolo') || ' è stato consegnato. Grazie!'
      ELSE COALESCE(veicolo_info, 'Veicolo') || ' — nuovo stato: ' || NEW.stato
    END;

    INSERT INTO notifiche (officina_id, cliente_id, tipo, titolo, messaggio, link_tipo, link_id)
    VALUES (
      NEW.officina_id,
      NEW.cliente_id,
      'appuntamento',
      titolo_cliente,
      messaggio_cliente,
      'appuntamento',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- --------------------------------------------
-- 3. Trigger: nuovo messaggio chat → notifica controparte
-- La chat funziona in realtime, ma senza notifica il destinatario
-- non vede alcun badge quando e' su un'altra schermata.
--
-- Il campo `messaggi.da` e' stato usato in modo inconsistente
-- ('officina' / nome utente / email), quindi deriviamo il mittente
-- da auth.uid() mappato su utenti o clienti.
-- --------------------------------------------
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

  IF app_officina IS NULL THEN
    RETURN NEW;
  END IF;

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
    -- Cliente ha scritto → notifica tutto lo staff dell'officina
    FOR r IN SELECT id FROM utenti WHERE officina_id = app_officina
    LOOP
      INSERT INTO notifiche (officina_id, utente_id, tipo, titolo, messaggio, link_tipo, link_id)
      VALUES (
        app_officina, r.id, 'messaggio',
        'Nuovo messaggio dal cliente', preview,
        'appuntamento', NEW.appuntamento_id
      );
    END LOOP;
  ELSIF mittente_e_staff AND app_cliente IS NOT NULL THEN
    -- Officina ha scritto → notifica il cliente proprietario
    INSERT INTO notifiche (officina_id, cliente_id, tipo, titolo, messaggio, link_tipo, link_id)
    VALUES (
      app_officina, app_cliente, 'messaggio',
      'Nuovo messaggio dall''officina', preview,
      'appuntamento', NEW.appuntamento_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_new_messaggio ON messaggi;
CREATE TRIGGER trg_new_messaggio
  AFTER INSERT ON messaggi
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_messaggio();


-- --------------------------------------------
-- 4. RLS: il cliente legge/aggiorna solo le proprie notifiche
-- --------------------------------------------
DROP POLICY IF EXISTS notifiche_cliente_select ON notifiche;
CREATE POLICY notifiche_cliente_select ON notifiche
  FOR SELECT TO authenticated
  USING (cliente_id = get_client_id());

DROP POLICY IF EXISTS notifiche_cliente_update ON notifiche;
CREATE POLICY notifiche_cliente_update ON notifiche
  FOR UPDATE TO authenticated
  USING (cliente_id = get_client_id())
  WITH CHECK (cliente_id = get_client_id());
