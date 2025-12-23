import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Types
interface User {
  id: string;
  email: string;
  name?: string;
  profession?: string;
  isAdmin?: boolean;
  avatar?: string;
  preferences?: Record<string, any>;
}

interface ModalState {
  showLoginModal: boolean;
  showRoleSelector: boolean;
  showInviteRequest: boolean;
  showProjectModal: boolean;
  showProjectCreation: boolean;
  showEmailDesigner: boolean;
  showNotifications: boolean;
  showFAQDialog: boolean;
  showQuickNotesModal: boolean;
  showVendorProductDialog: boolean;
  showEmailCenter: boolean;
  showChat: boolean;
  showPrototypeFeedback: boolean;
  showCrmDialog: boolean;
  showProjectDetailsModal: boolean;
  showEditProjectModal: boolean;
  showDeleteProjectDialog: boolean;
}

interface TabState {
  main: number;
  settings: number;
  timeline: number;
  showcase: number;
  email: number;
  worklog: number;
}

interface SelectedItems {
  project: any | null;
  client: any | null;
  equipment: any | null;
  emailContext: any | null;
}

interface UiSettings {
  proEditorMode: boolean;
  compactMode: boolean;
  darkMode: boolean;
  sidebarCollapsed: boolean;
  notifications: string[];
}

interface UniversalState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // UI state
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'admin';
  modalState: ModalState;
  tabState: TabState;
  selectedItems: SelectedItems;
  uiSettings: UiSettings;

  // Performance state
  lastActivity: number;
  isOnline: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setLoading: (loading: boolean) => void;
  setProfession: (profession: UniversalState['profession']) => void;

  // Modal actions
  updateModalState: (key: keyof ModalState, value: boolean) => void;
  closeAllModals: () => void;

  // Tab actions
  updateTabState: (key: keyof TabState, value: number) => void;

  // Selection actions
  updateSelectedItems: (key: keyof SelectedItems, value: any | null) => void;

  // UI settings actions
  updateUiSettings: (key: keyof UiSettings, value: any) => void;

  // Activity tracking
  updateActivity: () => void;
  setOnlineStatus: (online: boolean) => void;

  // Reset actions
  resetState: () => void;
}

// Initial state
const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  profession: 'photographer' as 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'admin',
  modalState: {
    showLoginModal: false,
    showRoleSelector: false,
    showInviteRequest: false,
    showProjectModal: false,
    showProjectCreation: false,
    showEmailDesigner: false,
    showNotifications: false,
    showFAQDialog: false,
    showQuickNotesModal: false,
    showVendorProductDialog: false,
    showEmailCenter: false,
    showChat: false,
    showPrototypeFeedback: false,
    showCrmDialog: false,
    showProjectDetailsModal: false,
    showEditProjectModal: false,
    showDeleteProjectDialog: false,
},
  tabState: {
    main:0,
    settings:  0,
    timeline:  0,
    showcase:  0,
    email:  0,
    worklog:  0,
},
  selectedItems: {
    project: null,
    client: null,
    equipment: null,
    emailContext: null,
},
  uiSettings: {
    proEditorMode: false,
    compactMode: false,
    darkMode: false,
    sidebarCollapsed: false,
    notifications:  [],
},
  lastActivity: Date.now(),
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
};

// Create the store
export const useUniversalStore = create<UniversalState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        ...initialState,

        // User actions
        setUser: (user) =>
          set((state) => {
            state.user = user;
            state.isAuthenticated = !!user;
            if (user?.profession) {
              state.profession = user.profession as UniversalState['profession'];
        }
        }),

        setAuthenticated: (authenticated) =>
          set((state) => {
            state.isAuthenticated = authenticated;
            if (!authenticated) {
              state.user = null;
        }
        }),

        setLoading: (loading) =>
          set((state) => {
            state.isLoading = loading;
      }),

        setProfession: (profession) =>
          set((state) => {
            state.profession = profession;
            if (state.user) {
              state.user.profession = profession;
        }
        }),

        // Modal actions
        updateModalState: (key, value) =>
          set((state) => {
            state.modalState[key] = value;
        }),

        closeAllModals: () =>
          set((state) => {
            Object.keys(state.modalState).forEach((key) => {
              (state.modalState as any)[key] = false;
        });
        }),

        // Tab actions
        updateTabState: (key, value) =>
          set((state) => {
            state.tabState[key] = value;
        }),

        // Selection actions
        updateSelectedItems: (key, value) =>
          set((state) => {
            state.selectedItems[key] = value;
        }),

        // UI settings actions
        updateUiSettings: (key, value) =>
          set((state) => {
            (state.uiSettings as any)[key] = value;
        }),

        // Activity tracking
        updateActivity: () =>
          set((state) => {
            state.lastActivity = Date.now();
      }),

        setOnlineStatus: (online) =>
          set((state) => {
            state.isOnline = online;
      }),

        // Reset actions
        resetState: () =>
          set((state) => {
            Object.assign(state, initialState);
        }),
    })),
    ),
    {
      name: 'universal-store',
      partialize: (state: UniversalState) => ({
        user: state.user,
        profession: state.profession,
        uiSettings: state.uiSettings,
    }),
  },
  ),
);

// Selectors for better performance
export const useUser = () => useUniversalStore((state) => state.user);
export const useIsAuthenticated = () => useUniversalStore((state) => state.isAuthenticated);
export const useProfession = () => useUniversalStore((state) => state.profession);
export const useModalState = () => useUniversalStore((state) => state.modalState);
export const useTabState = () => useUniversalStore((state) => state.tabState);
export const useSelectedItems = () => useUniversalStore((state) => state.selectedItems);
export const useUiSettings = () => useUniversalStore((state) => state.uiSettings);

// Action selectors
export const useUserActions = () =>
  useUniversalStore((state) => ({
    setUser: state.setUser,
    setAuthenticated: state.setAuthenticated,
    setLoading: state.setLoading,
    setProfession: state.setProfession,
}));

export const useModalActions = () =>
  useUniversalStore((state) => ({
    updateModalState: state.updateModalState,
    closeAllModals: state.closeAllModals,
}));

export const useTabActions = () =>
  useUniversalStore((state) => ({
    updateTabState: state.updateTabState,
}));

export const useSelectionActions = () =>
  useUniversalStore((state) => ({
    updateSelectedItems: state.updateSelectedItems,
}));

export const useUiActions = () =>
  useUniversalStore((state) => ({
    updateUiSettings: state.updateUiSettings,
}));

// Subscribe to online/offline status
if (typeof window !== 'undefined') {
  window.addEventListener('online, ', () => {
    useUniversalStore.getState().setOnlineStatus(true);
});

  window.addEventListener('offline', () => {
    useUniversalStore.getState().setOnlineStatus(false);
});
}

// Subscribe to user activity for session management
if (typeof window !== 'undefined') {
  const events = ['mousedown','mousemove','keypress','scroll','touchstart'];

  events.forEach((event) => {
    document.addEventListener(
      event,
      () => {
        useUniversalStore.getState().updateActivity();
    },
      true,
    );
});
}
