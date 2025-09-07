// Simple logger that only logs in development
const isDev = process.env.NODE_ENV === 'development'

export const logger = {
  log: (...args: any[]) => {
    if (isDev) {
      console.log('[PageNumGate]', ...args)
    }
  },
  info: (...args: any[]) => {
    if (isDev) {
      console.info('[PageNumGate Info]', ...args)
    }
  },
  debug: (...args: any[]) => {
    if (isDev) {
      console.debug('[PageNumGate Debug]', ...args)
    }
  },
  error: (...args: any[]) => {
    if (isDev) {
      console.error('[PageNumGate Error]', ...args)
    }
  },
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn('[PageNumGate Warning]', ...args)
    }
  }
}