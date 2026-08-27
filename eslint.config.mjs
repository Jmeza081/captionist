import next from 'eslint-config-next'
import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'blob-report/**',
      'docs/repomix-output.xml',
      // The design as delivered — vendored reference material, not source.
      // support.js in particular is a generated runtime bundle.
      'design/**',
    ],
  },
  ...next,
  ...coreWebVitals,
  ...typescript,
]

export default config
