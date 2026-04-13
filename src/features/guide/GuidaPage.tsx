import { useState } from 'react';
import { Card } from '@/components/ui';

interface Sezione {
  id: string;
  icon: string;
  titolo: string;
  contenuto: Step[];
}

interface Step {
  titolo: string;
  desc: string;
}

const SEZIONI: Sezione[] = [
  {
    id: 'primi-passi',
    icon: '🚀',
    titolo: 'Primi passi',
    contenuto: [
      {
        titolo: 'Configura la tua officina',
        desc: 'Vai in Altro > Impostazioni e compila i dati della tua officina: nome, indirizzo, telefono, email e P.IVA. Questi dati appariranno su tutti i documenti (preventivi, fatture, PDF).',
      },
      {
        titolo: 'Aggiungi il tuo team',
        desc: 'Sempre nelle Impostazioni, nella sezione Team puoi aggiungere i tuoi collaboratori. Ogni membro ha un ruolo: Titolare (accesso completo), Operaio (fogli lavoro) o Reception (accettazione e agenda).',
      },
      {
        titolo: 'Configura servizi e orari',
        desc: 'Nella sezione Servizi puoi definire i servizi offerti dalla tua officina. Nella sezione Orari di apertura imposta gli orari per ogni giorno della settimana.',
      },
      {
        titolo: 'Attiva le notifiche',
        desc: 'Clicca sulla campanella in alto a destra e attiva le notifiche push per ricevere avvisi anche quando l\'app e in background.',
      },
    ],
  },
  {
    id: 'clienti-veicoli',
    icon: '👥',
    titolo: 'Clienti e veicoli',
    contenuto: [
      {
        titolo: 'Aggiungere un cliente',
        desc: 'Vai nella tab Clienti e clicca "+ Nuovo cliente". Inserisci nome, email e telefono. L\'email serve per le comunicazioni automatiche, il telefono per WhatsApp.',
      },
      {
        titolo: 'Aggiungere un veicolo',
        desc: 'Dalla scheda di un cliente, clicca "Aggiungi veicolo". Puoi inserire la targa e il sistema cercera automaticamente i dati del veicolo (marca, modello, anno, motorizzazione).',
      },
      {
        titolo: 'Scadenze veicoli',
        desc: 'Per ogni veicolo puoi impostare le scadenze di revisione, assicurazione, tagliando e bollo. Il sistema ti avvisera in anticipo quando stanno per scadere nella dashboard.',
      },
    ],
  },
  {
    id: 'appuntamenti',
    icon: '📅',
    titolo: 'Agenda e appuntamenti',
    contenuto: [
      {
        titolo: 'Creare un appuntamento',
        desc: 'Dalla tab Agenda, clicca "+ Nuovo" per creare un appuntamento. Seleziona il cliente, il veicolo e descrivi il problema. Puoi anche usare il microfono per dettare.',
      },
      {
        titolo: 'Prenotazioni online',
        desc: 'I clienti possono prenotare direttamente dal loro portale. Riceverai una notifica e potrai accettare la prenotazione o proporre una data alternativa.',
      },
      {
        titolo: 'Vista calendario',
        desc: 'In Altro > Calendario puoi vedere tutti gli appuntamenti in vista giornaliera o settimanale per avere una panoramica visiva.',
      },
      {
        titolo: 'Cambiare lo stato',
        desc: 'Ogni appuntamento ha uno stato: Richiesta > Prenotato > In diagnosi > In lavorazione > Attesa ricambi > Pronto. Quando cambi stato, il cliente riceve automaticamente un\'email di notifica.',
      },
    ],
  },
  {
    id: 'accettazione',
    icon: '📋',
    titolo: 'Accettazione veicolo',
    contenuto: [
      {
        titolo: 'Avviare l\'accettazione',
        desc: 'Quando il veicolo arriva in officina, clicca "Auto arrivata in officina" e poi vai nel tab Accettazione. Registra km d\'ingresso, livello carburante e danni preesistenti.',
      },
      {
        titolo: 'Checklist e danni',
        desc: 'Compila la checklist di controllo e segna eventuali danni toccando sulla sagoma del veicolo. Puoi aggiungere note per ogni danno.',
      },
      {
        titolo: 'Firma del cliente',
        desc: 'Alla fine dell\'accettazione, fai firmare il cliente sullo schermo. ATTENZIONE: dopo la firma, l\'accettazione non e piu modificabile.',
      },
    ],
  },
  {
    id: 'foglio-lavoro',
    icon: '🔧',
    titolo: 'Foglio di lavoro',
    contenuto: [
      {
        titolo: 'Avviare il lavoro',
        desc: 'Nel tab Foglio Lavoro, clicca "Avvia lavoro" per far partire il timer. Puoi mettere in pausa e riprendere quante volte vuoi.',
      },
      {
        titolo: 'Aggiungere ricambi',
        desc: 'Puoi aggiungere tre tipi di materiali: Ricambi nuovi, Ricambi usati e Materiali di consumo. Per ogni pezzo inserisci nome, quantita e prezzo. Puoi aggiungere ricambi in qualsiasi momento, anche dopo la chiusura.',
      },
      {
        titolo: 'Segnalare difetti',
        desc: 'Registra i difetti trovati con gravita (bassa/media/alta/critica) e segna se sono stati risolti. Puoi anche indicare interventi consigliati per il futuro.',
      },
      {
        titolo: 'Chiusura e costo automatico',
        desc: 'Quando chiudi il lavoro, il sistema calcola automaticamente il costo della manodopera in base al tempo impiegato e alla tariffa oraria del segmento del veicolo. Il titolare puo modificare manualmente il tempo e il costo.',
      },
      {
        titolo: 'Firma dell\'operaio',
        desc: 'L\'operaio puo firmare il foglio lavoro per certificare il lavoro svolto.',
      },
      {
        titolo: 'Riaprire il lavoro',
        desc: 'Se serve tornare indietro, puoi riaprire il foglio lavoro in qualsiasi momento. Ogni operazione e reversibile.',
      },
      {
        titolo: 'Esporta e condividi',
        desc: 'Usa "Esporta PDF" per stampare il foglio lavoro completo con intestazione officina. Usa "Invia foglio lavoro" per condividerlo via email o WhatsApp.',
      },
    ],
  },
  {
    id: 'preventivi',
    icon: '💰',
    titolo: 'Preventivi',
    contenuto: [
      {
        titolo: 'Creare un preventivo',
        desc: 'Nella tab Preventivi, inserisci la targa del veicolo. Il sistema recupera automaticamente i dati e propone le tariffe standard per il segmento. Aggiungi voci di manodopera e ricambi.',
      },
      {
        titolo: 'Sconto e note',
        desc: 'Puoi applicare uno sconto percentuale e aggiungere note aggiuntive. Il totale con IVA 22% viene calcolato automaticamente.',
      },
      {
        titolo: 'Salvare e inviare',
        desc: 'Dopo aver salvato, puoi inviare il preventivo al cliente via WhatsApp o Email. Il sistema genera prima il PDF professionale con intestazione completa dell\'officina, poi apre il canale di invio.',
      },
      {
        titolo: 'Approvazione del cliente',
        desc: 'Il cliente puo accettare o rifiutare il preventivo dal suo portale. Riceverai una notifica con la decisione.',
      },
    ],
  },
  {
    id: 'fatturazione',
    icon: '🧾',
    titolo: 'Fatturazione',
    contenuto: [
      {
        titolo: 'Inviare il conto',
        desc: 'Dal foglio lavoro, dopo la chiusura, puoi inviare il conto al cliente con il pulsante "Invia conto". C\'e una doppia conferma perche l\'operazione e irreversibile.',
      },
      {
        titolo: 'Fattura elettronica',
        desc: 'Con il pulsante "Fattura elettronica" generi una fattura bozza in formato FatturaPA per il SDI. Puoi completarla con i dati fiscali e scaricare l\'XML.',
      },
      {
        titolo: 'Gestione fatture',
        desc: 'In Altro > Fatturazione trovi tutte le fatture con stati (Bozza > Emessa > Pagata). Puoi generare il PDF e condividere via email o WhatsApp.',
      },
    ],
  },
  {
    id: 'comunicazione',
    icon: '💬',
    titolo: 'Comunicazione con i clienti',
    contenuto: [
      {
        titolo: 'Chat in tempo reale',
        desc: 'Nel tab Chat di ogni appuntamento puoi chattare direttamente con il cliente. I messaggi sono in tempo reale e il cliente li vede sul suo portale.',
      },
      {
        titolo: 'WhatsApp',
        desc: 'Nel tab WhatsApp puoi inviare messaggi predefiniti o personalizzati. Se hai configurato Twilio, i messaggi partono automaticamente. Altrimenti si apre WhatsApp Web.',
      },
      {
        titolo: 'Foto del lavoro',
        desc: 'Nel tab Foto puoi scattare e caricare foto organizzate per categoria: Prima, Durante, Dopo, Difetto, Ricambio. Le foto "visibili al cliente" appariranno nel suo portale.',
      },
      {
        titolo: 'Email automatiche',
        desc: 'Quando cambi lo stato di un appuntamento, il cliente riceve automaticamente un\'email con l\'aggiornamento. In Impostazioni > Email puoi gestire i template attivi.',
      },
    ],
  },
  {
    id: 'magazzino',
    icon: '📦',
    titolo: 'Magazzino',
    contenuto: [
      {
        titolo: 'Gestire l\'inventario',
        desc: 'In Altro > Magazzino trovi tutti i tuoi articoli. Puoi aggiungere, modificare ed eliminare pezzi. Usa i pulsanti +/- per aggiustare rapidamente le quantita.',
      },
      {
        titolo: 'Scorte minime',
        desc: 'Per ogni articolo puoi impostare una scorta minima. Quando la quantita scende sotto la soglia, l\'articolo viene evidenziato in rosso e appare un avviso nella dashboard.',
      },
      {
        titolo: 'Categorie e ricerca',
        desc: 'Organizza gli articoli per categoria (Filtri, Olio, Freni, ecc.) e usa la ricerca per trovare rapidamente quello che ti serve.',
      },
    ],
  },
  {
    id: 'ai-obd',
    icon: '🤖',
    titolo: 'AI Diagnostica e OBD',
    contenuto: [
      {
        titolo: 'Diagnostica AI',
        desc: 'Nel tab AI di ogni appuntamento, l\'intelligenza artificiale analizza i codici OBD e il problema segnalato per suggerire possibili cause e soluzioni.',
      },
      {
        titolo: 'Scansioni OBD dai clienti',
        desc: 'I clienti possono inviare i codici errore del loro veicolo direttamente dal portale. Le trovi in Altro > Scansioni OBD. Da li puoi creare un appuntamento con un click.',
      },
    ],
  },
  {
    id: 'analytics',
    icon: '📊',
    titolo: 'Analytics e report',
    contenuto: [
      {
        titolo: 'Dashboard analytics',
        desc: 'In Altro > Analytics trovi KPI, grafici e statistiche. Puoi filtrare per periodo (7 giorni, 30 giorni, 90 giorni, anno) e vedere il tasso di conversione dei preventivi.',
      },
      {
        titolo: 'Esportare i dati',
        desc: 'Clicca il pulsante CSV per esportare i dati degli appuntamenti del periodo selezionato in un file che puoi aprire con Excel.',
      },
      {
        titolo: 'Recensioni clienti',
        desc: 'In fondo alla pagina Analytics trovi le recensioni lasciate dai clienti dopo il completamento dei lavori, con media voti e commenti.',
      },
    ],
  },
  {
    id: 'portale-cliente',
    icon: '📱',
    titolo: 'Il portale clienti',
    contenuto: [
      {
        titolo: 'Cosa vedono i clienti',
        desc: 'I tuoi clienti accedono al loro portale dove possono: vedere lo stato del lavoro in tempo reale, chattare con te, vedere le foto, accettare preventivi, prenotare appuntamenti e inviare codici OBD.',
      },
      {
        titolo: 'Storico e recensioni',
        desc: 'I clienti possono consultare lo storico dei loro interventi e lasciare una recensione con stelle e commento al termine di ogni lavoro.',
      },
    ],
  },
  {
    id: 'impostazioni',
    icon: '⚙️',
    titolo: 'Impostazioni avanzate',
    contenuto: [
      {
        titolo: 'Tema scuro',
        desc: 'Nelle Impostazioni puoi attivare il tema scuro per lavorare meglio in condizioni di poca luce.',
      },
      {
        titolo: 'Gestione team',
        desc: 'Il titolare puo aggiungere, modificare ruoli, disattivare o eliminare i membri del team.',
      },
      {
        titolo: 'Installare come app',
        desc: 'OfficinAI e una PWA: puoi installarla sul telefono o tablet come un\'app nativa. Su Chrome, clicca il menu e poi "Installa app" o "Aggiungi alla schermata Home".',
      },
    ],
  },
];

