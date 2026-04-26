import * as Notifications from 'expo-notifications';

/** Lead time labels supported by the reminder UI. */
export type ReminderLeadTime = '10m' | '30m' | '1h' | '3h' | '1d';

/** Map a lead-time label to an absolute number of milliseconds. */
const LEAD_TIME_MS: Record<ReminderLeadTime, number> = {
  '10m': 10 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '3h': 3 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

const LEAD_TIME_LABEL_JA: Record<ReminderLeadTime, string> = {
  '10m': '10分前',
  '30m': '30分前',
  '1h': '1時間前',
  '3h': '3時間前',
  '1d': '1日前',
};

export const ALL_LEAD_TIMES: readonly ReminderLeadTime[] = [
  '10m',
  '30m',
  '1h',
  '3h',
  '1d',
];

export const leadTimeLabel = (lt: ReminderLeadTime): string => LEAD_TIME_LABEL_JA[lt];

/**
 * Configure the foreground notification handler. Should be called once at app
 * launch (e.g. in the root layout module top-level) so banners appear even
 * when the app is in the foreground.
 */
export const configureNotificationHandler = (): void => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // SDK 54+ split shouldShowAlert into shouldShowBanner + shouldShowList,
      // but the type still requires the legacy field for back-compat.
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
};

/**
 * Ask the OS for notification permissions. Returns true when the user granted
 * (or had previously granted) permission. iOS-only; Android always returns true
 * for our use case but we keep the same surface.
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowSound: true,
      allowBadge: false,
    },
  });
  return next.granted;
};

export type ScheduleAuctionRemindersOpts = {
  itemId: string;
  itemName: string;
  /** ISO timestamp of when the auction ends. */
  auctionEndsAt: string;
  /** Lead times before `auctionEndsAt` at which to fire reminders. */
  leadTimes: readonly ReminderLeadTime[];
};

export type ScheduledReminder = {
  notificationId: string;
  /** ISO timestamp when this reminder fires. */
  remindAt: string;
  leadTime: ReminderLeadTime;
};

/**
 * Schedule one local notification per lead time. Lead times that resolve to a
 * past timestamp are silently skipped (no point firing immediately for an
 * already-ended auction). Returns the scheduled reminders so the caller can
 * persist them.
 */
export const scheduleAuctionReminders = async (
  opts: ScheduleAuctionRemindersOpts,
): Promise<ScheduledReminder[]> => {
  const endMs = new Date(opts.auctionEndsAt).getTime();
  if (Number.isNaN(endMs)) {
    throw new Error(`Invalid auctionEndsAt: ${opts.auctionEndsAt}`);
  }
  const now = Date.now();
  const scheduled: ScheduledReminder[] = [];
  for (const lt of opts.leadTimes) {
    const triggerMs = endMs - LEAD_TIME_MS[lt];
    if (triggerMs <= now) continue; // skip past lead times
    // eslint-disable-next-line no-await-in-loop -- sequential to keep ordering deterministic
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `終了まで${LEAD_TIME_LABEL_JA[lt]}: ${opts.itemName}`,
        body: '入札 / 様子見の判断をしましょう。',
        data: { itemId: opts.itemId, leadTime: lt },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(triggerMs),
      },
    });
    scheduled.push({
      notificationId: id,
      remindAt: new Date(triggerMs).toISOString(),
      leadTime: lt,
    });
  }
  return scheduled;
};

/** Cancel one or more previously-scheduled reminders by their identifier. */
export const cancelReminders = async (notificationIds: readonly string[]): Promise<void> => {
  for (const id of notificationIds) {
    // eslint-disable-next-line no-await-in-loop -- sequential keeps API simple
    await Notifications.cancelScheduledNotificationAsync(id);
  }
};
