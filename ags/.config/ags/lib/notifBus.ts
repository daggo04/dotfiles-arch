// Simple event bus for cross-widget notification communication
type Listener = (appName: string) => void
const listeners: Listener[] = []

export function onExpandApp(fn: Listener) {
  listeners.push(fn)
}

export function emitExpandApp(appName: string) {
  for (const fn of listeners) {
    fn(appName)
  }
}
