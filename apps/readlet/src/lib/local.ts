/**
 * `localStorage`, for the things that belong to a device rather than to a
 * user.
 *
 * Reading positions and marks belong to a user and go to the library.
 * Display preferences belong to the screen being read on and stay here.
 *
 * Both calls swallow their failures. Private browsing throws on access rather
 * than returning nothing, and a reader that cannot remember where it was is
 * still a reader — it just starts at the beginning.
 */

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Nothing is remembered, and nothing else is affected.
  }
}
