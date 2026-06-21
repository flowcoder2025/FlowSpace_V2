import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSpaceStore } from "./space-store";

// ============================================
// space-store cursor 페이지네이션 + 경쟁 상태(race) 테스트
// fetch를 수동 제어 가능한 deferred 모킹으로 대체해 응답 도착 순서를 통제한다.
// ============================================

interface DeferredCall {
  url: string;
  resolve: (body: unknown) => void;
  reject: (err: unknown) => void;
}

let calls: DeferredCall[];

function jsonOk(body: unknown): Response {
  return { ok: true, json: async () => body } as unknown as Response;
}

/** 마이크로/매크로 태스크 큐 flush */
const flush = () => new Promise((r) => setTimeout(r, 0));

function resetStore() {
  useSpaceStore.setState({
    spaces: [],
    isLoading: false,
    isLoadingMore: false,
    filter: "all",
    nextCursor: null,
    hasMore: false,
    _reqId: 0,
  });
}

beforeEach(() => {
  calls = [];
  resetStore();
  global.fetch = vi.fn(
    (url: string | URL | Request) =>
      new Promise<Response>((resolve, reject) => {
        calls.push({
          url: String(url),
          resolve: (body) => resolve(jsonOk(body)),
          reject,
        });
      })
  ) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchSpaces", () => {
  it("1페이지 응답으로 spaces/nextCursor/hasMore 세팅", async () => {
    const p = useSpaceStore.getState().fetchSpaces();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/spaces"); // filter=all → 쿼리 없음
    calls[0].resolve({ spaces: [{ id: "a" }, { id: "b" }], nextCursor: "b", hasMore: true });
    await p;

    const s = useSpaceStore.getState();
    expect(s.spaces.map((x) => x.id)).toEqual(["a", "b"]);
    expect(s.nextCursor).toBe("b");
    expect(s.hasMore).toBe(true);
    expect(s.isLoading).toBe(false);
  });

  it("filter !== all 이면 쿼리스트링에 filter 포함", async () => {
    useSpaceStore.setState({ filter: "owned" });
    const p = useSpaceStore.getState().fetchSpaces();
    expect(calls[0].url).toBe("/api/spaces?filter=owned");
    calls[0].resolve({ spaces: [], nextCursor: null, hasMore: false });
    await p;
    expect(useSpaceStore.getState().hasMore).toBe(false);
  });
});

describe("loadMore", () => {
  it("다음 페이지를 append 하고 cursor/hasMore 갱신", async () => {
    // 1페이지
    const p1 = useSpaceStore.getState().fetchSpaces();
    calls[0].resolve({ spaces: [{ id: "a" }], nextCursor: "a", hasMore: true });
    await p1;

    // 2페이지
    const p2 = useSpaceStore.getState().loadMore();
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toBe("/api/spaces?cursor=a");
    calls[1].resolve({ spaces: [{ id: "b" }], nextCursor: null, hasMore: false });
    await p2;

    const s = useSpaceStore.getState();
    expect(s.spaces.map((x) => x.id)).toEqual(["a", "b"]); // append
    expect(s.nextCursor).toBeNull();
    expect(s.hasMore).toBe(false);
    expect(s.isLoadingMore).toBe(false);
  });

  it("hasMore=false 또는 cursor 없음이면 fetch 안 함", async () => {
    useSpaceStore.setState({ hasMore: false, nextCursor: null });
    await useSpaceStore.getState().loadMore();
    expect(calls).toHaveLength(0);
  });

  it("이미 isLoadingMore 중이면 중복 요청 차단", async () => {
    useSpaceStore.setState({ hasMore: true, nextCursor: "a", isLoadingMore: true });
    await useSpaceStore.getState().loadMore();
    expect(calls).toHaveLength(0);
  });
});

describe("경쟁 상태(race) — 필터 변경 중 도착한 stale loadMore 응답 무시", () => {
  it("loadMore 진행 중 필터 변경 후, 늦게 온 이전 필터 페이지를 새 목록에 append 하지 않음", async () => {
    // 1) all 필터 1페이지 로드 완료
    const p1 = useSpaceStore.getState().fetchSpaces();
    calls[0].resolve({ spaces: [{ id: "a" }], nextCursor: "a", hasMore: true });
    await p1;

    // 2) all 필터 loadMore 시작 (in-flight, 아직 미해결) → calls[1]
    const pMore = useSpaceStore.getState().loadMore();
    expect(calls[1].url).toBe("/api/spaces?cursor=a");

    // 3) 필터를 owned로 변경 → fetchSpaces 트리거(in-flight) → calls[2]
    useSpaceStore.getState().setFilter("owned");
    expect(calls[2].url).toBe("/api/spaces?filter=owned");

    // 4) owned 페이지가 먼저 도착 → 적용됨 (hasMore=true: "더 보기" 버튼 노출 상황)
    calls[2].resolve({ spaces: [{ id: "owned1" }], nextCursor: "owned1", hasMore: true });
    await flush();

    // 5) 뒤늦게 stale loadMore(all) 응답 도착 → 무시되어야 함
    calls[1].resolve({ spaces: [{ id: "b" }], nextCursor: "b", hasMore: true });
    await pMore;
    await flush();

    const s = useSpaceStore.getState();
    expect(s.filter).toBe("owned");
    expect(s.spaces.map((x) => x.id)).toEqual(["owned1"]); // 'b' append 안 됨
    expect(s.nextCursor).toBe("owned1");
    expect(s.hasMore).toBe(true);
    // 핵심 회귀(codex P2/fixNow): 무효화된 loadMore가 isLoadingMore를 고착시키지 않아야
    // 새 필터의 "더 보기" 버튼이 다시 동작한다.
    expect(s.isLoadingMore).toBe(false);
  });
});
