import { useState, useEffect, useCallback } from 'react';

/**
 * Like useState but pushes changes to browser history so the back button works.
 * When the user presses back, the state reverts to the previous value.
 * @param key - unique key to identify this state in history (e.g. 'register-step')
 * @param initial - initial value
 */
export function useHistoryState<T>(
  key: string,
  initial: T,
  /**
   * Convalida un valore che arriva dalla cronologia del browser. Voci create
   * da versioni precedenti dell'app possono contenere valori non piu' validi
   * (es. una tab rimossa), che altrimenti lascerebbero la pagina vuota.
   */
  isValid?: (val: unknown) => boolean
): [T, (val: T) => void] {
  const storageKey = `hs:${key}`;

  const leggiSessionStorage = (): T | undefined => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch {
      return undefined;
    }
  };

  // Un refresh di pagina (F5, chiudi/riapri l'app) rimonta il componente da
  // zero. window.history.state di solito sopravvive e basta, ma non sempre:
  // nelle PWA installate su Android il "tira per aggiornare" puo' comportarsi
  // come un avvio nuovo invece che come un reload, azzerando history.state.
  // sessionStorage invece resta sempre finche' non si chiude davvero la
  // scheda/app, quindi e' il ripiego che tiene la tab giusta in ogni caso.
  const [state, setState] = useState<T>(() => {
    const fromHistory = (window.history.state as Record<string, unknown> | null)?.[key];
    if (fromHistory !== undefined && (!isValid || isValid(fromHistory))) {
      return fromHistory as T;
    }
    const fromSession = leggiSessionStorage();
    if (fromSession !== undefined && (!isValid || isValid(fromSession))) {
      return fromSession;
    }
    return initial;
  });

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && key in e.state) {
        const next = e.state[key];
        if (isValid && !isValid(next)) {
          setState(initial);
          return;
        }
        setState(next);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setWithHistory = useCallback((val: T) => {
    setState(val);
    const currentState = window.history.state || {};
    window.history.pushState({ ...currentState, [key]: val }, '');
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(val));
    } catch {
      // storage pieno o bloccato (es. navigazione privata): non deve
      // bloccare il cambio di tab, resta solo il ripiego su history.state.
    }
  }, [key, storageKey]);

  return [state, setWithHistory];
}
