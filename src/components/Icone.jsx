/**
 * Icone della barra di navigazione.
 *
 * Prima erano i caratteri Unicode ⬡ ◈ ◷ ◍ ◎: non sono icone, sono glifi
 * tipografici. Rendono diversi su ogni telefono, alcuni Android li disegnano
 * con lo spessore sbagliato, e sembrano segnaposto in attesa di quelle vere.
 *
 * Disegnate tutte sulla stessa griglia 24×24 con lo stesso spessore, così in
 * fila hanno lo stesso peso ottico. `currentColor` le fa seguire il colore del
 * contenitore, quindi obbediscono al token --accento come tutto il resto.
 */

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
}

export function IconaHome({ size = 23 }) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  )
}

export function IconaSchede({ size = 23 }) {
  return (
    <svg {...base} width={size} height={size}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h4" />
    </svg>
  )
}

export function IconaTurni({ size = 23 }) {
  return (
    <svg {...base} width={size} height={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.5l3.5 2" />
    </svg>
  )
}

export function IconaAtleti({ size = 23 }) {
  return (
    <svg {...base} width={size} height={size}>
      <circle cx="9.5" cy="8" r="3.4" />
      <path d="M3.5 20c0-3.3 2.7-5.6 6-5.6s6 2.3 6 5.6" />
      <path d="M17 11.2a2.6 2.6 0 1 0-1.6-4.7" />
      <path d="M18 20c0-2.2-.6-3.9-1.7-5" />
    </svg>
  )
}

/**
 * Ingranaggio delle impostazioni.
 *
 * Prima era un cerchietto con otto raggi: sullo schermo si leggeva come un
 * sole, cioè come la luminosità, non come le impostazioni.
 *
 * Sei denti e non otto: a 23px, che è la misura vera nella barra, gli otto
 * denti si impastano e restano una macchia tonda. Con sei i denti hanno lo
 * spazio per vedersi anche in grigio, quando la voce è spenta.
 */
export function IconaImpostazioni({ size = 23 }) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M21.74 9.75L21.74 14.25L18.48 14.36L17.29 16.44L18.82 19.31L14.92 21.56L13.2 18.8L10.8 18.8L9.08 21.56L5.18 19.31L6.71 16.44L5.52 14.36L2.26 14.25L2.26 9.75L5.52 9.64L6.71 7.56L5.18 4.69L9.08 2.44L10.8 5.2L13.2 5.2L14.92 2.44L18.82 4.69L17.29 7.56L18.48 9.64Z" />
      <circle cx="12" cy="12" r="2.9" />
    </svg>
  )
}

/**
 * Occhio per mostrare/nascondere la password.
 * Prima era la sequenza emoji 👁‍🗨, che ha un supporto pessimo: su molti
 * dispositivi si spezza e si vede un occhio seguito da un fumetto.
 */
export function IconaOcchio({ size = 20, barrato = false }) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.8" />
      {barrato && <path d="M4 20 20 4" />}
    </svg>
  )
}