export function GuidaPage() {
  const [aperta, setAperta] = useState<string | null>(null);

  return (
    <div className="p-4 space-y-3 pb-24">
      <div className="text-center mb-4">
        <div className="text-4xl mb-2">📖</div>
        <h2 className="text-xl font-bold text-gray-900">Guida completa</h2>
        <p className="text-sm text-gray-500 mt-1">Tutto quello che devi sapere per usare OfficinAI</p>
      </div>

      {/* Quick start */}
      <Card className="!p-4 bg-blue-50 border-blue-200">
        <h3 className="text-sm font-bold text-blue-900 mb-2">Inizia cosi:</h3>
        <div className="space-y-2">
          {['Configura i dati officina in Impostazioni', 'Aggiungi il tuo team', 'Crea il primo cliente e veicolo', 'Crea il primo appuntamento', 'Attiva le notifiche push'].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                {i + 1}
              </div>
              <span className="text-xs text-blue-800">{step}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Sections */}
      {SEZIONI.map((sezione) => (
        <div key={sezione.id}>
          <button
            onClick={() => setAperta(aperta === sezione.id ? null : sezione.id)}
            className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xl shrink-0">
              {sezione.icon}
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold text-sm text-gray-900">{sezione.titolo}</div>
              <div className="text-[10px] text-gray-400">{sezione.contenuto.length} argomenti</div>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${aperta === sezione.id ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {aperta === sezione.id && (
            <div className="ml-4 mt-1 space-y-2 border-l-2 border-blue-200 pl-4">
              {sezione.contenuto.map((step, i) => (
                <div key={i} className="py-2">
                  <div className="text-sm font-semibold text-gray-900 mb-1">
                    {step.titolo}
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Help footer */}
      <Card className="!p-4 bg-gray-50 text-center">
        <div className="text-lg mb-1">💡</div>
        <p className="text-xs text-gray-500">
          Hai bisogno di aiuto? Usa la chat nell'app per contattare il supporto oppure scrivi a <strong>supporto@officinai.it</strong>
        </p>
      </Card>
    </div>
  );
}
