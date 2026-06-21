import { create } from "zustand";

interface SpaceItem {
  id: string;
  name: string;
  description: string | null;
  accessType: string;
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
  isLoadingMore: boolean;
  filter: "all" | "owned" | "joined";
  nextCursor: string | null;
  hasMore: boolean;
  /**
   * 진행 중 요청 토큰. fetch/loadMore 시작 시 증가하며, 응답 적용 직전
   * 토큰 일치를 확인해 필터 변경/연속 클릭으로 뒤늦게 도착한 stale 응답을
   * 무시한다(이전 필터 페이지가 새 목록에 append되는 경쟁 상태 차단).
   */
  _reqId: number;

  setSpaces: (spaces: SpaceItem[]) => void;
  addSpace: (space: SpaceItem) => void;
  removeSpace: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setFilter: (filter: "all" | "owned" | "joined") => void;
  fetchSpaces: () => Promise<void>;
  loadMore: () => Promise<void>;
}

/** filter → 쿼리스트링 (cursor 선택) */
function buildQuery(filter: SpaceStore["filter"], cursor?: string | null): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const useSpaceStore = create<SpaceStore>((set, get) => ({
  spaces: [],
  isLoading: false,
  isLoadingMore: false,
  filter: "all",
  nextCursor: null,
  hasMore: false,
  _reqId: 0,

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
    const reqId = get()._reqId + 1;
    // 리로드/필터 변경은 진행 중 loadMore를 대체한다 → isLoadingMore도 해제.
    // (무효화된 stale loadMore의 finally는 reqId 불일치로 리셋을 건너뛰므로,
    //  여기서 선제 해제하지 않으면 "더 보기" 버튼이 영구 비활성으로 고착됨)
    set({ isLoading: true, isLoadingMore: false, _reqId: reqId });
    try {
      const res = await fetch(`/api/spaces${buildQuery(get().filter)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (get()._reqId !== reqId) return; // stale (필터 변경 등)
      set({
        spaces: data.spaces,
        nextCursor: data.nextCursor ?? null,
        hasMore: !!data.hasMore,
      });
    } finally {
      if (get()._reqId === reqId) set({ isLoading: false });
    }
  },

  loadMore: async () => {
    const { hasMore, nextCursor, isLoadingMore, filter } = get();
    if (!hasMore || !nextCursor || isLoadingMore) return;
    const reqId = get()._reqId + 1;
    set({ isLoadingMore: true, _reqId: reqId });
    try {
      const res = await fetch(`/api/spaces${buildQuery(filter, nextCursor)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (get()._reqId !== reqId) return; // stale (필터 변경/재조회로 무효화)
      set((s) => ({
        spaces: [...s.spaces, ...data.spaces],
        nextCursor: data.nextCursor ?? null,
        hasMore: !!data.hasMore,
      }));
    } finally {
      if (get()._reqId === reqId) set({ isLoadingMore: false });
    }
  },
}));
