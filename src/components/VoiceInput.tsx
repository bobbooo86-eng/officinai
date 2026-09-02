import { useRef, useState } from 'react';

/** Riconoscimento vocale in italiano (Web Speech API): un solo risultato per
 * sessione, non parziali. Non supportato ovunque (soprattutto Firefox
 * desktop) — il chiamante lo gestisce nascondendo il tasto (vedi VoiceButton). */
function useVoiceInput(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  const start = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'it-IT';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      onResult(text);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const stop = () => {
    recRef.current?.stop();
    setListening(false);
  };

  return { listening, start, stop, supported: !!(typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) };
}

/** Tasto microfono da affiancare a un campo di testo: detta e passa il testo
 * riconosciuto a onResult (il chiamante decide se sostituire o aggiungere al
 * contenuto esistente). Si nasconde da solo se il browser non supporta il
 * riconoscimento vocale, invece di mostrare un tasto che non funzionerebbe. */
export function VoiceButton({ onResult, className }: { onResult: (text: string) => void; className?: string }) {
  const { listening, start, stop, supported } = useVoiceInput(onResult);
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
        listening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      } ${className || ''}`}
      title={listening ? 'Stop registrazione' : 'Parla per inserire'}
    >
      <span className="text-sm">{listening ? '⏹' : '🎤'}</span>
    </button>
  );
}
