import { useState, useEffect, useCallback } from 'react';

/**
 * Like useState but pushes changes to browser history so the back button works.
 * When the user presses back, the state reverts to the previous value.
 * @param key - unique key to identify this state in history (e.g. 'register-step')
 * @param initial - initial value
 */
export function useHistoryState<T>(key: string, initial: T): [T, (val: T) => void] {
  const [state, setState] = useState<T>(initial);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && key in e.state) {
        setState(e.state[key]);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [key]);

  const setWithHistory = useCallback((val: T) => {
    setState(val);
    const currentState = window.history.state || {};
    window.history.pushState({ ...currentState, [key]: val }, '');
  }, [key]);

  return [state, setWithHistory];
}
