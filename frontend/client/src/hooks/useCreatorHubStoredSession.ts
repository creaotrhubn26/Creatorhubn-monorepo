import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CREATORHUB_AUTH_TOKEN_KEY,
  CREATORHUB_AUTH_USER_KEY,
  CREATORHUB_GOOGLE_LOGIN_ERROR_KEY,
  consumeCreatorHubGoogleLoginError,
  readCreatorHubSessionSnapshot,
  validateCreatorHubStoredSession,
  type CreatorHubSessionSnapshot,
} from '@/lib/creatorhubGoogleAuth';

type CreatorHubStoredSession = CreatorHubSessionSnapshot & {
  googleLoginError: string | null;
  clearGoogleLoginError: () => void;
  isValidating: boolean;
};

export function useCreatorHubStoredSession(): CreatorHubStoredSession {
  const [snapshot, setSnapshot] = useState<CreatorHubSessionSnapshot>(() =>
    readCreatorHubSessionSnapshot(),
  );
  const [isValidating, setIsValidating] = useState<boolean>(() =>
    Boolean(readCreatorHubSessionSnapshot().token),
  );
  const [googleLoginError, setGoogleLoginError] = useState<string | null>(() =>
    consumeCreatorHubGoogleLoginError(),
  );
  const validationRequestRef = useRef(0);

  const syncSnapshot = useCallback((options?: { validate?: boolean }) => {
    const nextSnapshot = readCreatorHubSessionSnapshot();
    setSnapshot(nextSnapshot);

    if (options?.validate === false || !nextSnapshot.token) {
      validationRequestRef.current += 1;
      setIsValidating(false);
      return;
    }

    const requestId = validationRequestRef.current + 1;
    validationRequestRef.current = requestId;
    setIsValidating(true);
    void validateCreatorHubStoredSession()
      .then((validatedSnapshot) => {
        if (validationRequestRef.current === requestId) {
          setSnapshot(validatedSnapshot);
        }
      })
      .finally(() => {
        if (validationRequestRef.current === requestId) {
          setIsValidating(false);
        }
      });
  }, []);

  const clearGoogleLoginError = useCallback(() => {
    setGoogleLoginError(null);
  }, []);

  useEffect(() => {
    syncSnapshot();

    const handleAuthChanged = () => {
      syncSnapshot();
      const pendingError = consumeCreatorHubGoogleLoginError();
      if (pendingError) {
        setGoogleLoginError(pendingError);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === CREATORHUB_AUTH_TOKEN_KEY ||
        event.key === CREATORHUB_AUTH_USER_KEY
      ) {
        syncSnapshot();
      }

      if (event.key === CREATORHUB_GOOGLE_LOGIN_ERROR_KEY) {
        const pendingError = consumeCreatorHubGoogleLoginError();
        if (pendingError) {
          setGoogleLoginError(pendingError);
        }
      }
    };

    window.addEventListener('auth-changed', handleAuthChanged);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleAuthChanged);
    window.addEventListener('pageshow', handleAuthChanged);

    return () => {
      window.removeEventListener('auth-changed', handleAuthChanged);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleAuthChanged);
      window.removeEventListener('pageshow', handleAuthChanged);
    };
  }, [syncSnapshot]);

  return {
    ...snapshot,
    googleLoginError,
    clearGoogleLoginError,
    isValidating,
  };
}
