/**
 * Universal print button — icona nella barra in alto, accanto alla
 * campana delle notifiche. Al click lancia window.print() sulla pagina
 * corrente.
 */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      title="Stampa pagina"
      data-print-hide
      className="w-9 h-9 rounded-full bg-gray-800 text-white shadow-sm hover:bg-gray-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center shrink-0"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
    </button>
  );
}
