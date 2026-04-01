import { useEffect, useRef, useState } from 'react';

interface LandingPageProps {
  onEnter: () => void;
}

const features = [
  {
    icon: '📅',
    title: 'Agenda Intelligente',
    desc: 'Calendario visivo con drag & drop. I clienti prenotano online 24/7 e ricevono promemoria automatici via SMS.',
    color: 'blue',
  },
  {
    icon: '🤖',
    title: 'AI Diagnostica & Errori a Distanza',
    desc: 'Collega lo scanner OBD2: l\'AI analizza i codici errore, genera la diagnosi e il preventivo — anche da remoto, senza che il veicolo sia fisicamente in officina.',
    color: 'purple',
  },
  {
    icon: '💬',
    title: 'Chat con i Clienti',
    desc: 'Comunica in tempo reale. Invia foto, aggiornamenti sullo stato e notifiche direttamente sul telefono del cliente.',
    color: 'green',
  },
  {
    icon: '🧾',
    title: 'Preventivi e Fatture',
    desc: 'Crea preventivi professionali in 30 secondi. Fatturazione elettronica SDI integrata, invio diretto all\'Agenzia delle Entrate.',
    color: 'amber',
  },
  {
    icon: '📸',
    title: 'Documentazione Foto',
    desc: 'Fotogallery per ogni intervento: prima, durante e dopo. Protezione legale e trasparenza totale con il cliente.',
    color: 'pink',
  },
  {
    icon: '📊',
    title: 'Analytics & Report',
    desc: 'Dashboard in tempo reale: fatturato, ore lavorate, clienti fidelizzati. Dati per crescere, non per perdere tempo.',
    color: 'cyan',
  },
];

const stats = [
  { value: '500+', label: 'Officine attive (auto, moto, barche…)', icon: '🏪' },
  { value: '15h', label: 'Di burocrazia risparmiate ogni settimana', icon: '⏱️' },
  { value: '€12.000', label: 'Fatturato medio in più/anno', icon: '💰' },
  { value: '100%', label: 'Gestibile da remoto, ovunque tu sia', icon: '📡' },
];

const steps = [
  {
    num: '01',
    title: 'Registrati in 2 minuti',
    desc: 'Inserisci i dati della tua officina. Funziona subito dal browser, da iPhone e da Android. Nessuna installazione, nessun server.',
    icon: '🚀',
  },
  {
    num: '02',
    title: 'Configura e importa',
    desc: 'Aggiungi il tuo team, i servizi e i prezzi. Importa i clienti esistenti con un file Excel.',
    icon: '⚙️',
  },
  {
    num: '03',
    title: 'Inizia a guadagnare di più',
    desc: 'Gestisci tutto da un\'unica schermata. I tuoi clienti prenoteranno online e tu non perderai più tempo al telefono.',
    icon: '💪',
  },
];

const plans = [
  {
    name: 'Starter',
    price: '49',
    annualPrice: '39',
    desc: 'Per iniziare',
    highlighted: false,
    badge: null,
    features: [
      '1 utente / meccanico',
      'Agenda appuntamenti',
      'Gestione clienti e veicoli',
      'Preventivi e fatture base',
      'App mobile inclusa',
      'Supporto via email',
    ],
    notIncluded: ['AI Diagnostica OBD2', 'Chat clienti', 'Fatturazione elettronica'],
  },
  {
    name: 'Professional',
    price: '99',
    annualPrice: '79',
    desc: 'Il più scelto dalle officine',
    highlighted: true,
    badge: 'Più popolare',
    features: [
      'Fino a 10 utenti',
      'Tutto di Starter',
      'AI Diagnostica OBD2',
      'Chat real-time clienti',
      'Documentazione fotografica',
      'Fatturazione elettronica SDI',
      'Analytics avanzati',
      'App mobile premium',
      'Supporto prioritario 24h',
    ],
    notIncluded: [],
  },
  {
    name: 'Enterprise',
    price: '199',
    annualPrice: '159',
    desc: 'Per reti di officine',
    highlighted: false,
    badge: null,
    features: [
      'Utenti illimitati',
      'Tutto di Professional',
      'Multi-sede centralizzata',
      'API e integrazioni custom',
      'White label disponibile',
      'Account manager dedicato',
      'SLA 99.9% garantito',
      'Formazione on-site',
    ],
    notIncluded: [],
  },
];

const testimonials = [
  {
    quote: 'Prima perdevo 2 ore al giorno tra telefonate e appunti. Adesso gestisco tutto in 20 minuti. Il mio fatturato è aumentato del 35% in sei mesi.',
    author: 'Marco Ricci',
    role: 'Titolare, AutoService Milano',
    avatar: '👨‍🔧',
    stars: 5,
  },
  {
    quote: 'I miei clienti adorano ricevere le foto dell\'auto e gli aggiornamenti in tempo reale. Ho azzerato le lamentele e i clienti mi raccomandano ai loro amici.',
    author: 'Sofia Lombardi',
    role: 'Responsabile, Officina Rossi & Figli',
    avatar: '👩‍💼',
    stars: 5,
  },
  {
    quote: 'La fatturazione elettronica integrata ha eliminato il commercialista per le fatture ordinarie. Mi risparmio 200€ al mese e zero errori al fisco.',
    author: 'Luca Martini',
    role: 'Titolare, MeccanicaPlus Torino',
    avatar: '👨‍💻',
    stars: 5,
  },
  {
    quote: 'Ho 3 officine e finalmente vedo tutto in un unico pannello. Prima usavo 4 programmi diversi. OfficinAI li ha sostituiti tutti.',
    author: 'Giuseppe Ferrara',
    role: 'Direttore, Gruppo Ferrara Auto',
    avatar: '👨‍💼',
    stars: 5,
  },
  {
    quote: 'L\'AI che legge i codici OBD2 mi ha salvato due volte da diagnosi sbagliate. Ora la uso su ogni veicolo prima di fare qualsiasi preventivo.',
    author: 'Roberto Conti',
    role: 'Meccanico, Fast Repair Roma',
    avatar: '🧑‍🔧',
    stars: 5,
  },
  {
    quote: 'Clienti nuovi ogni settimana grazie alle prenotazioni online. Non avrei mai pensato che un gestionale potesse portarmi nuovi clienti!',
    author: 'Anna Greco',
    role: 'Titolare, Garage Greco Napoli',
    avatar: '👩‍🔧',
    stars: 5,
  },
];

