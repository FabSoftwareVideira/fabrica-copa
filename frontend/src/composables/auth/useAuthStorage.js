function parseStoredUser(storage = localStorage) {
  const raw = storage.getItem("album-user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persistAuthState(state, storage = localStorage) {
  if (state.accessToken) {
    storage.setItem("album-access-token", state.accessToken);
  } else {
    storage.removeItem("album-access-token");
  }

  if (state.refreshToken) {
    storage.setItem("album-refresh-token", state.refreshToken);
  } else {
    storage.removeItem("album-refresh-token");
  }

  if (state.user) {
    storage.setItem("album-user", JSON.stringify(state.user));
  } else {
    storage.removeItem("album-user");
  }
}

export { parseStoredUser, persistAuthState };
