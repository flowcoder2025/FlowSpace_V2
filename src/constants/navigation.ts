export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  MY_SPACES: "/my-spaces",
  SPACES_NEW: "/spaces/new",
  ASSETS: "/assets",
  SPACE: (id: string) => `/space/${id}`,
  DASHBOARD: (id: string) => `/dashboard/spaces/${id}`,
  DASHBOARD_MEMBERS: (id: string) => `/dashboard/spaces/${id}/members`,
  DASHBOARD_MESSAGES: (id: string) => `/dashboard/spaces/${id}/messages`,
  DASHBOARD_LOGS: (id: string) => `/dashboard/spaces/${id}/logs`,
  DASHBOARD_ANALYTICS: (id: string) => `/dashboard/spaces/${id}/analytics`,
  DASHBOARD_SETTINGS: (id: string) => `/dashboard/spaces/${id}/settings`,
} as const;

export const NAV_ITEMS = [
  { label: "Spaces", href: ROUTES.MY_SPACES },
  { label: "Assets", href: ROUTES.ASSETS },
] as const;

export const NAVBAR_HIDDEN_ROUTES = ["/space/"] as const;
