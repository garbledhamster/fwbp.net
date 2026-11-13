const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <meta name="description" content="The Fishing with Bryan merch shop is getting ready to open.">
  <link rel="icon" href="https://fwbp.net/assets/branding/underwater-stamp-favicon.ico">
  <link rel="stylesheet" href="https://fwbp.net/styles.css">
  <link rel="stylesheet" href="https://fwbp.net/assets/section-pages.css">
  <title>Fishing with Bryan Shop</title>
</head>
<body>
  <header class="mast">
    <div class="mast-inner">
      <a class="brand" href="https://fwbp.net/">
        <img src="https://fwbp.net/assets/branding/underwater-stamp.svg" width="34" height="34" alt="">
        Fishing with Bryan
      </a>
    </div>
  </header>
  <main class="wrap section-page">
    <h1>Fishing with Bryan Shop</h1>
    <p>We’re getting the clothing shop ready. Ordering will open once we’ve confirmed what we can ship.</p>
    <img src="https://fwbp.net/assets/merch/classic-tee.jpg" width="512" height="512" style="max-width: min(100%, 18rem)" alt="Bryan’s original FWBP Classic shirt in burgundy">
    <a class="button primary" href="https://fwbp.net/merch/">See Bryan’s original merch</a>
  </main>
</body>
</html>`;

export default {
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== '/') return new Response('Not found', { status: 404 });
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    return new Response(request.method === 'HEAD' ? null : page, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
};
