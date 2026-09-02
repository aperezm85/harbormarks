import * as React from "react"

// A localStorage key is an external store, so read it through
// useSyncExternalStore rather than mirroring it into state. The server snapshot
// is always null, so the first client render matches the server-rendered markup
// and the stored value syncs in after hydration instead of causing a mismatch.
function subscribeToKey(key: string, onChange: () => void) {
  const handler = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      onChange()
      }
    }

  window.addEventListener("storage", handler)

  return () => window.removeEventListener("storage", handler)
}

export function useLocalStorageValue(key: string) {
  return React.useSyncExternalStore(
     (onChange: () => void) => subscribeToKey(key, onChange),
     () => window.localStorage.getItem(key),
     () => null,
     )
}

