import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAcademy, type Course } from '@/contexts/AcademyContext';
import { getKV, setKV } from '@/utils/serverKV';
import { useAcademyLocale } from './academyLocale';

export type AcademyUserCenterNotificationTone = 'info' | 'attention' | 'success';

export interface AcademyUserCenterNotification {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  route: string;
  tone: AcademyUserCenterNotificationTone;
  meta?: string;
}

export interface AcademyUserCenterMessage {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  route: string;
  author: string;
  meta?: string;
}

interface AcademyUserCenterPersistedState {
  readNotificationIds: string[];
  readMessageIds: string[];
}

interface AcademyUserSettingsSnapshot {
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  desktopNotifications?: boolean;
  productUpdates?: boolean;
  twoFactorAuth?: boolean;
}

const USER_SETTINGS_KEY = 'academy_user_settings_v1';
const USER_CENTER_KEY = 'academy_user_center_v1';
const USER_SETTINGS_EVENT = 'academy-user-settings-changed';
const USER_CENTER_EVENT = 'academy-user-center-changed';

const EMPTY_CENTER_STATE: AcademyUserCenterPersistedState = {
  readNotificationIds: [],
  readMessageIds: [],
};

type CourseWithAssignments = Course & {
  assignmentStudio?: {
    assignments?: Array<{
      id?: string;
      title?: string;
      status?: string;
      dueDate?: string;
    }>;
    feedback?: Array<{
      id?: string;
      author?: string;
      recipient?: string;
      message?: string;
      timestamp?: string;
    }>;
  };
};

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizePersistedState(value: unknown): AcademyUserCenterPersistedState {
  if (!value || typeof value !== 'object') {
    return EMPTY_CENTER_STATE;
  }

  const record = value as Record<string, unknown>;
  const readNotificationIds = Array.isArray(record.readNotificationIds)
    ? record.readNotificationIds.map((entry) => String(entry)).filter(Boolean)
    : [];
  const readMessageIds = Array.isArray(record.readMessageIds)
    ? record.readMessageIds.map((entry) => String(entry)).filter(Boolean)
    : [];

  return {
    readNotificationIds,
    readMessageIds,
  };
}

function readLocalCenterState(): AcademyUserCenterPersistedState {
  if (typeof window === 'undefined') {
    return EMPTY_CENTER_STATE;
  }

  const localValue = safeParseJson<AcademyUserCenterPersistedState>(
    window.localStorage.getItem(USER_CENTER_KEY),
  );
  return normalizePersistedState(localValue);
}

function readLocalSettingsSnapshot(): AcademyUserSettingsSnapshot {
  if (typeof window === 'undefined') {
    return {};
  }

  const localValue = safeParseJson<AcademyUserSettingsSnapshot>(
    window.localStorage.getItem(USER_SETTINGS_KEY),
  );
  return localValue && typeof localValue === 'object' ? localValue : {};
}

