const TURNSTILE_SITE_KEY = await (async () => {
  try {
    const response = await fetch('/api/public-config', {
      cache: 'no-store'
    });

    if (!response.ok) return '';

    const data = await response.json();

    return typeof data.turnstileSiteKey === 'string'
      ? data.turnstileSiteKey
      : '';
  } catch {
    return '';
  }
})();

export const CONFIG = {
  SUPABASE_URL: 'https://mmqprhuvhghyuvudsyma.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_T5VIaE38Qx8VmzBOJQSODg_b_2WfWu6',
  TURNSTILE_SITE_KEY,
  CURRENCY: 'USD'
};

// Lightweight visual performance layer.
if (typeof document !== 'undefined') {
  const loadPerformanceCss = () => {
    if (document.querySelector('link[data-ng-performance]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/performance.css';
    link.dataset.ngPerformance = '1';
    document.head.appendChild(link);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPerformanceCss, { once: true });
  } else {
    loadPerformanceCss();
  }
}
