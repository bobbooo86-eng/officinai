import { supabase } from '@/lib/supabase';

/** Legge le chiavi dei promemoria (scadenze/crediti) che il titolare ha
 * nascosto dalla Home per questa officina. */
export async function leggiPromemoriaNascosti(officinaId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('promemoria_nascosti')
    .select('chiave')
    .eq('officina_id', officinaId);
  return new Set((data || []).map((r) => r.chiave));
}

/** Nasconde un promemoria dalla Home (non tocca il dato vero: la scadenza
 * resta sul veicolo, il credito resta sull'appuntamento). Idempotente. */
export async function nascondiPromemoria(officinaId: string, chiave: string): Promise<boolean> {
  const { error } = await supabase
    .from('promemoria_nascosti')
    .upsert({ officina_id: officinaId, chiave }, { onConflict: 'officina_id,chiave' });
  return !error;
}