function buildDisplayName(email: string | undefined, fallback: string): string {
  const source = String(email || '').trim();
  if (!source) return fallback;

  const base = source.includes('@') ? source.split('@')[0] : source;
  const parts = base
    .replace(/[._]+/g, '-')
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return fallback;
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function shortDateLabel(value: string, locale: 'nb-NO' | 'en-US'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function previewText(value: string, maxLength = 110): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildAssignmentRoute(courseId: string, assignmentId?: string): string {
  const params = new URLSearchParams();
  if (courseId) params.set('courseId', courseId);
  if (assignmentId) params.set('assignmentId', assignmentId);
  const query = params.toString();
  return query ? `/academy/assignments?${query}` : '/academy/assignments';
}

function asIso(value: unknown): string {
  const candidate = String(value || '').trim();
  const parsed = new Date(candidate);
  if (!candidate || Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

export function useAcademyUserCenter() {
  const auth = useAuth();
  const { state } = useAcademy();
  const { tt } = useAcademyLocale();
  const [persisted, setPersisted] = useState<AcademyUserCenterPersistedState>(() =>
    readLocalCenterState(),
  );
  const [settingsSnapshot, setSettingsSnapshot] = useState<AcademyUserSettingsSnapshot>(() =>
    readLocalSettingsSnapshot(),
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [remoteSettings, remoteCenter] = await Promise.all([
        getKV<AcademyUserSettingsSnapshot>(USER_SETTINGS_KEY),
        getKV<AcademyUserCenterPersistedState>(USER_CENTER_KEY),
      ]);

      if (cancelled) return;

      if (remoteSettings && typeof remoteSettings === 'object') {
        setSettingsSnapshot((prev) => ({ ...prev, ...remoteSettings }));
        try {
          window.localStorage.setItem(
            USER_SETTINGS_KEY,
            JSON.stringify({ ...settingsSnapshot, ...remoteSettings }),
          );
        } catch {
          // Ignore local cache write failures.
        }
      }

      if (remoteCenter && typeof remoteCenter === 'object') {
        const normalized = normalizePersistedState(remoteCenter);
        setPersisted(normalized);
        try {
          window.localStorage.setItem(USER_CENTER_KEY, JSON.stringify(normalized));
        } catch {
          // Ignore local cache write failures.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      setSettingsSnapshot(readLocalSettingsSnapshot());
      setPersisted(readLocalCenterState());
    };

    window.addEventListener(USER_SETTINGS_EVENT, sync);
    window.addEventListener(USER_CENTER_EVENT, sync);
    window.addEventListener('storage', sync);

    return () => {
      window.removeEventListener(USER_SETTINGS_EVENT, sync);
      window.removeEventListener(USER_CENTER_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const persistCenterState = useCallback(
    async (
      updater:
        | AcademyUserCenterPersistedState
        | ((previous: AcademyUserCenterPersistedState) => AcademyUserCenterPersistedState),
    ) => {
      setPersisted((previous) => {
        const next =
          typeof updater === 'function'
            ? (updater as (previous: AcademyUserCenterPersistedState) => AcademyUserCenterPersistedState)(previous)
            : updater;
        try {
          window.localStorage.setItem(USER_CENTER_KEY, JSON.stringify(next));
          window.dispatchEvent(new Event(USER_CENTER_EVENT));
        } catch {
          // Ignore local cache failures.
        }
        void setKV(USER_CENTER_KEY, next);
        return next;
      });
    },
    [],
  );

  const account = useMemo(() => {
    const authUser = auth.user;
    const rawName =
      String(settingsSnapshot.displayName || '').trim() ||
      String(authUser?.displayName || '').trim() ||
      String(authUser?.name || '').trim() ||
      buildDisplayName(authUser?.email, tt('Bruker', 'User'));
    const rawEmail =
      String(authUser?.email || '').trim() || String(settingsSnapshot.email || '').trim();
    const avatarUrl =
      String(settingsSnapshot.avatarUrl || '').trim() ||
      String(authUser?.picture || '').trim();
    const initial = rawName.charAt(0).toUpperCase() || 'U';

    return {
      isAuthenticated: Boolean(auth.isAuthenticated && auth.user),
      displayName: rawName,
      email: rawEmail,
      avatarUrl,
      initial,
      desktopNotificationsEnabled: settingsSnapshot.desktopNotifications !== false,
      productUpdatesEnabled: settingsSnapshot.productUpdates !== false,
      twoFactorAuthEnabled: Boolean(settingsSnapshot.twoFactorAuth),
    };
  }, [
    auth.isAuthenticated,
    auth.user,
    settingsSnapshot.avatarUrl,
    settingsSnapshot.desktopNotifications,
    settingsSnapshot.displayName,
    settingsSnapshot.email,
    settingsSnapshot.productUpdates,
    settingsSnapshot.twoFactorAuth,
    tt,
  ]);

  const feedbackMessages = useMemo<AcademyUserCenterMessage[]>(() => {
    const messages: AcademyUserCenterMessage[] = [];

    (state.courses as CourseWithAssignments[]).forEach((course) => {
      const feedbackItems = Array.isArray(course.assignmentStudio?.feedback)
        ? course.assignmentStudio?.feedback || []
        : [];

      feedbackItems.forEach((entry, index) => {
        const messageBody = previewText(String(entry?.message || '').trim());
        if (!messageBody) return;

        const createdAt = asIso(entry?.timestamp);
        const messageId =
          String(entry?.id || '').trim() ||
          `feedback-${course.id}-${createdAt}-${index}`;
        const author = String(entry?.author || '').trim() || tt('Instruktør', 'Instructor');

        messages.push({
          id: messageId,
          title: tt(
            `${author} ga deg ny tilbakemelding`,
            `${author} sent new feedback`,
          ),
          detail: messageBody,
          createdAt,
          route: buildAssignmentRoute(course.id),
          author,
          meta: course.title,
        });
      });
    });

    return messages.sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }, [state.courses, tt]);

  const notifications = useMemo<AcademyUserCenterNotification[]>(() => {
    const items: AcademyUserCenterNotification[] = [];

    if (!account.avatarUrl) {
      items.push({
        id: 'profile-avatar-missing',
        title: tt('Legg til profilbilde', 'Add a profile image'),
        detail: tt(
          'Profilen din mangler fortsatt et bilde. Det brukes i Academy-headeren, instruktørkort og elevopplevelsen.',
          'Your profile still has no image. It is used in the Academy header, instructor cards, and learner experience.',
        ),
        createdAt: new Date().toISOString(),
        route: '/academy/settings?tab=profile',
        tone: 'info',
        meta: tt('Profil', 'Profile'),
      });
    }

    if (!account.twoFactorAuthEnabled) {
      items.push({
        id: 'security-two-factor-off',
        title: tt('Aktiver tofaktor-autentisering', 'Enable two-factor authentication'),
        detail: tt(
          'Sikkerhetsoppsettet ditt er ikke komplett ennå. Slå på tofaktor for bedre kontobeskyttelse.',
          'Your security setup is not complete yet. Turn on two-factor authentication for better account protection.',
        ),
        createdAt: new Date().toISOString(),
        route: '/academy/settings?tab=profile',
        tone: 'attention',
        meta: tt('Sikkerhet', 'Security'),
      });
    }

    (state.courses as CourseWithAssignments[]).forEach((course) => {
      const assignments = Array.isArray(course.assignmentStudio?.assignments)
        ? course.assignmentStudio?.assignments || []
        : [];

      assignments.forEach((assignment, index) => {
        const dueDate = String(assignment?.dueDate || '').trim();
        const dueAt = new Date(dueDate);
        if (Number.isNaN(dueAt.getTime())) return;

        const daysUntilDue =
          (dueAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysUntilDue < 0 || daysUntilDue > 7) return;

        const status = String(assignment?.status || '').trim().toLowerCase();
        if (status === 'draft' || status === 'completed') return;

        const assignmentTitle =
          String(assignment?.title || '').trim() ||
          tt('Oppgave', 'Assignment');

        items.push({
          id:
            String(assignment?.id || '').trim() ||
            `assignment-due-${course.id}-${index}`,
          title: tt(
            `${assignmentTitle} nærmer seg fristen`,
            `${assignmentTitle} is getting close to deadline`,
          ),
          detail: tt(
            `Frist ${shortDateLabel(dueDate, 'nb-NO')} i ${course.title}.`,
            `Due ${shortDateLabel(dueDate, 'en-US')} in ${course.title}.`,
          ),
          createdAt: dueAt.toISOString(),
          route: buildAssignmentRoute(course.id, String(assignment?.id || '').trim() || undefined),
          tone: daysUntilDue <= 2 ? 'attention' : 'info',
          meta: course.title,
        });
      });

      if (feedbackMessages.some((message) => message.meta === course.title)) {
        const latestFeedback = feedbackMessages.find((message) => message.meta === course.title);
        if (latestFeedback) {
          items.push({
            id: `feedback-update-${course.id}`,
            title: tt('Ny feedback i Academy', 'New feedback in Academy'),
            detail: tt(
              `Du har fersk tilbakemelding i ${course.title}.`,
              `You have fresh feedback in ${course.title}.`,
            ),
            createdAt: latestFeedback.createdAt,
            route: '/academy/settings?tab=messages',
            tone: 'success',
            meta: course.title,
          });
        }
      }

      if ((auth.isAdmin || auth.isInstructor) && !course.isPublished) {
        items.push({
          id: `course-draft-${course.id}`,
          title: tt('Kursutkast trenger publisering', 'Course draft needs publishing'),
          detail: tt(
            `${course.title} er fortsatt et utkast og er ikke synlig for studenter.`,
            `${course.title} is still a draft and is not visible to learners.`,
          ),
          createdAt: asIso(course.updatedAt || course.createdAt),
          route: '/academy/curriculum',
          tone: 'info',
          meta: tt('Instruktør', 'Instructor'),
        });
      }
    });

    return items
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      )
      .reduce<AcademyUserCenterNotification[]>((acc, item) => {
        if (acc.some((existing) => existing.id === item.id)) return acc;
        acc.push(item);
        return acc;
      }, []);
  }, [
    account.avatarUrl,
    account.twoFactorAuthEnabled,
    auth.isAdmin,
    auth.isInstructor,
    feedbackMessages,
    state.courses,
    tt,
  ]);

  const readNotificationIds = useMemo(
    () => new Set(persisted.readNotificationIds),
    [persisted.readNotificationIds],
  );
  const readMessageIds = useMemo(
    () => new Set(persisted.readMessageIds),
    [persisted.readMessageIds],
  );

  const unreadNotificationCount = useMemo(
    () => notifications.filter((item) => !readNotificationIds.has(item.id)).length,
    [notifications, readNotificationIds],
  );
  const unreadMessageCount = useMemo(
    () => feedbackMessages.filter((item) => !readMessageIds.has(item.id)).length,
    [feedbackMessages, readMessageIds],
  );

  const markNotificationRead = useCallback(
    async (id: string) => {
      const normalizedId = String(id || '').trim();
      if (!normalizedId) return;

      await persistCenterState((previous) => {
        if (previous.readNotificationIds.includes(normalizedId)) {
          return previous;
        }
        return {
          ...previous,
          readNotificationIds: [...previous.readNotificationIds, normalizedId],
        };
      });
    },
    [persistCenterState],
  );

  const markMessageRead = useCallback(
    async (id: string) => {
      const normalizedId = String(id || '').trim();
      if (!normalizedId) return;

      await persistCenterState((previous) => {
        if (previous.readMessageIds.includes(normalizedId)) {
          return previous;
        }
        return {
          ...previous,
          readMessageIds: [...previous.readMessageIds, normalizedId],
        };
      });
    },
    [persistCenterState],
  );

  const markAllNotificationsRead = useCallback(async () => {
    await persistCenterState((previous) => ({
      ...previous,
      readNotificationIds: notifications.map((item) => item.id),
    }));
  }, [notifications, persistCenterState]);

  const markAllMessagesRead = useCallback(async () => {
    await persistCenterState((previous) => ({
      ...previous,
      readMessageIds: feedbackMessages.map((item) => item.id),
    }));
  }, [feedbackMessages, persistCenterState]);

  return {
    account,
    notifications,
    messages: feedbackMessages,
    readNotificationIds: persisted.readNotificationIds,
    readMessageIds: persisted.readMessageIds,
    unreadNotificationCount,
    unreadMessageCount,
    markNotificationRead,
    markMessageRead,
    markAllNotificationsRead,
    markAllMessagesRead,
  };
}
