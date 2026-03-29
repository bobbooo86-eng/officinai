import { useEffect } from 'react';

interface LandingPageProps {
  onEnter: () => void;
}

const features = [
  { icon: '\u{1F4C5}', title: 'Agenda Intelligente', desc: 'Gestisci appuntamenti con vista calendario e notifiche automatiche' },
  { icon: '\u{1F916}', title: 'AI Diagnostica', desc: 'Analisi codici OBD2 e diagnosi automatica con intelligenza artificiale' },
  { icon: '\u{1F4AC}', title: 'Chat Real-time', desc: 'Comunica con i clienti in tempo reale direttamente dall\'app' },
  { icon: '\u{1F9FE}', title: 'Fatturazione', desc: 'Preventivi, fatture e fatturazione elettronica SDI in un click' },
  { icon: '\u{1F4F8}', title: 'Documentazione Foto', desc: 'Fotografa ogni fase della lavorazione: prima, durante e dopo' },
  { icon: '\u{1F4CA}', title: 'Analytics', desc: 'Dashboard e statistiche per monitorare l\'andamento dell\'officina' },
];

const steps = [
  { num: 1, title: 'Registra la tua officina', desc: 'Crea il tuo account in meno di 2 minuti e configura i dati della tua attivit\u00e0.' },
  { num: 2, title: 'Configura servizi e personale', desc: 'Aggiungi i tuoi meccanici, i servizi offerti e gli orari di apertura.' },
  { num: 3, title: 'Inizia a gestire tutto da un\'unica piattaforma', desc: 'Appuntamenti, clienti, fatture e diagnostica AI a portata di mano.' },
];

const plans = [
  {
    name: 'Starter',
    price: '49',
    desc: 'Per piccole officine',
    highlighted: false,
    features: ['Fino a 2 utenti', 'Agenda appuntamenti', 'Gestione clienti', 'Fatturazione base', 'Supporto email'],
  },
  {
    name: 'Professional',
    price: '99',
    desc: 'Per officine in crescita',
    highlighted: true,
    features: ['Fino a 10 utenti', 'Tutto di Starter', 'AI Diagnostica OBD2', 'Chat real-time clienti', 'Documentazione foto', 'Analytics avanzati', 'Supporto prioritario'],
  },
  {
    name: 'Enterprise',
    price: '199',
    desc: 'Per reti di officine',
    highlighted: false,
    features: ['Utenti illimitati', 'Tutto di Professional', 'Multi-sede', 'API personalizzate', 'Account manager dedicato', 'SLA garantito', 'Formazione on-site'],
  },
];

const testimonials = [
  { quote: 'Da quando usiamo OfficinAI abbiamo ridotto i tempi di gestione del 40%', author: 'Marco R.', company: 'AutoService Milano', avatar: '\u{1F468}\u200D\u{1F527}' },
  { quote: 'I clienti adorano poter seguire lo stato della riparazione in tempo reale', author: 'Sofia L.', company: 'Officina Rossi', avatar: '\u{1F469}\u200D\u{1F4BC}' },
  { quote: 'La fatturazione elettronica integrata ci ha semplificato enormemente la vita', author: 'Luca M.', company: 'MeccanicaPlus', avatar: '\u{1F468}\u200D\u{1F4BB}' },
];

