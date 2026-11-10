-- ============================================
-- OfficinAI - Migrazione 040
-- Attiva Row Level Security sulle tabelle che ne erano prive.
--
-- Perche': il database reale e' stato verificato via query dirette
-- (vedi i log del workflow "Ripara database Supabase") e risultava con
-- RLS disattivata su 20 tabelle su 29, incluse le piu' sensibili:
-- appuntamenti, clienti, veicoli, officine, utenti, preventivi. Con la
-- chiave anon (gia' pubblica nel bundle del frontend) chiunque poteva
-- leggere/scrivere direttamente via REST i dati di QUALSIASI officina,
-- compreso il self-grant di un accesso staff attivo su un'officina
-- altrui. Prima di poter accettare nuove officine paganti questo va
-- chiuso.
--
-- Convenzione di matching: le poche policy gia' attive e funzionanti
-- (movimenti, fatture, promemoria_*, acquisti_fornitori_ricambi) usano
-- "utenti.email = auth.jwt()->>'email'" per lo staff e
-- "clienti.email = auth.jwt()->>'email'" per i clienti: NON esiste in
-- produzione una colonna utenti.auth_id/clienti.auth_id (nonostante
-- RegisterPage/RegisterClientePage/JoinOfficinaPage la referenzino: e'
-- un bug separato, corretto nello stesso commit che introduce questa
-- migrazione). Le poche policy che usavano "utenti.id = auth.uid()" o
-- "clienti.id = auth.uid()" (accettazioni, scansioni_obd) sono sempre
-- state di fatto inattive/errate, perche' id e' un gen_random_uuid() e
-- non coincide mai con l'uid Supabase Auth: vengono corrette qui con lo
-- stesso pattern email-based gia' verificato funzionante.
--
-- Tre pagine di auto-registrazione (RegisterPage, RegisterClientePage,
-- JoinOfficinaPage) scrivono su officine/utenti/clienti/veicoli PRIMA
-- che esista una sessione autenticata (conferma email pendente): per
-- queste vengono aggiunte policy mirate per il ruolo anon, con
-- WITH CHECK che impedisce di auto-concedersi un accesso staff attivo
-- su un'officina che ha gia' almeno un utente.
--
-- Migrazione idempotente: rieseguibile in sicurezza (come tutte quelle
-- applicate dal workflow, che le rilancia ad ogni push).
-- ============================================

-- ------------------------------------------------------------
-- officine (tabella dei tenant)
-- ------------------------------------------------------------
ALTER TABLE officine ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS officine_staff_select ON officine;
CREATE POLICY officine_staff_select ON officine FOR SELECT TO authenticated
  USING (id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'));

DROP POLICY IF EXISTS officine_staff_update ON officine;
CREATE POLICY officine_staff_update ON officine FOR UPDATE TO authenticated
  USING (id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'));

-- Elenco officine pubblico: serve alla ricerca "a quale officina ti
-- registri" (RegisterClientePage) e all'elenco "unisciti a un'officina"
-- (JoinOfficinaPage), entrambe pagine pubbliche senza login. Nessuna
-- regressione: con RLS disattivata l'intera tabella era comunque
-- leggibile da chiunque.
DROP POLICY IF EXISTS officine_anon_select ON officine;
CREATE POLICY officine_anon_select ON officine FOR SELECT TO anon
  USING (true);

-- Creazione di una nuova officina (RegisterPage), prima che esista una
-- sessione autenticata.
DROP POLICY IF EXISTS officine_anon_insert ON officine;
CREATE POLICY officine_anon_insert ON officine FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS officine_auth_insert ON officine;
CREATE POLICY officine_auth_insert ON officine FOR INSERT TO authenticated
  WITH CHECK (true);

-- ------------------------------------------------------------
-- utenti (staff)
-- ------------------------------------------------------------
ALTER TABLE utenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS utenti_staff ON utenti;
CREATE POLICY utenti_staff ON utenti FOR ALL TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'))
  WITH CHECK (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'));

-- Auto-registrazione (titolare di una NUOVA officina, o richiesta di
-- iscrizione staff a un'officina esistente), prima che esista una
-- sessione autenticata. Il WITH CHECK impedisce di auto-concedersi un
-- accesso attivo su un'officina che ha gia' almeno un utente: o la
-- riga resta "attivo = false" (richiesta in attesa di approvazione),
-- oppure deve essere il primo utente in assoluto di quella officina
-- (titolare appena creato insieme ad essa).
DROP POLICY IF EXISTS utenti_anon_insert ON utenti;
CREATE POLICY utenti_anon_insert ON utenti FOR INSERT TO anon
  WITH CHECK (
    attivo = false
    OR (
      ruolo = 'titolare'
      AND NOT EXISTS (SELECT 1 FROM utenti esistenti WHERE esistenti.officina_id = utenti.officina_id)
    )
  );

DROP POLICY IF EXISTS utenti_auth_insert_join ON utenti;
CREATE POLICY utenti_auth_insert_join ON utenti FOR INSERT TO authenticated
  WITH CHECK (
    attivo = false
    OR (
      ruolo = 'titolare'
      AND NOT EXISTS (SELECT 1 FROM utenti esistenti WHERE esistenti.officina_id = utenti.officina_id)
    )
  );

-- ------------------------------------------------------------
-- clienti
-- ------------------------------------------------------------
ALTER TABLE clienti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clienti_staff ON clienti;
CREATE POLICY clienti_staff ON clienti FOR ALL TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'))
  WITH CHECK (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'));

DROP POLICY IF EXISTS clienti_cliente_select ON clienti;
CREATE POLICY clienti_cliente_select ON clienti FOR SELECT TO authenticated
  USING (email = auth.jwt()->>'email');

-- Auto-registrazione cliente (RegisterClientePage), prima che esista
-- una sessione autenticata.
DROP POLICY IF EXISTS clienti_anon_insert ON clienti;
CREATE POLICY clienti_anon_insert ON clienti FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS clienti_auth_insert ON clienti;
CREATE POLICY clienti_auth_insert ON clienti FOR INSERT TO authenticated
  WITH CHECK (true);

-- ------------------------------------------------------------
-- veicoli (nessuna colonna officina_id: si risale via clienti)
-- ------------------------------------------------------------
ALTER TABLE veicoli ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS veicoli_staff ON veicoli;
CREATE POLICY veicoli_staff ON veicoli FOR ALL TO authenticated
  USING (cliente_id IN (
    SELECT id FROM clienti WHERE officina_id IN (
      SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'
    )
  ))
  WITH CHECK (cliente_id IN (
    SELECT id FROM clienti WHERE officina_id IN (
      SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'
    )
  ));

DROP POLICY IF EXISTS veicoli_cliente_select ON veicoli;
CREATE POLICY veicoli_cliente_select ON veicoli FOR SELECT TO authenticated
  USING (cliente_id IN (SELECT id FROM clienti WHERE email = auth.jwt()->>'email'));

-- Auto-registrazione cliente: il veicolo viene creato subito dopo il
-- cliente, prima che esista una sessione autenticata.
DROP POLICY IF EXISTS veicoli_anon_insert ON veicoli;
CREATE POLICY veicoli_anon_insert ON veicoli FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS veicoli_auth_insert ON veicoli;
CREATE POLICY veicoli_auth_insert ON veicoli FOR INSERT TO authenticated
  WITH CHECK (true);

-- ------------------------------------------------------------
-- appuntamenti
-- ------------------------------------------------------------
ALTER TABLE appuntamenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appuntamenti_staff ON appuntamenti;
CREATE POLICY appuntamenti_staff ON appuntamenti FOR ALL TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'))
  WITH CHECK (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'));

DROP POLICY IF EXISTS appuntamenti_cliente_select ON appuntamenti;
CREATE POLICY appuntamenti_cliente_select ON appuntamenti FOR SELECT TO authenticated
  USING (cliente_id IN (SELECT id FROM clienti WHERE email = auth.jwt()->>'email'));

DROP POLICY IF EXISTS appuntamenti_cliente_insert ON appuntamenti;
CREATE POLICY appuntamenti_cliente_insert ON appuntamenti FOR INSERT TO authenticated
  WITH CHECK (cliente_id IN (SELECT id FROM clienti WHERE email = auth.jwt()->>'email'));

-- Il cliente puo' solo accettare/rifiutare una proposta di data
-- (BookingPage/AppCliente): non e' una vera via di bypass del controllo
-- staff, perche' resta scoped alla propria riga.
DROP POLICY IF EXISTS appuntamenti_cliente_update ON appuntamenti;
CREATE POLICY appuntamenti_cliente_update ON appuntamenti FOR UPDATE TO authenticated
  USING (cliente_id IN (SELECT id FROM clienti WHERE email = auth.jwt()->>'email'))
  WITH CHECK (cliente_id IN (SELECT id FROM clienti WHERE email = auth.jwt()->>'email'));

-- ------------------------------------------------------------
-- preventivi (nessuna colonna officina_id: si risale via appuntamenti)
-- ------------------------------------------------------------
ALTER TABLE preventivi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS preventivi_staff ON preventivi;
CREATE POLICY preventivi_staff ON preventivi FOR ALL TO authenticated
  USING (appuntamento_id IN (
    SELECT id FROM appuntamenti WHERE officina_id IN (
      SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'
    )
  ))
  WITH CHECK (appuntamento_id IN (
    SELECT id FROM appuntamenti WHERE officina_id IN (
      SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'
    )
  ));

DROP POLICY IF EXISTS preventivi_cliente_select ON preventivi;
CREATE POLICY preventivi_cliente_select ON preventivi FOR SELECT TO authenticated
  USING (appuntamento_id IN (
    SELECT id FROM appuntamenti WHERE cliente_id IN (
      SELECT id FROM clienti WHERE email = auth.jwt()->>'email'
    )
  ));

-- Il cliente puo' accettare/rifiutare il preventivo (AppCliente).
DROP POLICY IF EXISTS preventivi_cliente_update ON preventivi;
CREATE POLICY preventivi_cliente_update ON preventivi FOR UPDATE TO authenticated
  USING (appuntamento_id IN (
    SELECT id FROM appuntamenti WHERE cliente_id IN (
      SELECT id FROM clienti WHERE email = auth.jwt()->>'email'
    )
  ))
  WITH CHECK (appuntamento_id IN (
    SELECT id FROM appuntamenti WHERE cliente_id IN (
      SELECT id FROM clienti WHERE email = auth.jwt()->>'email'
    )
  ));

-- ------------------------------------------------------------
-- foglio_lavoro (solo staff: nessun accesso cliente nel codice)
-- ------------------------------------------------------------
ALTER TABLE foglio_lavoro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS foglio_lavoro_staff ON foglio_lavoro;
CREATE POLICY foglio_lavoro_staff ON foglio_lavoro FOR ALL TO authenticated
  USING (appuntamento_id IN (
    SELECT id FROM appuntamenti WHERE officina_id IN (
      SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'
    )
  ))
  WITH CHECK (appuntamento_id IN (
    SELECT id FROM appuntamenti WHERE officina_id IN (
      SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'
    )
  ));

-- ------------------------------------------------------------
-- foto
-- ------------------------------------------------------------
ALTER TABLE foto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS foto_staff ON foto;
CREATE POLICY foto_staff ON foto FOR ALL TO authenticated
  USING (appuntamento_id IN (
    SELECT id FROM appuntamenti WHERE officina_id IN (
      SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'
    )
  ))
  WITH CHECK (appuntamento_id IN (
    SELECT id FROM appuntamenti WHERE officina_id IN (
      SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'
    )
  ));

-- Il cliente vede solo le foto marcate come visibili (PhotoGallery
-- readOnly filtra lato client su visibile_cliente, ma il controllo
-- vero deve stare qui).
DROP POLICY IF EXISTS foto_cliente_select ON foto;
CREATE POLICY foto_cliente_select ON foto FOR SELECT TO authenticated
  USING (
    visibile_cliente = true
    AND appuntamento_id IN (
      SELECT id FROM appuntamenti WHERE cliente_id IN (
        SELECT id FROM clienti WHERE email = auth.jwt()->>'email'
      )
    )
  );

-- ------------------------------------------------------------
-- messaggi (chat appuntamento, staff <-> cliente)
-- ------------------------------------------------------------
ALTER TABLE messaggi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messaggi_staff ON messaggi;
CREATE POLICY messaggi_staff ON messaggi FOR ALL TO authenticated
  USING (appuntamento_id IN (
    SELECT id FROM appuntamenti WHERE officina_id IN (
      SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'
    )
  ))
  WITH CHECK (appuntamento_id IN (
    SELECT id FROM appuntamenti WHERE officina_id IN (
      SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'
    )
  ));

DROP POLICY IF EXISTS messaggi_cliente_select ON messaggi;
CREATE POLICY messaggi_cliente_select ON messaggi FOR SELECT TO authenticated
  USING (appuntamento_id IN (
    SELECT id FROM appuntamenti WHERE cliente_id IN (
      SELECT id FROM clienti WHERE email = auth.jwt()->>'email'
    )
  ));

DROP POLICY IF EXISTS messaggi_cliente_insert ON messaggi;
CREATE POLICY messaggi_cliente_insert ON messaggi FOR INSERT TO authenticated
  WITH CHECK (appuntamento_id IN (
    SELECT id FROM appuntamenti WHERE cliente_id IN (
      SELECT id FROM clienti WHERE email = auth.jwt()->>'email'
    )
  ));

-- ------------------------------------------------------------
-- accettazioni (scheda di accettazione veicolo - AccettazioneVeicolo.tsx)
-- Le policy esistenti usavano "utenti.id = auth.uid()", sempre falso:
-- vanno sostituite, non solo attivate, altrimenti la funzione smette di
-- funzionare per lo staff reale appena si accende RLS.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS accettazioni_staff_insert ON accettazioni;
DROP POLICY IF EXISTS accettazioni_staff_select ON accettazioni;
DROP POLICY IF EXISTS accettazioni_staff_update ON accettazioni;

ALTER TABLE accettazioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY accettazioni_staff ON accettazioni FOR ALL TO authenticated
  USING (appuntamento_id IN (
    SELECT id FROM appuntamenti WHERE officina_id IN (
      SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'
    )
  ))
  WITH CHECK (appuntamento_id IN (
    SELECT id FROM appuntamenti WHERE officina_id IN (
      SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'
    )
  ));

-- ------------------------------------------------------------
-- magazzino, casi_ai, impostazioni_email, inviti_staff, schede_lavoro
-- (tutte con officina_id diretta; solo staff, nessun accesso cliente)
-- ------------------------------------------------------------
ALTER TABLE magazzino ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS magazzino_staff ON magazzino;
CREATE POLICY magazzino_staff ON magazzino FOR ALL TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'))
  WITH CHECK (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'));

ALTER TABLE casi_ai ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS casi_ai_staff ON casi_ai;
CREATE POLICY casi_ai_staff ON casi_ai FOR ALL TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'))
  WITH CHECK (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'));

ALTER TABLE impostazioni_email ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS impostazioni_email_staff ON impostazioni_email;
CREATE POLICY impostazioni_email_staff ON impostazioni_email FOR ALL TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'))
  WITH CHECK (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'));

ALTER TABLE inviti_staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inviti_staff_staff ON inviti_staff;
CREATE POLICY inviti_staff_staff ON inviti_staff FOR ALL TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'))
  WITH CHECK (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'));

ALTER TABLE schede_lavoro ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS schede_lavoro_staff ON schede_lavoro;
CREATE POLICY schede_lavoro_staff ON schede_lavoro FOR ALL TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'))
  WITH CHECK (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'));

-- ------------------------------------------------------------
-- difetti, ricambi_usati (via foglio_lavoro -> appuntamenti, due salti)
-- ------------------------------------------------------------
ALTER TABLE difetti ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS difetti_staff ON difetti;
CREATE POLICY difetti_staff ON difetti FOR ALL TO authenticated
  USING (foglio_lavoro_id IN (
    SELECT id FROM foglio_lavoro WHERE appuntamento_id IN (
      SELECT id FROM appuntamenti WHERE officina_id IN (
        SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'
      )
    )
  ))
  WITH CHECK (foglio_lavoro_id IN (
    SELECT id FROM foglio_lavoro WHERE appuntamento_id IN (
      SELECT id FROM appuntamenti WHERE officina_id IN (
        SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'
      )
    )
  ));

ALTER TABLE ricambi_usati ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ricambi_usati_staff ON ricambi_usati;
CREATE POLICY ricambi_usati_staff ON ricambi_usati FOR ALL TO authenticated
  USING (foglio_lavoro_id IN (
    SELECT id FROM foglio_lavoro WHERE appuntamento_id IN (
      SELECT id FROM appuntamenti WHERE officina_id IN (
        SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'
      )
    )
  ))
  WITH CHECK (foglio_lavoro_id IN (
    SELECT id FROM foglio_lavoro WHERE appuntamento_id IN (
      SELECT id FROM appuntamenti WHERE officina_id IN (
        SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'
      )
    )
  ));

-- ------------------------------------------------------------
-- notifiche_scadenze_inviate, whatsapp_inviati
-- Scritte solo da funzioni edge/cron con service role (che ignora RLS):
-- qui basta una policy di sola lettura per lo staff, per sicurezza.
-- ------------------------------------------------------------
ALTER TABLE notifiche_scadenze_inviate ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifiche_scadenze_inviate_staff_select ON notifiche_scadenze_inviate;
CREATE POLICY notifiche_scadenze_inviate_staff_select ON notifiche_scadenze_inviate FOR SELECT TO authenticated
  USING (veicolo_id IN (
    SELECT v.id FROM veicoli v JOIN clienti c ON c.id = v.cliente_id
    WHERE c.officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email')
  ));

ALTER TABLE whatsapp_inviati ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS whatsapp_inviati_staff_select ON whatsapp_inviati;
CREATE POLICY whatsapp_inviati_staff_select ON whatsapp_inviati FOR SELECT TO authenticated
  USING (
    cliente_id IN (
      SELECT id FROM clienti WHERE officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email')
    )
    OR appuntamento_id IN (
      SELECT id FROM appuntamenti WHERE officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email')
    )
  );

-- ------------------------------------------------------------
-- notifiche: RLS era disattivata nonostante policy gia' corrette
-- (migrazione 010 e successive) fossero presenti. Si attiva soltanto,
-- aggiungendo una policy anon per la notifica "richiesta di iscrizione
-- staff" inviata da JoinOfficinaPage prima che esista una sessione.
-- ------------------------------------------------------------
ALTER TABLE notifiche ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifiche_anon_insert_staff_join ON notifiche;
CREATE POLICY notifiche_anon_insert_staff_join ON notifiche FOR INSERT TO anon
  WITH CHECK (tipo = 'staff');

-- ------------------------------------------------------------
-- scansioni_obd: RLS gia' attiva ma con policy errate
-- ("utenti.id = auth.uid()", "clienti.id = auth.uid()": mai vero).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS scansioni_obd_staff_select ON scansioni_obd;
DROP POLICY IF EXISTS scansioni_obd_staff_update ON scansioni_obd;
DROP POLICY IF EXISTS scansioni_obd_cliente_select ON scansioni_obd;
DROP POLICY IF EXISTS scansioni_obd_cliente_insert ON scansioni_obd;

CREATE POLICY scansioni_obd_staff ON scansioni_obd FOR ALL TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'))
  WITH CHECK (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'));

CREATE POLICY scansioni_obd_cliente_select ON scansioni_obd FOR SELECT TO authenticated
  USING (cliente_id IN (SELECT id FROM clienti WHERE email = auth.jwt()->>'email'));

CREATE POLICY scansioni_obd_cliente_insert ON scansioni_obd FOR INSERT TO authenticated
  WITH CHECK (cliente_id IN (SELECT id FROM clienti WHERE email = auth.jwt()->>'email'));

-- ------------------------------------------------------------
-- notifiche_wa: RLS gia' attiva ma con policy completamente aperta
-- ("TO public USING true"), equivalente a nessun isolamento.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS notifiche_wa_all ON notifiche_wa;
CREATE POLICY notifiche_wa_staff ON notifiche_wa FOR ALL TO authenticated
  USING (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'))
  WITH CHECK (officina_id IN (SELECT officina_id FROM utenti WHERE email = auth.jwt()->>'email'));

NOTIFY pgrst, 'reload schema';
