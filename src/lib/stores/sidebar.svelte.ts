const STORAGE_KEY = 'cv-sidebar-collapsed';

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Desktop sidebar collapse state (persisted) and mobile drawer state (transient). */
class SidebarStore {
  collapsed = $state(typeof window === 'undefined' ? false : readStored());
  mobileOpen = $state(false);

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    try {
      localStorage.setItem(STORAGE_KEY, this.collapsed ? '1' : '0');
    } catch {
      // ignore: preference simply will not persist
    }
  }

  openMobile(): void {
    this.mobileOpen = true;
  }

  closeMobile(): void {
    this.mobileOpen = false;
  }
}

export const sidebar = new SidebarStore();
