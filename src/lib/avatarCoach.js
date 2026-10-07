/**
 * L'immagine accanto al nome del coach.
 *
 * Due coach che si guardano da una schermata di nomi scritti tutti uguali
 * devono poter riconoscere il proprio al volo, anche senza leggere. Un segno
 * colorato si vede prima di una parola.
 *
 * Chi sceglie un'emoji vede quella; chi non sceglie niente vede la propria
 * iniziale. Così funziona dal primo istante, senza che nessuno debba fare
 * niente, e diventa personale quando ne hanno voglia.
 *
 * Perché non le icone disegnate come quelle della barra: lì le emoji erano
 * state scartate apposta — «non sono icone, sono glifi tipografici», e in
 * fila con le altre si vedeva. Qui il lavoro è diverso: serve un segno
 * personale, scelto, e ogni coach ne ha uno solo. Che su Android il muscolo
 * sia disegnato un po' diverso che su iPhone non cambia niente, perché non
 * deve stare in riga con nient'altro.
 *
 * Dieci e non quaranta: scegliere fra quaranta faccine è un'altra cosa da
 * fare, non un regalo.
 */

export const EMOJI_COACH = ['💪', '🏋️', '🥊', '🔥', '⭐', '🎯', '🦁', '🐻', '🚀', '🏆']

/**
 * Cosa mostrare nel cerchio: { tipo: 'emoji' | 'iniziale', valore }.
 *
 * Prima della migrazione la colonna `emoji` non esiste e arriva `undefined`:
 * si cade sull'iniziale, che è esattamente il comportamento voluto.
 */
export function avatarDi(coach) {
  const emoji = (coach?.emoji || '').trim()
  if (emoji) return { tipo: 'emoji', valore: emoji }

  const fonte = (coach?.name || coach?.email || '').trim()
  // Lo spread e non [0]: un nome che comincia con un carattere composto
  // verrebbe tagliato a metà e si vedrebbe un simbolo rotto.
  const lettera = [...fonte][0]
  return { tipo: 'iniziale', valore: lettera ? lettera.toUpperCase() : '?' }
}
