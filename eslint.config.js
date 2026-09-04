import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['dist/**', 'dev-dist/**', 'node_modules/**'] },

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // Le variabili non usate sono il segnale più affidabile di codice morto:
      // erano loro a tradire `isCIR`/`isSS` e `currentReps` rimasti in giro.
      'no-unused-vars': ['warn', {
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^_',
        caughtErrors: 'none', // i catch senza binding sono usati apposta
      }],

      // Le dipendenze mancanti negli useEffect qui sono deliberate (caricamenti
      // una tantum al montaggio): segnalarle come errori bloccherebbe senza
      // motivo, ma vale la pena vederle.
      'react-hooks/exhaustive-deps': 'warn',

      // Regole di era React Compiler. Colpiscono il modo in cui TUTTE le pagine
      // caricano i dati (setState dentro un effect, mutazioni durante il render):
      // adeguarsi vuol dire riscrivere il caricamento ovunque. È una direzione
      // architetturale legittima, non un difetto — quindi restano visibili come
      // avvisi invece di bloccare il lint di un'app che funziona.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },

  {
    files: ['**/*.test.js'],
    languageOptions: { globals: { ...globals.node } },
  },

  {
    // Le funzioni in api/ girano su Node (serverless di Vercel), non nel
    // browser: hanno process e non hanno window.
    files: ['api/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
]
