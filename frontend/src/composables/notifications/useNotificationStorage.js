function notificationsStorageKey(userId, keyPrefix) {
  return `${keyPrefix}-${userId || "anon"}`;
}

function notificationsUnreadStorageKey(userId, keyPrefix) {
  return `${keyPrefix}-${userId || "anon"}`;
}

function saveNotificationsState({
  state,
  userId,
  notificationsKeyPrefix,
  notificationsUnreadKeyPrefix,
  limit,
  storage = localStorage,
}) {
  if (!userId) return;

  const safeList = Array.isArray(state.notifications)
    ? state.notifications.slice(0, limit)
    : [];

  storage.setItem(
    notificationsStorageKey(userId, notificationsKeyPrefix),
    JSON.stringify(safeList),
  );
  storage.setItem(
    notificationsUnreadStorageKey(userId, notificationsUnreadKeyPrefix),
    String(Number(state.notificationsUnread || 0)),
  );
}

function restoreNotificationsState({
  userId,
  notificationsKeyPrefix,
  notificationsUnreadKeyPrefix,
  limit,
  storage = localStorage,
}) {
  if (!userId) {
    return { notifications: [], notificationsUnread: 0 };
  }

  let notifications = [];
  try {
    const rawNotifications = storage.getItem(
      notificationsStorageKey(userId, notificationsKeyPrefix),
    );
    const parsed = JSON.parse(rawNotifications || "[]");
    notifications = Array.isArray(parsed)
      ? parsed
          .filter((n) => n && typeof n === "object" && n.id)
          .slice(0, limit)
      : [];
  } catch {
    notifications = [];
  }

  const notificationsUnread = Number(
    storage.getItem(
      notificationsUnreadStorageKey(userId, notificationsUnreadKeyPrefix),
    ) || 0,
  );

  return { notifications, notificationsUnread };
}

export {
  notificationsStorageKey,
  notificationsUnreadStorageKey,
  restoreNotificationsState,
  saveNotificationsState,
};
