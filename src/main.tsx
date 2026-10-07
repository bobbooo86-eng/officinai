import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@/lib/i18n'
import './index.css'
import App from './App.tsx'

// L'app resta installata come PWA e spesso non viene mai chiusa del
// tutto: senza un controllo periodico, il service worker non si accorge
// mai di una nuova versione pubblicata (il browser lo ricontrolla da
// solo solo ogni ~24h), e l'app continua a usare codice vecchio anche
// giorni dopo un aggiornamento. Ricontrollare ogni minuto e aggiornare
// subito (registerType 'autoUpdate') tiene la versione in uso allineata
// a quella pubblicata.
//
// Il nuovo service worker pero' prende il controllo SENZA ricaricare la
// pagina: chi la teneva gia' aperta resta a meta' tra il vecchio e il
// nuovo, e in quella finestra puo' capitare che l'HTML carichi ma il CSS
// no (pagina senza nessuno stile). "controllerchange" segnala esattamente
// il momento in cui il nuovo service worker prende il controllo: un
// ricaricamento a quel punto garantisce che la pagina riparta sempre
// pulita, invece di restare in questo stato a meta'.
if ('serviceWorker' in navigator) {
  let ricaricata = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (ricaricata) return
    ricaricata = true
    window.location.reload()
  })
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => registration.update(), 60 * 1000)
    },
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
