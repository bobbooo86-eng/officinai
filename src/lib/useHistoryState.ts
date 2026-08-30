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
  const [state, setState] = useState<T>(initial);

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
  }, [key]);

  return [state, setWithHistory];
}
