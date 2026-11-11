interface LegalModalProps {
  section: 'termini' | 'privacy';
  onClose: () => void;
}

// Bozza iniziale: va fatta rivedere da un consulente/legale prima di un
// lancio pubblico vero (raccolta dati di clienti reali, pagamenti con
// carta). Il testo e' scritto in buona fede per coprire i punti minimi
// (titolare del trattamento, dati raccolti, Stripe come sub-responsabile,
// diritti dell'interessato, recesso) ma non sostituisce una consulenza.
const TITOLARE = 'OfficinAI';
const EMAIL_CONTATTO = 'supporto@myofficinai.it';

function TerminiContent() {
  return (
    <>
      <h3 className="font-bold text-gray-900 dark:text-white mt-5 mb-2">1. Il servizio</h3>
      <p>
        OfficinAI è un gestionale in abbonamento per officine (meccaniche, moto, carrozzerie,
        gommisti, elettrauto e simili) che permette di gestire appuntamenti, clienti, veicoli,
        preventivi, fatturazione, cassa e comunicazione con i clienti finali.
      </p>
      <h3 className="font-bold text-gray-900 dark:text-white mt-5 mb-2">2. Account e registrazione</h3>
      <p>
        Per usare OfficinAI serve registrare un account con dati veri. Chi registra un'officina
        è responsabile della correttezza dei dati inseriti e della gestione degli account del
        proprio staff (titolare, operai, reception) creati all'interno dell'officina.
      </p>
      <h3 className="font-bold text-gray-900 dark:text-white mt-5 mb-2">3. Prova gratuita e abbonamento</h3>
      <p>
        La registrazione include 2 mesi di prova gratuita. Al termine della prova, per
        continuare a usare il servizio è necessario sottoscrivere un piano a pagamento. I prezzi
        e le caratteristiche dei piani sono indicati nella pagina Abbonamento dell'app. I
        pagamenti sono gestiti da Stripe; l'abbonamento si rinnova automaticamente a meno di
        disdetta, effettuabile in qualsiasi momento dal portale di gestione Stripe raggiungibile
        dall'app.
      </p>
      <h3 className="font-bold text-gray-900 dark:text-white mt-5 mb-2">4. Dati e contenuti</h3>
      <p>
        I dati inseriti nell'officina (clienti, veicoli, appuntamenti, preventivi, fatture,
        movimenti di cassa) restano di proprietà dell'officina che li ha inseriti. OfficinAI non
        li usa per scopi diversi dall'erogazione del servizio, salvo quanto descritto nella
        Privacy Policy.
      </p>
      <h3 className="font-bold text-gray-900 dark:text-white mt-5 mb-2">5. Disponibilità del servizio</h3>
      <p>
        OfficinAI è offerto "così com'è". Si lavora per mantenere il servizio disponibile e i
        dati al sicuro, ma non si garantisce un'assenza totale di interruzioni o errori. In caso
        di malfunzionamento, scrivere a {EMAIL_CONTATTO}.
      </p>
      <h3 className="font-bold text-gray-900 dark:text-white mt-5 mb-2">6. Recesso e cancellazione</h3>
      <p>
        È possibile disdire l'abbonamento in qualsiasi momento; il servizio resta attivo fino
        alla fine del periodo già pagato. È possibile richiedere l'esportazione o la cancellazione
        dei propri dati scrivendo a {EMAIL_CONTATTO}.
      </p>
      <h3 className="font-bold text-gray-900 dark:text-white mt-5 mb-2">7. Modifiche</h3>
      <p>
        Questi termini possono essere aggiornati; le modifiche rilevanti verranno comunicate
        via email o all'interno dell'app.
      </p>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <p>
        Il titolare del trattamento dei dati raccolti tramite OfficinAI è {TITOLARE}, contattabile
        all'indirizzo {EMAIL_CONTATTO}.
      </p>
      <h3 className="font-bold text-gray-900 dark:text-white mt-5 mb-2">Dati raccolti</h3>
      <p>
        In fase di registrazione e utilizzo raccogliamo: dati identificativi e di contatto
        dell'officina e del suo staff (nome, email, telefono, indirizzo, eventuale partita IVA);
        dati identificativi e di contatto dei clienti e dei loro veicoli inseriti dall'officina;
        dati relativi agli appuntamenti, ai lavori svolti, ai preventivi e ai pagamenti; dati
        tecnici di accesso (log, indirizzo IP) raccolti automaticamente dal servizio.
      </p>
      <h3 className="font-bold text-gray-900 dark:text-white mt-5 mb-2">Finalità e base giuridica</h3>
      <p>
        I dati sono trattati per erogare il servizio richiesto (esecuzione di un contratto),
        per rispondere a richieste di assistenza, per l'invio di comunicazioni di servizio
        (es. notifiche appuntamenti, scadenze veicolo) e, dove richiesto dalla legge, per
        adempimenti fiscali legati alla fatturazione elettronica.
      </p>
      <h3 className="font-bold text-gray-900 dark:text-white mt-5 mb-2">Soggetti terzi coinvolti</h3>
      <p>
        Per l'elaborazione dei pagamenti ci appoggiamo a Stripe, per l'invio di email a un
        fornitore di servizi email transazionali, e per l'invio di notifiche WhatsApp a un
        fornitore di messaggistica (Twilio). Questi fornitori trattano i dati necessari
        esclusivamente per conto di OfficinAI e secondo le proprie informative privacy.
      </p>
      <h3 className="font-bold text-gray-900 dark:text-white mt-5 mb-2">Conservazione</h3>
      <p>
        I dati sono conservati per tutta la durata del rapporto contrattuale e per il tempo
        richiesto dagli obblighi di legge (es. conservazione documenti fiscali). È possibile
        richiederne la cancellazione anticipata, salvo obblighi di legge che impongano di
        conservarli.
      </p>
      <h3 className="font-bold text-gray-900 dark:text-white mt-5 mb-2">Diritti dell'interessato</h3>
      <p>
        In qualsiasi momento è possibile richiedere accesso, rettifica, cancellazione o
        portabilità dei propri dati, oppure opporsi al trattamento, scrivendo a {EMAIL_CONTATTO}.
      </p>
    </>
  );
}

export function LegalModal({ section, onClose }: LegalModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-[60] overflow-y-auto flex items-start sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-lg my-8 sm:my-0 max-h-[85vh] overflow-y-auto p-6 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {section === 'termini' ? 'Termini e Condizioni' : 'Privacy Policy'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 mb-2">
          Bozza — in attesa di revisione legale definitiva.
        </p>
        <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          {section === 'termini' ? <TerminiContent /> : <PrivacyContent />}
        </div>
      </div>
    </div>
  );
}
