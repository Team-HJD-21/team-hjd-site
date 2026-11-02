export function faviconLinks(assets = 'assets/', variant = 'teamhjd') {
  const base = `${assets}favicons/v1/${variant}/`;
  return `<link rel="icon" href="${base}favicon.ico" sizes="16x16 32x32 48x48"><link rel="icon" type="image/png" sizes="32x32" href="${base}favicon-32.png"><link rel="icon" type="image/svg+xml" sizes="any" href="${base}favicon.svg"><link rel="apple-touch-icon" sizes="180x180" href="${base}apple-touch-icon.png">`;
}