const faqs = [
  {
    q: 'Devo installare qualcosa sul computer?',
    a: 'No. OfficinAI funziona completamente nel browser — Chrome, Safari, Firefox. C\'è anche l\'app mobile per iOS e Android. Nessuna installazione, nessun server da gestire.',
  },
  {
    q: 'Posso importare i dati che ho già?',
    a: 'Sì. Puoi importare clienti, veicoli e storico interventi da qualsiasi file Excel o CSV. Il nostro team ti aiuta gratuitamente nella migrazione durante i primi 30 giorni.',
  },
  {
    q: 'La fatturazione elettronica è davvero integrata?',
    a: 'Sì. Puoi emettere fatture elettroniche con codice SDI direttamente da OfficinAI, senza software aggiuntivi. Tutto conforme alla normativa italiana.',
  },
  {
    q: 'Cosa succede dopo i 14 giorni di prova?',
    a: 'Se vuoi continuare, scegli un piano e inserisci i dati di pagamento. Se non vuoi proseguire, i tuoi dati vengono cancellati in sicurezza — nessun addebito automatico.',
  },
  {
    q: 'Funziona per qualsiasi tipo di officina o veicolo?',
    a: 'Sì. OfficinAI è completamente personalizzabile: funziona per officine auto, moto, barche, moto d\'acqua, trattori, veicoli agricoli, carrozzerie, gommisti e centri revisione. Puoi configurare servizi, listini e nomenclature in base al tuo settore specifico.',
  },
  {
    q: 'Ho bisogno di formazione per usarlo?',
    a: 'No. L\'interfaccia è intuitiva e la maggior parte dei titolari inizia a usarlo da solo in meno di un\'ora. Abbiamo anche video guide e un supporto chat sempre disponibile.',
  },
];

const colorMap: Record<string, string> = {
  blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
  amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  pink: 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400',
  cyan: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400',
};

function useScrollAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function AnimatedSection({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useScrollAnimation();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export function LandingPage({ onEnter }: LandingPageProps) {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');
      if (anchor) {
        e.preventDefault();
        const id = anchor.getAttribute('href')?.slice(1);
        if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-x-hidden">
      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
        @keyframes float { 0%,100% { transform:translateY(0) rotate(0deg); } 50% { transform:translateY(-16px) rotate(1deg); } }
        @keyframes shimmer { 0% { background-position:-200% 0; } 100% { background-position:200% 0; } }
        @keyframes pulse-ring { 0% { transform:scale(1); opacity:0.8; } 100% { transform:scale(1.4); opacity:0; } }
        @keyframes marquee { 0% { transform:translateX(0); } 100% { transform:translateX(-50%); } }
        .animate-fade-in-up { animation:fadeInUp 0.8s ease-out both; }
        .animate-fade-in-up-1 { animation:fadeInUp 0.8s ease-out 0.15s both; }
        .animate-fade-in-up-2 { animation:fadeInUp 0.8s ease-out 0.3s both; }
        .animate-fade-in-up-3 { animation:fadeInUp 0.8s ease-out 0.45s both; }
        .animate-float { animation:float 6s ease-in-out infinite; }
        .shimmer-bg { background:linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent); background-size:200% 100%; animation:shimmer 3s infinite; }
        .pulse-ring { animation:pulse-ring 2s ease-out infinite; }
        .marquee-track { display:flex; animation:marquee 25s linear infinite; width:max-content; }
        .hover-lift { transition:transform 0.3s ease, box-shadow 0.3s ease; }
        .hover-lift:hover { transform:translateY(-6px); box-shadow:0 20px 48px rgba(0,0,0,0.12); }
        .gradient-text { background:linear-gradient(135deg, #1a56db 0%, #7c3aed 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .hero-glow { background:radial-gradient(ellipse 80% 50% at 50% -20%, rgba(26,86,219,0.3), transparent); }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/30">
              <span className="text-lg">🔧</span>
            </div>
            <span className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">OfficinAI</span>
          </div>
          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-500 dark:text-gray-400">
            {[['#features','Funzionalità'],['#how-it-works','Come funziona'],['#pricing','Prezzi'],['#testimonials','Recensioni'],['#faq','FAQ']].map(([href,label]) => (
              <a key={href} href={href} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{label}</a>
            ))}
          </div>
          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <button onClick={onEnter} className="text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-blue-600 transition-colors cursor-pointer">
              Accedi
            </button>
            <button onClick={onEnter} className="px-5 py-2 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-sm shadow-blue-600/30 cursor-pointer">
              Inizia gratis →
            </button>
          </div>
          {/* Mobile hamburger */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <div className="w-5 h-0.5 bg-gray-600 dark:bg-gray-300 mb-1.5 transition-all" style={{ transform: mobileMenuOpen ? 'rotate(45deg) translateY(8px)' : '' }} />
            <div className="w-5 h-0.5 bg-gray-600 dark:bg-gray-300 mb-1.5" style={{ opacity: mobileMenuOpen ? 0 : 1 }} />
            <div className="w-5 h-0.5 bg-gray-600 dark:bg-gray-300" style={{ transform: mobileMenuOpen ? 'rotate(-45deg) translateY(-8px)' : '' }} />
          </button>
        </div>
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 px-4 py-4 space-y-2">
            {[['#features','Funzionalità'],['#how-it-works','Come funziona'],['#pricing','Prezzi'],['#testimonials','Recensioni'],['#faq','FAQ']].map(([href,label]) => (
              <a key={href} href={href} className="block py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 transition-colors">{label}</a>
            ))}
            <div className="pt-3 flex flex-col gap-2">
              <button onClick={onEnter} className="w-full py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer">Accedi</button>
              <button onClick={onEnter} className="w-full py-2.5 text-sm font-bold bg-blue-600 text-white rounded-xl cursor-pointer">Inizia gratis →</button>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-28 pb-24 sm:pt-36 sm:pb-32 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 hero-glow pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 right-1/4 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-400/8 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Announcement badge */}
          <div className="flex justify-center mb-8 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/50 rounded-full text-sm font-semibold text-blue-700 dark:text-blue-300">
              <span className="w-2 h-2 bg-green-500 rounded-full">
                <span className="block w-2 h-2 bg-green-400 rounded-full pulse-ring" />
              </span>
              Nuovo: Fatturazione Elettronica SDI integrata
            </div>
          </div>

          {/* Headline */}
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] animate-fade-in-up">
              La tua officina{' '}
              <span className="gradient-text">gestita dall'AI</span>
              <br />in un unico posto
            </h1>
            <p className="mt-7 text-lg sm:text-xl text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto animate-fade-in-up-1">
              Agenda, clienti, preventivi, fatture e diagnostica OBD2 con AI.
              Pensato per <strong className="text-gray-900 dark:text-white">auto, moto, barche, trattori</strong> e qualsiasi tipo di veicolo — completamente <strong className="text-gray-900 dark:text-white">personalizzabile</strong> per la tua officina.
            </p>
            {/* Vehicle types strip */}
            <div className="mt-8 flex flex-wrap justify-center gap-3 animate-fade-in-up-1">
              {[['🚗','Auto'],['🏍️','Moto'],['⛵','Barche'],['🚜','Trattori'],['🛥️','Moto d\'acqua'],['🚛','Veicoli pesanti'],['🔧','Personalizzabile']].map(([icon, label]) => (
                <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm">
                  <span>{icon}</span><span>{label}</span>
                </div>
              ))}
            </div>

            {/* CTA buttons */}
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up-2">
              <button
                onClick={onEnter}
                className="group px-8 py-4 bg-blue-600 text-white font-bold text-lg rounded-2xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 cursor-pointer"
              >
                Inizia gratis — 14 giorni
                <span className="ml-2 group-hover:translate-x-1 inline-block transition-transform">→</span>
              </button>
              <button
                onClick={onEnter}
                className="px-8 py-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-bold text-lg rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all cursor-pointer"
              >
                🎬 Guarda la demo (2 min)
              </button>
            </div>
            <p className="mt-4 text-sm text-gray-400 animate-fade-in-up-3">
              Nessuna carta di credito · Setup in 2 minuti · Cancella quando vuoi
            </p>
          </div>

          {/* App mockup */}
          <div className="mt-16 animate-fade-in-up-3 flex justify-center">
            <div className="relative animate-float">
              <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl shadow-gray-900/20 overflow-hidden">
                {/* Browser bar */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 mx-4 h-6 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center text-xs text-gray-400">
                    myofficinai.it/dashboard
                  </div>
                </div>
                {/* Dashboard mockup */}
                <div className="p-5 grid grid-cols-3 gap-3">
                  <div className="col-span-3 grid grid-cols-4 gap-3 mb-1">
                    {[['📅','Oggi','12 appt','text-blue-600'],['🔧','In lavorazione','8','text-amber-600'],['✅','Completate','5','text-green-600'],['💶','Incassato','€2.340','text-purple-600']].map(([icon,label,val,cls]) => (
                      <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                        <div className="text-xl mb-1">{icon}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
                        <div className={`text-lg font-bold ${cls} dark:opacity-90`}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div className="col-span-2 space-y-2">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Prossimi appuntamenti</div>
                    {[
                      ['09:00', 'Fiat 500 — AB123CD', 'Tagliando', 'bg-blue-100 text-blue-700'],
                      ['10:30', 'BMW 320d — XY456GH', 'Freni', 'bg-amber-100 text-amber-700'],
                      ['14:00', 'VW Golf — MN789PQ', 'Diagnosi', 'bg-purple-100 text-purple-700'],
                      ['15:30', 'Fiat Panda — RS012TU', 'Gomme', 'bg-green-100 text-green-700'],
                    ].map(([time, car, service, badge]) => (
                      <div key={time} className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <span className="text-xs font-mono text-gray-400 w-10 shrink-0">{time}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{car}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge} dark:opacity-80`}>{service}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">AI Diagnosi recente</div>
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded-xl p-3">
                      <div className="text-xs font-bold text-red-700 dark:text-red-400 mb-1">⚠️ P0300 — Misfiring</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Accensione cilindri irregolare. Controllare candele e bobine.</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">💬 Messaggi</div>
                      <div className="shimmer-bg h-2 rounded mb-1 bg-gray-200 dark:bg-gray-700" />
                      <div className="shimmer-bg h-2 rounded w-3/4 bg-gray-200 dark:bg-gray-700" />
                    </div>
                  </div>
                </div>
              </div>
              {/* Floating badges */}
              <div className="absolute -top-4 -right-4 bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-green-500/30">
                ✨ AI Powered
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold px-3 py-2 rounded-xl shadow-lg flex items-center gap-2">
                <span className="text-green-500">↑</span> +35% fatturato medio
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LOGO BAR / BRAND TRUST ── */}
      <section className="py-10 border-y border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 text-center mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Usato da oltre 500 officine in tutta Italia</p>
        </div>
        <div className="relative overflow-hidden">
          <div className="marquee-track gap-8 px-4">
            {['AutoFix Milano', 'Garage Rossi', 'MeccanicaPlus', 'TopService Roma', 'CarMaster Torino', 'SpeedRepair', 'GommeItalia', 'TecnoAuto', 'RiparAuto Napoli', 'AutoExpress', 'AutoFix Milano', 'Garage Rossi', 'MeccanicaPlus', 'TopService Roma', 'CarMaster Torino', 'SpeedRepair', 'GommeItalia', 'TecnoAuto', 'RiparAuto Napoli', 'AutoExpress'].map((name, i) => (
              <div key={i} className="shrink-0 px-6 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-400 dark:text-gray-500">
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center p-6 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 rounded-2xl border border-gray-100 dark:border-gray-800">
                <div className="text-4xl mb-3">{stat.icon}</div>
                <div className="text-4xl font-extrabold text-gray-900 dark:text-white mb-1">{stat.value}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</div>
              </div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 rounded-full text-sm font-semibold text-blue-700 dark:text-blue-300 mb-4">
              Funzionalità
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white">
              Tutto quello che serve,<br />niente di superfluo
            </h2>
            <p className="mt-4 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Ogni funzione è stata progettata ascoltando titolari di officine reali. Zero complessità, zero sprechi.
            </p>
          </AnimatedSection>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <AnimatedSection key={i} delay={i * 80}>
                <div className="hover-lift h-full bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-7 hover:border-blue-200 dark:hover:border-blue-800 cursor-default">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-5 ${colorMap[f.color]}`}>
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{f.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-sm">{f.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── TWO PORTALS ── */}
      <section className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-14">
            <div className="inline-block px-4 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 rounded-full text-sm font-semibold text-blue-700 dark:text-blue-300 mb-4">
              Un ecosistema completo
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white">
              Due portali connessi.<br />Un'unica piattaforma.
            </h2>
            <p className="mt-4 text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
              Il cliente ha la sua app. L'officina ha il suo gestionale. Tutto sincronizzato in tempo reale.
            </p>
          </AnimatedSection>

          <div className="grid lg:grid-cols-3 gap-6 items-center">
            {/* Customer portal */}
            <AnimatedSection delay={0}>
              <div className="hover-lift bg-white dark:bg-gray-950 rounded-3xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm">
                <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center text-3xl mb-5">👤</div>
                <div className="inline-block px-3 py-1 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/50 rounded-full text-xs font-bold text-purple-600 dark:text-purple-400 mb-4">
                  App Cliente
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-4">Il tuo cliente ha il controllo</h3>
                <ul className="space-y-3">
                  {[
                    '📅 Prenota appuntamenti online 24/7',
                    '🔔 Riceve notifiche sullo stato del veicolo',
                    '📸 Vede le foto dell\'intervento in corso',
                    '✍️ Approva preventivi con firma digitale',
                    '💳 Paga online in anticipo o all\'ritiro',
                    '⭐ Lascia recensioni e storico veicolo',
                  ].map((item) => (
                    <li key={item} className="text-sm text-gray-600 dark:text-gray-400">{item}</li>
                  ))}
                </ul>
              </div>
            </AnimatedSection>

            {/* Connection arrow */}
            <AnimatedSection delay={150} className="flex flex-col items-center justify-center gap-4 py-6 lg:py-0">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-4 shadow-lg shadow-blue-600/30">🔄</div>
                <div className="font-extrabold text-gray-900 dark:text-white text-lg mb-2">Connessi<br />in tempo reale</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 max-w-[180px] mx-auto">Ogni azione del cliente aggiorna istantaneamente l'officina, e viceversa</div>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-[200px]">
                {['Prenotazione', 'Approvazione preventivo', 'Stato lavorazione', 'Pagamento', 'Notifiche push'].map((label) => (
                  <div key={label} className="flex items-center justify-between text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="text-blue-700 dark:text-blue-300 font-medium">{label}</span>
                    <span className="text-blue-400">⇄</span>
                  </div>
                ))}
              </div>
            </AnimatedSection>

            {/* Workshop portal */}
            <AnimatedSection delay={300}>
              <div className="hover-lift bg-white dark:bg-gray-950 rounded-3xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm">
                <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-3xl mb-5">🔧</div>
                <div className="inline-block px-3 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-full text-xs font-bold text-blue-600 dark:text-blue-400 mb-4">
                  Gestionale Officina
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-4">Tu gestisci da qualsiasi posto</h3>
                <ul className="space-y-3">
                  {[
                    '📊 Dashboard completa da web o app',
                    '🌍 Gestisci da remoto — anche in vacanza',
                    '👥 Assegna lavori ai meccanici del team',
                    '🤖 AI diagnostica OBD2 integrata',
                    '🧾 Fatture elettroniche con un click',
                    '📡 Multi-sede: più officine in un pannello',
                  ].map((item) => (
                    <li key={item} className="text-sm text-gray-600 dark:text-gray-400">{item}</li>
                  ))}
                </ul>
              </div>
            </AnimatedSection>
          </div>

          {/* Remote management highlight */}
          <AnimatedSection delay={400} className="mt-12">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-8 text-white text-center">
              <div className="text-4xl mb-4">🌍</div>
              <h3 className="text-2xl font-extrabold mb-3">Gestisci la tua officina da remoto</h3>
              <p className="text-blue-100 max-w-2xl mx-auto text-sm leading-relaxed">
                Sei in viaggio? A casa? Non importa. Vedi gli appuntamenti, approva preventivi, controlla il fatturato e comunica con i tuoi meccanici da qualsiasi dispositivo, ovunque nel mondo.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {['📱 iPhone', '🤖 Android', '💻 Web browser', '🖥️ Desktop', '⌚ Notifiche push'].map((p) => (
                  <span key={p} className="px-4 py-2 bg-white/20 rounded-xl text-sm font-semibold">{p}</span>
                ))}
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── TRUST ── */}
      <section className="py-20 sm:py-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="relative rounded-3xl bg-gray-950 dark:bg-white/5 overflow-hidden px-8 py-16 sm:px-16 text-center">
              {/* Background glow */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/3 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
              </div>
              <div className="relative">
                <div className="text-5xl mb-6">🤝</div>
                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
                  Il cliente si sente<br />
                  <span style={{background:'linear-gradient(135deg,#f59e0b,#fbbf24)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text'}}>
                    al sicuro con te.
                  </span>
                </h2>
                <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed mb-4">
                  Trasparenza totale = <strong className="text-white">fiducia vera</strong>. Il cliente che vede le foto, firma il preventivo e riceve aggiornamenti in tempo reale non ha più dubbi sull'officina. Sa esattamente cosa gli viene fatto — e si sente protetto.
                </p>
                <p className="text-base text-amber-300 font-semibold max-w-xl mx-auto mb-10">
                  "Non mi hanno fregato" non è il massimo che puoi ottenere. Con OfficinAI ottieni: <em>"Tornerò sempre qui."</em>
                </p>
                <div className="grid sm:grid-cols-4 gap-4 max-w-4xl mx-auto mb-10">
                  {[
                    { icon: '📸', title: 'Foto intervento', desc: 'Prima, durante e dopo. Il cliente vede con i propri occhi ogni operazione eseguita.' },
                    { icon: '✍️', title: 'Preventivo firmato', desc: 'Zero sorprese sul conto. Approva digitalmente prima che si inizi qualsiasi lavoro.' },
                    { icon: '🔔', title: 'Stato in tempo reale', desc: 'Sa sempre dove è il suo veicolo, senza dover chiamare.' },
                    { icon: '🛡️', title: 'Storico garantito', desc: 'Ogni intervento documentato. Se sorge un dubbio, c\'è la prova scritta e fotografica.' },
                  ].map((item) => (
                    <div key={item.title} className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left">
                      <div className="text-3xl mb-3">{item.icon}</div>
                      <div className="text-white font-bold text-sm mb-2">{item.title}</div>
                      <div className="text-gray-400 text-xs leading-relaxed">{item.desc}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap justify-center gap-8 text-white">
                  {[
                    ['⭐ 4.9/5', 'valutazione media clienti'],
                    ['📉 -80%', 'lamentele dopo i lavori'],
                    ['🔁 +65%', 'clienti che ritornano'],
                    ['💬 +40%', 'passaparola e recensioni'],
                  ].map(([val, label]) => (
                    <div key={label} className="text-center">
                      <div className="text-2xl font-extrabold">{val}</div>
                      <div className="text-xs text-gray-400 mt-1">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── PROBLEM / SOLUTION ── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <AnimatedSection>
              <div className="inline-block px-4 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-full text-sm font-semibold text-red-600 dark:text-red-400 mb-6">
                Il problema
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-8">
                Quante ore perdi ogni settimana?
              </h2>
              <div className="space-y-4">
                {[
                  ['📞', 'Telefonate per prenotare e ricordare appuntamenti', '4-6 ore/sett.'],
                  ['📝', 'Scrivere preventivi a mano o su Excel', '3-5 ore/sett.'],
                  ['🔍', 'Cercare la storia di un veicolo tra fogli e cartelle', '2-3 ore/sett.'],
                  ['🧾', 'Fatturazione, pagamenti, contabilità', '3-5 ore/sett.'],
                  ['📱', 'Aggiornare il cliente su stato lavori al telefono', '2-3 ore/sett.'],
                ].map(([icon, desc, time]) => (
                  <div key={desc} className="flex items-start gap-4 p-4 bg-red-50/50 dark:bg-red-900/10 border border-red-100/50 dark:border-red-800/20 rounded-xl">
                    <span className="text-2xl">{icon}</span>
                    <div className="flex-1">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{desc}</span>
                    </div>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400 shrink-0">{time}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 bg-red-600 rounded-xl text-white">
                <div className="text-2xl font-extrabold">14-22 ore</div>
                <div className="text-red-100 text-sm">perse ogni settimana in burocrazia invece che in riparazioni</div>
              </div>
            </AnimatedSection>

            <AnimatedSection delay={200}>
              <div className="inline-block px-4 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/50 rounded-full text-sm font-semibold text-green-600 dark:text-green-400 mb-6">
                La soluzione OfficinAI
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-8">
                Recupera il tuo tempo.<br />Fai più riparazioni.
              </h2>
              <div className="space-y-4">
                {[
                  ['✅', 'Prenotazioni online automatiche 24/7 con promemoria SMS', '0 ore/sett.'],
                  ['✅', 'Preventivi in 30 secondi con listino prezzi integrato', '20 min/sett.'],
                  ['✅', 'Storico veicolo completo in un click con ricerca targa', '5 min/sett.'],
                  ['✅', 'Fatturazione elettronica automatica e invio SDI', '30 min/sett.'],
                  ['✅', 'Il cliente vede lo stato in tempo reale — zero telefonate', '0 ore/sett.'],
                ].map(([icon, desc, time]) => (
                  <div key={desc} className="flex items-start gap-4 p-4 bg-green-50/50 dark:bg-green-900/10 border border-green-100/50 dark:border-green-800/20 rounded-xl">
                    <span className="text-2xl">{icon}</span>
                    <div className="flex-1">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{desc}</span>
                    </div>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400 shrink-0">{time}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 bg-green-600 rounded-xl text-white">
                <div className="text-2xl font-extrabold">+15 ore libere</div>
                <div className="text-green-100 text-sm">ogni settimana — e puoi gestire tutto da remoto, anche da casa o in vacanza</div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 rounded-full text-sm font-semibold text-blue-700 dark:text-blue-300 mb-4">
              Come funziona
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white">
              Pronto in 2 minuti, zero installazioni
            </h2>
          </AnimatedSection>
          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-16 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200 dark:from-blue-900 dark:via-blue-600 dark:to-blue-900" />
            {steps.map((s, i) => (
              <AnimatedSection key={i} delay={i * 150} className="text-center">
                <div className="relative inline-flex items-center justify-center mb-6">
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-blue-600/30">
                    <span className="text-xs font-bold text-blue-200">{s.num}</span>
                    <span className="text-2xl">{s.icon}</span>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{s.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-sm max-w-xs mx-auto">{s.desc}</p>
              </AnimatedSection>
            ))}
          </div>
          <AnimatedSection delay={400} className="mt-12 text-center">
            <button onClick={onEnter} className="px-8 py-4 bg-blue-600 text-white font-bold text-lg rounded-2xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/30 cursor-pointer">
              Inizia gratis adesso →
            </button>
          </AnimatedSection>
        </div>
      </section>

      {/* ── PLATFORMS ── */}
      <section id="platforms" className="py-20 sm:py-28 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 rounded-full text-sm font-semibold text-white mb-6">
              <span>📲</span> Disponibile ovunque
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white">
              Web, iOS e Android.<br />Sempre con te.
            </h2>
            <p className="mt-4 text-lg text-blue-100 max-w-xl mx-auto">
              Usa OfficinAI dal computer in officina, dall'iPhone mentre sei sotto la macchina, o dall'Android quando sei in giro. Tutto sincronizzato in tempo reale.
            </p>
          </AnimatedSection>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Web */}
            <AnimatedSection delay={0}>
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 text-center hover-lift">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-5">🌐</div>
                <h3 className="text-xl font-extrabold text-white mb-3">Versione Web</h3>
                <p className="text-blue-100 text-sm leading-relaxed mb-6">
                  Funziona su Chrome, Safari e Firefox. Nessuna installazione — accedi subito da qualsiasi computer.
                </p>
                <button onClick={onEnter} className="w-full py-3 px-5 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition-all active:scale-95 text-sm cursor-pointer">
                  Accedi dal browser →
                </button>
              </div>
            </AnimatedSection>
            {/* iOS */}
            <AnimatedSection delay={120}>
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 text-center hover-lift">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-5">📱</div>
                <h3 className="text-xl font-extrabold text-white mb-3">App iOS</h3>
                <p className="text-blue-100 text-sm leading-relaxed mb-6">
                  Disponibile su App Store per iPhone e iPad. Gestisci agenda, preventivi e chat clienti in mobilità.
                </p>
                <div className="w-full py-3 px-5 bg-black text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 opacity-80">
                  <span className="text-xl"></span>
                  <div className="text-left">
                    <div className="text-[10px] text-gray-300 leading-none">Scarica su</div>
                    <div className="text-sm font-extrabold leading-tight">App Store</div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-blue-200">Disponibile presto</p>
              </div>
            </AnimatedSection>
            {/* Android */}
            <AnimatedSection delay={240}>
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 text-center hover-lift">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-5">🤖</div>
                <h3 className="text-xl font-extrabold text-white mb-3">App Android</h3>
                <p className="text-blue-100 text-sm leading-relaxed mb-6">
                  Disponibile su Google Play. Notifiche push istantanee, foto interventi e firma digitale clienti.
                </p>
                <div className="w-full py-3 px-5 bg-black text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 opacity-80">
                  <span className="text-xl">▶</span>
                  <div className="text-left">
                    <div className="text-[10px] text-gray-300 leading-none">Scarica su</div>
                    <div className="text-sm font-extrabold leading-tight">Google Play</div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-blue-200">Disponibile presto</p>
              </div>
            </AnimatedSection>
          </div>
          {/* Sync badge */}
          <AnimatedSection delay={300} className="mt-10 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl">
              <span className="text-2xl">🔄</span>
              <span className="text-white font-semibold text-sm">Dati sincronizzati in tempo reale su tutti i dispositivi</span>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 rounded-full text-sm font-semibold text-blue-700 dark:text-blue-300 mb-4">
              Prezzi
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white">
              Prezzi chiari. Zero sorprese.
            </h2>
            <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">
              14 giorni gratis su tutti i piani. Cancelli quando vuoi.
            </p>
            {/* Annual toggle */}
            <div className="mt-8 inline-flex items-center gap-3 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <button
                onClick={() => setAnnual(false)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${!annual ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500'}`}
              >
                Mensile
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${annual ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500'}`}
              >
                Annuale
                <span className="ml-1.5 text-xs text-green-600 dark:text-green-400 font-bold">-20%</span>
              </button>
            </div>
          </AnimatedSection>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <AnimatedSection key={plan.name} delay={i * 100}>
                <div className={`hover-lift relative h-full rounded-3xl p-8 flex flex-col ${
                  plan.highlighted
                    ? 'bg-blue-600 text-white border-2 border-blue-500 shadow-2xl shadow-blue-600/25 scale-[1.03]'
                    : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800'
                }`}>
                  {plan.badge && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-extrabold px-4 py-1.5 rounded-full shadow-md">
                      ⭐ {plan.badge}
                    </div>
                  )}
                  <div>
                    <h3 className={`text-lg font-extrabold mb-1 ${plan.highlighted ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{plan.name}</h3>
                    <p className={`text-sm mb-6 ${plan.highlighted ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'}`}>{plan.desc}</p>
                    <div className="flex items-end gap-1 mb-2">
                      <span className={`text-5xl font-extrabold ${plan.highlighted ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                        €{annual ? plan.annualPrice : plan.price}
                      </span>
                      <span className={`text-sm mb-2 ${plan.highlighted ? 'text-blue-200' : 'text-gray-400'}`}>/mese</span>
                    </div>
                    {annual && (
                      <p className={`text-xs mb-6 ${plan.highlighted ? 'text-blue-200' : 'text-green-600 dark:text-green-400'}`}>
                        Fatturato annualmente · Risparmi €{(parseInt(plan.price) - parseInt(plan.annualPrice)) * 12}/anno
                      </p>
                    )}
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feat, j) => (
                      <li key={j} className="flex items-start gap-2.5">
                        <svg className={`w-5 h-5 mt-0.5 shrink-0 ${plan.highlighted ? 'text-blue-200' : 'text-green-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className={`text-sm ${plan.highlighted ? 'text-blue-50' : 'text-gray-600 dark:text-gray-400'}`}>{feat}</span>
                      </li>
                    ))}
                    {plan.notIncluded.map((feat, j) => (
                      <li key={j} className="flex items-start gap-2.5 opacity-40">
                        <svg className="w-5 h-5 mt-0.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-sm text-gray-500 dark:text-gray-500">{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={onEnter}
                    className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm transition-all active:scale-95 cursor-pointer ${
                      plan.highlighted
                        ? 'bg-white text-blue-700 hover:bg-blue-50 shadow-md'
                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20'
                    }`}
                  >
                    Inizia 14 giorni gratis →
                  </button>
                </div>
              </AnimatedSection>
            ))}
          </div>
          <AnimatedSection delay={300} className="mt-10 text-center text-sm text-gray-400">
            Tutti i prezzi sono IVA esclusa · Fatturazione mensile o annuale · Nessun vincolo contrattuale
          </AnimatedSection>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimonials" className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 rounded-full text-sm font-semibold text-blue-700 dark:text-blue-300 mb-4">
              Recensioni reali
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white">
              Cosa dicono i titolari
            </h2>
            <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">
              Oltre 500 officine in tutta Italia. Ecco le loro parole.
            </p>
          </AnimatedSection>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <AnimatedSection key={i} delay={i * 80}>
                <div className="hover-lift h-full bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-7 flex flex-col">
                  <div className="flex gap-0.5 mb-5">
                    {[...Array(t.stars)].map((_, j) => (
                      <svg key={j} className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm flex-1 mb-6">
                    "{t.quote}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/40 rounded-full flex items-center justify-center text-xl shrink-0">
                      {t.avatar}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 dark:text-white">{t.author}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{t.role}</div>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-14">
            <div className="inline-block px-4 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 rounded-full text-sm font-semibold text-blue-700 dark:text-blue-300 mb-4">
              FAQ
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white">
              Domande frequenti
            </h2>
          </AnimatedSection>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <AnimatedSection key={i} delay={i * 60}>
                <div
                  className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden cursor-pointer"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <div className="flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white pr-4">{faq.q}</span>
                    <svg
                      className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {openFaq === i && (
                    <div className="px-5 pb-5 text-sm text-gray-500 dark:text-gray-400 leading-relaxed border-t border-gray-100 dark:border-gray-800 pt-4">
                      {faq.a}
                    </div>
                  )}
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── REMOTE DIAGNOSTICS ── */}
      <section className="py-16 sm:py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="bg-white dark:bg-gray-950 rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
              <div className="grid lg:grid-cols-2 gap-0">
                <div className="p-10 sm:p-14">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/50 rounded-full text-sm font-semibold text-purple-600 dark:text-purple-400 mb-6">
                    <span>🤖</span> AI Diagnostica Remota
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-5">
                    Diagnosi ed eliminazione<br />errori <span className="gradient-text">a distanza</span>
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed mb-8">
                    Il cliente collega lo scanner OBD2 alla sua auto. I dati arrivano in tempo reale al tuo pannello. L'AI identifica i codici errore, suggerisce le cause e genera automaticamente diagnosi e preventivo — <strong className="text-gray-900 dark:text-white">senza che il veicolo sia fisicamente in officina</strong>.
                  </p>
                  <ul className="space-y-3">
                    {[
                      '📡 Lettura codici OBD2 in tempo reale via app cliente',
                      '🧠 AI identifica guasti e cause probabili automaticamente',
                      '🧾 Preventivo generato in automatico e inviato al cliente',
                      '✅ Cliente approva da remoto con firma digitale',
                      '🚗 Il veicolo arriva solo quando si è già pronti a lavorare',
                    ].map(item => (
                      <li key={item} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
                        <span className="shrink-0">{item.slice(0,2)}</span>
                        <span>{item.slice(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-purple-600 to-blue-700 p-10 sm:p-14 flex flex-col justify-center">
                  <div className="text-white/80 text-sm font-semibold mb-3">PRIMA — senza OfficinAI</div>
                  <div className="bg-white/10 rounded-2xl p-5 mb-6 text-white text-sm space-y-2">
                    <div>📞 Cliente chiama, descrive il problema a voce</div>
                    <div>🤷 Tu stimi alla cieca senza dati reali</div>
                    <div>🚗 Auto in officina per diagnosi (mezza giornata)</div>
                    <div>📝 Scrivi il preventivo, aspetti risposta</div>
                  </div>
                  <div className="text-white/80 text-sm font-semibold mb-3">DOPO — con OfficinAI</div>
                  <div className="bg-white/10 rounded-2xl p-5 text-white text-sm space-y-2">
                    <div>📲 Cliente scansiona OBD2 dall'app (2 min)</div>
                    <div>🤖 AI analizza e genera diagnosi automatica</div>
                    <div>✍️ Cliente firma preventivo dal telefono</div>
                    <div>🚗 Auto arriva — lavoro già pianificato e pagato</div>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── CONTACTS ── */}
      <section className="py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-3">
              Hai domande? Scrivici subito.
            </h2>
            <p className="text-gray-500 dark:text-gray-400">Rispondiamo entro poche ore. Puoi anche mandarci un WhatsApp.</p>
          </AnimatedSection>
          <AnimatedSection delay={100}>
            <div className="grid sm:grid-cols-2 gap-5">
              {/* Email */}
              <a href="mailto:info@myofficinai.it" className="group hover-lift flex items-center gap-5 p-7 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition-all">
                <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-2xl shrink-0">📧</div>
                <div>
                  <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Email</div>
                  <div className="text-lg font-extrabold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 transition-colors">info@myofficinai.it</div>
                  <div className="text-xs text-gray-400 mt-0.5">Risposta entro 24h</div>
                </div>
              </a>
              {/* WhatsApp */}
              <a href="https://wa.me/393488552285" className="group hover-lift flex items-center gap-5 p-7 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm hover:border-green-300 dark:hover:border-green-700 transition-all">
                <div className="w-14 h-14 bg-green-50 dark:bg-green-900/30 rounded-2xl flex items-center justify-center text-2xl shrink-0">💬</div>
                <div>
                  <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">WhatsApp</div>
                  <div className="text-lg font-extrabold text-green-600 dark:text-green-400 group-hover:text-green-700 transition-colors">+39 348 855 2285</div>
                  <div className="text-xs text-gray-400 mt-0.5">Risposta rapida</div>
                </div>
              </a>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-20 sm:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 dark:from-blue-900 dark:via-blue-800 dark:to-indigo-900" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection>
            <div className="text-5xl mb-6">🚀</div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-6">
              Pronto a trasformare<br />la tua officina?
            </h2>
            <p className="text-xl text-blue-100/80 mb-10 max-w-2xl mx-auto">
              Unisciti a 500+ officine che hanno già digitalizzato il loro business.
              <strong className="text-white"> Inizia gratis, senza carta di credito.</strong>
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={onEnter}
                className="px-10 py-4 bg-white text-blue-700 font-extrabold text-lg rounded-2xl hover:bg-blue-50 active:scale-95 transition-all shadow-xl cursor-pointer"
              >
                Inizia gratis — 14 giorni →
              </button>
              <button
                onClick={onEnter}
                className="px-10 py-4 border-2 border-white/30 text-white font-bold text-lg rounded-2xl hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
              >
                💬 Parla con noi
              </button>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-blue-200/70">
              <span>✓ 14 giorni gratis</span>
              <span>✓ Nessuna carta richiesta</span>
              <span>✓ Setup in 2 minuti</span>
              <span>✓ Cancella quando vuoi</span>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-gray-950 border-t border-gray-800 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-lg">🔧</span>
                </div>
                <span className="text-xl font-extrabold text-white">OfficinAI</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed max-w-sm mb-6">
                La piattaforma italiana per la gestione intelligente delle officine meccaniche. 500+ officine, zero carta.
              </p>
              <div className="flex items-center gap-2 p-3 bg-gray-900 rounded-xl border border-gray-800 mb-6">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-xs text-gray-400">Tutti i sistemi operativi · 99.9% uptime</span>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <div>📧 <a href="mailto:info@myofficinai.it" className="hover:text-white transition-colors">info@myofficinai.it</a></div>
                <div>💬 <a href="https://wa.me/393488552285" className="hover:text-white transition-colors">WhatsApp +39 348 855 2285</a></div>
              </div>
            </div>
            {[
              { title: 'Prodotto', links: ['Funzionalità', 'Prezzi', 'App Mobile', 'Integrazioni', 'Aggiornamenti'] },
              { title: 'Supporto', links: ['Documentazione', 'Guide video', 'Chat supporto', 'Status sistema'] },
              { title: 'Azienda', links: ['Chi siamo', 'Blog', 'Contatti', 'Privacy Policy', 'Termini di Servizio'] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-sm font-bold text-white mb-4">{col.title}</h4>
                <ul className="space-y-3">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm text-gray-500 hover:text-white transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-600">© 2026 OfficinAI — Tutti i diritti riservati · Made in Italy 🇮🇹</p>
            <div className="flex gap-6 text-sm text-gray-600">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Termini</a>
              <a href="#" className="hover:text-white transition-colors">Cookie</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