export function LandingPage({ onEnter }: LandingPageProps) {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');
      if (anchor) {
        e.preventDefault();
        const id = anchor.getAttribute('href')?.slice(1);
        if (id) {
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-x-hidden">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(2deg); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-fade-in-up { animation: fadeInUp 0.8s ease-out both; }
        .animate-fade-in-up-delay-1 { animation: fadeInUp 0.8s ease-out 0.15s both; }
        .animate-fade-in-up-delay-2 { animation: fadeInUp 0.8s ease-out 0.3s both; }
        .animate-fade-in-up-delay-3 { animation: fadeInUp 0.8s ease-out 0.45s both; }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-slide-in-left { animation: slideInLeft 0.8s ease-out both; }
        .animate-scale-in { animation: scaleIn 0.6s ease-out both; }
        .landing-card:hover { transform: translateY(-6px); box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        .landing-card { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .shimmer-bg {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          background-size: 200% 100%;
          animation: shimmer 3s infinite;
        }
      `}</style>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-lg">{'\u{1F527}'}</span>
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">OfficinAI</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600 dark:text-gray-400">
            <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Funzionalit&agrave;</a>
            <a href="#how-it-works" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Come funziona</a>
            <a href="#pricing" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Prezzi</a>
            <a href="#testimonials" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Recensioni</a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onEnter}
              className="text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              Accedi
            </button>
            <button
              onClick={onEnter}
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm cursor-pointer"
            >
              Inizia gratis
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-32 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 dark:from-blue-800 dark:via-blue-900 dark:to-gray-950 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-400/5 rounded-full" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight animate-fade-in-up">
                La gestione della tua officina, reinventata con l'AI
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-blue-100/90 leading-relaxed animate-fade-in-up-delay-1">
                OfficinAI &egrave; la piattaforma all-in-one per officine meccaniche. Gestisci appuntamenti, clienti, preventivi e fatture con l'intelligenza artificiale.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 animate-fade-in-up-delay-2">
                <button
                  onClick={onEnter}
                  className="px-8 py-4 bg-white text-blue-700 font-bold text-lg rounded-2xl hover:bg-blue-50 active:bg-blue-100 transition-all shadow-lg hover:shadow-xl cursor-pointer"
                >
                  Inizia gratis
                </button>
                <button
                  onClick={onEnter}
                  className="px-8 py-4 border-2 border-white/40 text-white font-bold text-lg rounded-2xl hover:bg-white/10 active:bg-white/20 transition-all cursor-pointer"
                >
                  Guarda la demo
                </button>
              </div>
              <p className="mt-4 text-sm text-blue-200/70 animate-fade-in-up-delay-3">
                14 giorni di prova gratuita &middot; Nessuna carta richiesta
              </p>
            </div>

            {/* Floating mockup */}
            <div className="hidden lg:flex justify-center animate-fade-in-up-delay-2">
              <div className="relative animate-float">
                <div className="w-80 h-[440px] bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20 p-6 shadow-2xl">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-8 bg-white/15 rounded-lg shimmer-bg" />
                    <div className="grid grid-cols-3 gap-2">
                      <div className="h-20 bg-white/10 rounded-xl flex items-center justify-center text-2xl">{'\u{1F4C5}'}</div>
                      <div className="h-20 bg-white/10 rounded-xl flex items-center justify-center text-2xl">{'\u{1F916}'}</div>
                      <div className="h-20 bg-white/10 rounded-xl flex items-center justify-center text-2xl">{'\u{1F4AC}'}</div>
                    </div>
                    <div className="h-6 bg-white/10 rounded-lg w-3/4" />
                    <div className="h-6 bg-white/10 rounded-lg w-1/2" />
                    <div className="mt-4 space-y-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-white/10 rounded-xl">
                          <div className="w-8 h-8 rounded-full bg-white/20" />
                          <div className="flex-1 space-y-1">
                            <div className="h-3 bg-white/15 rounded w-2/3" />
                            <div className="h-2 bg-white/10 rounded w-1/2" />
                          </div>
                          <div className="w-16 h-6 bg-green-400/30 rounded-lg" />
                        </div>
                      ))}
                    </div>
                    <div className="h-24 bg-white/10 rounded-xl mt-2 flex items-center justify-center">
                      <div className="text-4xl">{'\u{1F4CA}'}</div>
                    </div>
                  </div>
                </div>
                {/* Floating badge */}
                <div className="absolute -top-4 -right-4 bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                  AI Powered
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="py-12 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-8">
            Oltre 500 officine si fidano di OfficinAI
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            {['AutoFix Pro', 'MeccanicaPlus', 'GarageItalia', 'TopService', 'CarMaster', 'RiparaFast'].map((name) => (
              <div
                key={name}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-800 rounded-xl text-sm font-semibold text-gray-400 dark:text-gray-500"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
              Tutto quello che serve alla tua officina
            </h2>
            <p className="mt-4 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Una suite completa di strumenti progettati per semplificare ogni aspetto della gestione della tua officina.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {features.map((f, i) => (
              <div
                key={i}
                className="landing-card bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 hover:border-blue-300 dark:hover:border-blue-700"
              >
                <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-3xl mb-5">
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{f.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
              Iniziare &egrave; semplicissimo
            </h2>
            <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">
              Tre semplici passaggi per digitalizzare la tua officina.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-10 sm:gap-12">
            {steps.map((s) => (
              <div key={s.num} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 text-white text-2xl font-extrabold rounded-full mb-6 shadow-lg shadow-blue-600/30">
                  {s.num}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{s.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
              Piani semplici e trasparenti
            </h2>
            <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">
              Scegli il piano pi&ugrave; adatto alla tua officina. Tutti includono 14 giorni di prova gratuita.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`landing-card relative rounded-3xl p-8 ${
                  plan.highlighted
                    ? 'bg-blue-600 text-white shadow-2xl shadow-blue-600/30 scale-105 border-2 border-blue-500'
                    : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-xs font-bold px-4 py-1 rounded-full">
                    Pi&ugrave; popolare
                  </div>
                )}
                <h3 className={`text-lg font-bold mb-1 ${plan.highlighted ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-6 ${plan.highlighted ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                  {plan.desc}
                </p>
                <div className="mb-8">
                  <span className={`text-5xl font-extrabold ${plan.highlighted ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    &euro;{plan.price}
                  </span>
                  <span className={`text-sm ml-1 ${plan.highlighted ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'}`}>
                    /mese
                  </span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <svg
                        className={`w-5 h-5 mt-0.5 flex-shrink-0 ${plan.highlighted ? 'text-blue-200' : 'text-blue-600 dark:text-blue-400'}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className={`text-sm ${plan.highlighted ? 'text-blue-50' : 'text-gray-600 dark:text-gray-400'}`}>
                        {feat}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={onEnter}
                  className={`w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                    plan.highlighted
                      ? 'bg-white text-blue-700 hover:bg-blue-50 active:bg-blue-100 shadow-md'
                      : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm'
                  }`}
                >
                  Inizia la prova gratuita
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
              Cosa dicono i nostri clienti
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="landing-card bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center text-xl">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white text-sm">{t.author}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-28 bg-gradient-to-br from-blue-700 to-blue-900 dark:from-blue-900 dark:to-gray-950 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-blue-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-indigo-500/20 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Pronto a trasformare la tua officina?
          </h2>
          <p className="text-lg text-blue-100/80 mb-10">
            Inizia la prova gratuita di 14 giorni. Nessuna carta di credito richiesta.
          </p>
          <button
            onClick={onEnter}
            className="px-10 py-4 bg-white text-blue-700 font-bold text-lg rounded-2xl hover:bg-blue-50 active:bg-blue-100 transition-all shadow-lg hover:shadow-xl cursor-pointer"
          >
            Inizia gratis ora
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-gray-900 dark:bg-gray-950 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
            {/* Brand */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-lg">{'\u{1F527}'}</span>
                </div>
                <span className="text-xl font-bold text-white">OfficinAI</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
                La piattaforma intelligente per la gestione delle officine meccaniche. Semplifica il lavoro, migliora il servizio.
              </p>
              {/* Social icons */}
              <div className="flex gap-4 mt-6">
                {['M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z',
                  'M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm3 8h-1.35c-.538 0-.65.221-.65.778v1.222h2l-.209 2h-1.791v7h-3v-7h-2v-2h2v-2.308c0-1.769.931-2.692 3.029-2.692h1.971v3z',
                  'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667h-3.554v-11.452h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zm-15.11-13.019c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019h-3.564v-11.452h3.564v11.452z'].map((path, i) => (
                  <a key={i} href="#" className="w-9 h-9 rounded-full bg-gray-800 hover:bg-blue-600 flex items-center justify-center transition-colors">
                    <svg className="w-4 h-4 text-gray-400 hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d={path} />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
            {/* Links */}
            {[
              { title: 'Prodotto', links: ['Funzionalit\u00e0', 'Prezzi', 'Integrazioni', 'Aggiornamenti'] },
              { title: 'Risorse', links: ['Documentazione', 'Guide', 'Blog', 'Supporto'] },
              { title: 'Azienda', links: ['Chi siamo', 'Lavora con noi', 'Contatti', 'Partner'] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-sm font-semibold text-white mb-4">{col.title}</h4>
                <ul className="space-y-3">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">&copy; 2026 OfficinAI. Tutti i diritti riservati.</p>
            <div className="flex gap-6 text-sm text-gray-500">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Termini di Servizio</a>
              <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
