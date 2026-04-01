import { useCallback, useEffect, useState } from 'react';
import {
  CREATORHUB_AUTH_TOKEN_KEY,
  CREATORHUB_AUTH_USER_KEY,
  CREATORHUB_GOOGLE_LOGIN_ERROR_KEY,
  consumeCreatorHubGoogleLoginError,
  readCreatorHubSessionSnapshot,
  type CreatorHubSessionSnapshot,
} from '@/lib/creatorhubGoogleAuth';

type CreatorHubStoredSession = CreatorHubSessionSnapshot & {
  googleLoginError: string | null;
  clearGoogleLoginError: () => void;
};

export function useCreatorHubStoredSession(): CreatorHubStoredSession {
  const [snapshot, setSnapshot] = useState<CreatorHubSessionSnapshot>(() =>
    readCreatorHubSessionSnapshot(),
  );
  const [googleLoginError, setGoogleLoginError] = useState<string | null>(() =>
    consumeCreatorHubGoogleLoginError(),
  );

  const syncSnapshot = useCallback(() => {
    setSnapshot(readCreatorHubSessionSnapshot());
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
  };
}
