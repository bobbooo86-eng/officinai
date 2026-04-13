/**
 * Universal print button — adds a floating print icon to any page.
 * When clicked, triggers window.print() on the current page.
 */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      title="Stampa pagina"
      data-print-hide
      className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-gray-800 text-white shadow-lg hover:bg-gray-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
    </button>
  );
}
