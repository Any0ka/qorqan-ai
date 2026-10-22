import { useEffect, useRef, useState } from 'react';
import { useCheckPreview } from '@/api/hooks';
import type { CheckPreview, Purchase } from '@/api/types';

/** «Предварительно»: recalculated (debounced) on every change of the form. Stale answers are dropped. */
export function usePreview(purchase: Purchase | null, delay = 350) {
  const { mutateAsync } = useCheckPreview();
  const run = useRef(mutateAsync);
  run.current = mutateAsync;
  const seq = useRef(0);
  const [data, setData] = useState<CheckPreview | null>(null);
  const [pending, setPending] = useState(false);
  const key = purchase ? JSON.stringify(purchase) : '';

  useEffect(() => {
    const id = ++seq.current;
    if (!purchase) {
      setData(null);
      setPending(false);
      return;
    }
    setPending(true);
    const timer = window.setTimeout(() => {
      run.current(purchase).then(
        (d) => {
          if (id !== seq.current) return;
          setData(d);
          setPending(false);
        },
        () => {
          if (id === seq.current) setPending(false);
        },
      );
    }, delay);
    return () => window.clearTimeout(timer);
    // `key` stands for the purchase contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, delay]);

  return { data, pending };
}
