-- ============================================
-- OfficinAI - Migrazione 004
-- Fix trigger notifiche OBD + nuovo trigger per richieste appuntamento
-- ============================================

-- ============================================
-- SEZIONE 1: Trigger nuova richiesta appuntamento
-- Quando un cliente crea un appuntamento con stato='richiesta',
-- notifica TUTTI gli utenti (staff) dell'officina
-- ============================================

CREATE OR REPLACE FUNCTION notify_new_richiesta()
RETURNS trigger AS $$
DECLARE
  r RECORD;
  cliente_nome TEXT;
BEGIN
  -- Solo se lo stato è 'richiesta'
  IF NEW.stato <> 'richiesta' THEN
    RETURN NEW;
  END IF;

  -- Recupera nome cliente
  SELECT nome INTO cliente_nome FROM clienti WHERE id = NEW.cliente_id;

  -- Inserisci notifica per ogni utente dell'officina
  FOR r IN SELECT id FROM utenti WHERE officina_id = NEW.officina_id
  LOOP
    INSERT INTO notifiche (officina_id, utente_id, tipo, titolo, messaggio, link_tipo, link_id)
    VALUES (
      NEW.officina_id,
      r.id,
      'appuntamento',
      'Nuova richiesta appuntamento',
      COALESCE(cliente_nome, 'Un cliente') || ' ha richiesto un appuntamento' ||
        CASE WHEN NEW.note IS NOT NULL AND NEW.note <> '' THEN ': ' || LEFT(NEW.note, 100) ELSE '' END,
      'appuntamento',
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_new_richiesta ON appuntamenti;
CREATE TRIGGER trg_new_richiesta
  AFTER INSERT ON appuntamenti
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_richiesta();

-- ============================================
-- SEZIONE 2: Fix trigger OBD scan (aggiunge utente_id)
-- Il trigger originale non settava utente_id → violava NOT NULL
-- ============================================

CREATE OR REPLACE FUNCTION notify_new_obd_scan()
RETURNS trigger AS $$
DECLARE
  r RECORD;
  cliente_nome TEXT;
BEGIN
  -- Recupera nome cliente
  SELECT nome INTO cliente_nome FROM clienti WHERE id = NEW.cliente_id;

  -- Notifica tutti gli utenti dell'officina
  FOR r IN SELECT id FROM utenti WHERE officina_id = NEW.officina_id
  LOOP
    INSERT INTO notifiche (officina_id, utente_id, tipo, titolo, messaggio)
    VALUES (
      NEW.officina_id,
      r.id,
      'sistema',
      'Nuova scansione OBD',
      COALESCE(cliente_nome, 'Un cliente') || ' ha inviato una scansione con ' ||
        COALESCE(array_length(NEW.codici, 1), 0) || ' codici errore'
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Il trigger trg_new_obd_scan esiste già, la funzione è stata aggiornata con CREATE OR REPLACE

-- ============================================
-- SEZIONE 3: Trigger cambio stato appuntamento
-- Notifica quando un appuntamento passa a 'pronto'
-- ============================================

CREATE OR REPLACE FUNCTION notify_stato_change()
RETURNS trigger AS $$
DECLARE
  r RECORD;
  cliente_nome TEXT;
  veicolo_info TEXT;
BEGIN
  -- Solo se lo stato è cambiato
  IF OLD.stato = NEW.stato THEN
    RETURN NEW;
  END IF;

  -- Solo per stati importanti
  IF NEW.stato NOT IN ('pronto', 'in_lavorazione', 'attesa_ricambi') THEN
    RETURN NEW;
  END IF;

  -- Recupera info
  SELECT nome INTO cliente_nome FROM clienti WHERE id = NEW.cliente_id;
  SELECT marca || ' ' || modello INTO veicolo_info FROM veicoli WHERE id = NEW.veicolo_id;

  -- Notifica tutti gli utenti dell'officina
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
        ELSE 'Stato aggiornato'
      END,
      COALESCE(veicolo_info, 'Veicolo') || ' di ' || COALESCE(cliente_nome, 'cliente') ||
        ' — stato: ' || NEW.stato,
      'appuntamento',
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_stato_change ON appuntamenti;
CREATE TRIGGER trg_stato_change
  AFTER UPDATE OF stato ON appuntamenti
  FOR EACH ROW
  EXECUTE FUNCTION notify_stato_change();

-- ============================================
-- SEZIONE 4: Abilita realtime per notifiche
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifiche;
