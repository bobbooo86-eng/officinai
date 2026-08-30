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
if ('serviceWorker' in navigator) {
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
