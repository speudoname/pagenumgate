// Import the shared function
import { getApiUrl as getApiUrlShared } from './shared-utils'

// Helper to get the correct API base path for PageNumGate
export function getApiUrl(path: string): string {
  return getApiUrlShared(path, 'page-builder')
}