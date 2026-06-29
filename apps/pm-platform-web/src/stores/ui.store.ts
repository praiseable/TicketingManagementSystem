import { create } from 'zustand';

type Theme = 'light' | 'dark';
interface UiState { sidebarOpen: boolean; commandOpen: boolean; theme: Theme; desktopNotifications: boolean; toggleSidebar: () => void; setCommandOpen: (open: boolean) => void; toggleTheme: () => void; }
export const useUiStore = create<UiState>((set, get) => ({
  sidebarOpen: true,
  commandOpen: false,
  theme: (localStorage.getItem('theme') as Theme) || 'light',
  desktopNotifications: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setCommandOpen: (open) => set({ commandOpen: open }),
  toggleTheme: () => { const next = get().theme === 'dark' ? 'light' : 'dark'; document.documentElement.classList.toggle('dark', next === 'dark'); localStorage.setItem('theme', next); set({ theme: next }); }
}));
