-- ============================================
-- OfficinAI - Migrazione 041 (correzione d'emergenza)
--
-- La migrazione 040 ha rotto il login per tutti: la policy
-- "utenti_staff" fa riferimento a se' stessa (SELECT officina_id FROM
-- utenti WHERE email = ...), e Postgres applica la RLS anche dentro
-- quella sottoquery. Risultato: nessuna riga risulta mai visibile (la
-- sottoquery, per stabilire se una riga e' visibile, ha bisogno che
-- una riga sia gia' visibile), quindi la sottoquery torna sempre vuota.
--
-- Questo non blocca solo la tabella utenti: OGNI altra policy del
-- database (movimenti, fatture, clienti, appuntamenti, ecc.) legge
-- l'officina dell'utente con la stessa identica sottoquery contro
-- utenti, quindi ereditano lo stesso blocco. Da qui "Utente non trovato
-- nel sistema" anche per un account che esiste ed e' corretto.
--
-- Correzione immediata: disattiva la RLS sulla sola tabella utenti,
-- cosi' la sottoquery smette di essere filtrata e torna a funzionare
-- per tutte le altre tabelle (che restano protette). Riporta "utenti"
-- allo stato precedente alla 040 (come era da sempre finora), senza
-- perdere la protezione appena aggiunta sulle altre 28 tabelle.
--
-- Una correzione definitiva (funzione SECURITY DEFINER che aggira la
-- RLS per questa sola lettura, cosi' si puo' riaccendere la RLS anche
-- su utenti senza il problema di auto-riferimento) va fatta con calma,
-- non sotto la pressione di un sistema in produzione rotto in questo
-- momento.
-- ============================================

ALTER TABLE utenti DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
