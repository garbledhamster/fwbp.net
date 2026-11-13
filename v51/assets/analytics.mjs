const measurementId = 'G-LNHS8KS4GL';

// Review archives and local previews share these assets with the live site.
if (location.hostname === 'fwbp.net' && !/^\/v\d+(?:\/|$)/.test(location.pathname)) {
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }

  gtag('js', new Date());
  gtag('config', measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(script);
}
