export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  MY_SPACES: "/my-spaces",
  SPACES_NEW: "/spaces/new",
  ASSETS: "/assets",
  ASSETS_GENERATE: "/assets/generate",
  ASSETS_STUDIO: "/assets/studio",
  SPACE: (id: string) => `/space/${id}`,
} as const;

export const NAV_ITEMS = [
  { label: "Spaces", href: ROUTES.MY_SPACES },
  { label: "Assets", href: ROUTES.ASSETS },
  { label: "Studio", href: ROUTES.ASSETS_STUDIO },
] as const;

export const NAVBAR_HIDDEN_ROUTES = ["/space/"] as const;
