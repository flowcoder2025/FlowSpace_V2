import { create } from "zustand";

interface SpaceItem {
  id: string;
  name: string;
  description: string | null;
  accessType: string;
  inviteCode: string;
  template: { key: string; name: string };
  maxUsers: number;
  memberCount: number;
  myRole: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  createdAt: string;
}

interface SpaceStore {
  spaces: SpaceItem[];
  isLoading: boolean;
  filter: "all" | "owned" | "joined";

  setSpaces: (spaces: SpaceItem[]) => void;
  addSpace: (space: SpaceItem) => void;
  removeSpace: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setFilter: (filter: "all" | "owned" | "joined") => void;
  fetchSpaces: () => Promise<void>;
}

export const useSpaceStore = create<SpaceStore>((set, get) => ({
  spaces: [],
  isLoading: false,
  filter: "all",

  setSpaces: (spaces) => set({ spaces }),
  addSpace: (space) => set((s) => ({ spaces: [space, ...s.spaces] })),
  removeSpace: (id) =>
    set((s) => ({ spaces: s.spaces.filter((sp) => sp.id !== id) })),
  setLoading: (isLoading) => set({ isLoading }),
  setFilter: (filter) => {
    set({ filter });
    get().fetchSpaces();
  },

  fetchSpaces: async () => {
    set({ isLoading: true });
    try {
      const { filter } = get();
      const params = filter !== "all" ? `?filter=${filter}` : "";
      const res = await fetch(`/api/spaces${params}`);
      if (res.ok) {
        const data = await res.json();
        set({ spaces: data.spaces });
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));
