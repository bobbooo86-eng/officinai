/**
 * wa.me richiede il numero completo con prefisso internazionale (39 per
 * l'Italia), senza "+" davanti: un numero italiano digitato senza prefisso
 * (es. "3402571805") apre una chat non valida e il messaggio non parte.
 * Unica funzione condivisa da ogni punto dell'app che apre un link wa.me,
 * cosi' il fix non deve essere ripetuto (e rischiare di essere dimenticato)
 * in ogni file che manda un messaggio WhatsApp.
 */
export function toWhatsAppNumber(tel: string): string {
  const digits = tel.replace(/\D/g, '');
  return digits.startsWith('39') ? digits : `39${digits}`;
}
