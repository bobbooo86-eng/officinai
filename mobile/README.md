# OfficinAI Mobile

App mobile per la gestione dell'officina, costruita con React Native e Expo.

## Prerequisiti

- **Node.js** >= 18
- **Expo CLI**: `npm install -g expo-cli`
- **Expo Go** installato sul dispositivo fisico (iOS/Android) oppure un emulatore configurato
- Per build iOS: macOS con Xcode installato
- Per build Android: Android Studio con un emulatore configurato

## Installazione

```bash
cd officinai-mobile
npm install
```

## Avvio in sviluppo

```bash
# Avvia il server di sviluppo Expo
npx expo start

# Avvia direttamente su iOS
npx expo start --ios

# Avvia direttamente su Android
npx expo start --android
```

Scansiona il QR code con l'app Expo Go sul tuo dispositivo oppure premi `i` per iOS o `a` per Android nell'emulatore.

## Variabili d'ambiente

Per sovrascrivere le credenziali Supabase di default, crea un file `.env` nella root del progetto:

```
EXPO_PUBLIC_SUPABASE_URL=https://tuo-progetto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=la-tua-chiave-anon
```

## Build di produzione

```bash
# Installa EAS CLI
npm install -g eas-cli

# Login su Expo
eas login

# Build per iOS
eas build --platform ios

# Build per Android
eas build --platform android
```

## Struttura del progetto

```
officinai-mobile/
  app/
    _layout.tsx          # Layout root con autenticazione
    (auth)/
      login.tsx          # Schermata di login
    (tabs)/
      _layout.tsx        # Navigazione a tab
      index.tsx          # Home / Dashboard
      agenda.tsx         # Agenda appuntamenti
      calendario.tsx     # Calendario mensile
      clienti.tsx        # Rubrica clienti
      altro.tsx          # Impostazioni e logout
  lib/
    supabase.ts          # Client Supabase per React Native
  assets/                # Icone e immagini
```
