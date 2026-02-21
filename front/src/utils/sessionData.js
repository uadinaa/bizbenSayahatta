const USER_DATA_KEYS = [
  "username",
  "avatar",
  "cover",
  "email",
  "travelStyle",
  "travelPlaces",
];

const USER_DATA_PREFIXES = ["travelPlaces:"];

function parseJwtPayload(token) {
  if (!token) return null;

  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;

    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getSessionIdentityFromToken(token) {
  const payload = parseJwtPayload(token);
  return payload?.user_id || payload?.sub || payload?.email || null;
}

export function clearClientUserData() {
  USER_DATA_KEYS.forEach((key) => localStorage.removeItem(key));

  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;

    if (USER_DATA_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

export function resetClientUserDataOnSessionChange(nextAccessToken) {
  const prevToken = localStorage.getItem("access");
  const prevIdentity = getSessionIdentityFromToken(prevToken);
  const nextIdentity = getSessionIdentityFromToken(nextAccessToken);

  if (!prevIdentity || !nextIdentity || prevIdentity !== nextIdentity) {
    clearClientUserData();
  }
}

export function getScopedStorageKey(baseKey) {
  const token = localStorage.getItem("access");
  const identity = getSessionIdentityFromToken(token);
  return identity ? `${baseKey}:${identity}` : `${baseKey}:guest`;
}
