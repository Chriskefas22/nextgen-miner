'use client';

import { useEffect, useRef, useState } from 'react';

type TurnstileOptions = {
  sitekey: string;
  theme?: 'light' | 'dark' | 'auto';
  appearance?: 'always' | 'execute' | 'interaction-only';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
};

type TurnstileAPI = {
  render: (
    element: HTMLElement,
    options: TurnstileOptions
  ) => string;

  reset: (widgetId?: string) => void;

  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileAPI;
  }
}

type TurnstileFieldProps = {
  onToken?: (token: string) => void;
};

export function TurnstileField({
  onToken,
}: TurnstileFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const callbackRef = useRef(onToken);

  const [status, setStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading');

  useEffect(() => {
    callbackRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    const siteKey =
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    if (!siteKey) {
      setStatus('error');
      callbackRef.current?.('');
      return;
    }

    let cancelled = false;

    const renderWidget = () => {
      if (
        cancelled ||
        !containerRef.current ||
        !window.turnstile ||
        widgetIdRef.current
      ) {
        return;
      }

      try {
        widgetIdRef.current =
          window.turnstile.render(
            containerRef.current,
            {
              sitekey: siteKey,
              theme: 'dark',
              appearance: 'always',

              callback: (token: string) => {
                callbackRef.current?.(token);
              },

              'expired-callback': () => {
                callbackRef.current?.('');
              },

              'error-callback': () => {
                setStatus('error');
                callbackRef.current?.('');
              },
            }
          );

        setStatus('ready');
      } catch {
        setStatus('error');
        callbackRef.current?.('');
      }
    };

    if (window.turnstile) {
      renderWidget();
      return;
    }

    const existingScript =
      document.querySelector<HTMLScriptElement>(
        'script[data-nextgen-turnstile="true"]'
      );

    if (existingScript) {
      existingScript.addEventListener(
        'load',
        renderWidget
      );
    } else {
      const script =
        document.createElement('script');

      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

      script.async = true;
      script.defer = true;

      script.dataset.nextgenTurnstile = 'true';

      script.addEventListener(
        'load',
        renderWidget
      );

      script.addEventListener(
        'error',
        () => {
          setStatus('error');
          callbackRef.current?.('');
        }
      );

      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;

      if (
        widgetIdRef.current &&
        window.turnstile
      ) {
        try {
          window.turnstile.remove(
            widgetIdRef.current
          );
        } catch {
          // Ignore cleanup errors.
        }
      }

      widgetIdRef.current = null;
    };
  }, []);

  return (
    <div className="turnstile-field">
      <div ref={containerRef} />

      {status === 'loading' && (
        <small className="muted">
          Loading security verification…
        </small>
      )}

      {status === 'error' && (
        <div className="notice">
          Turnstile could not be loaded.
          Check the Cloudflare Site Key
          configured in Vercel.
        </div>
      )}
    </div>
  );
}
