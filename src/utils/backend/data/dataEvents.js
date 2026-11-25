const listeners = new Set()
let revision = 0
export const subscribeData = listener => { listeners.add(listener); return () => listeners.delete(listener) }
export const getDataRevision = () => revision
export const notifyData = (key = '*') => {
  revision++
  for (const listener of listeners) listener(key)
}
