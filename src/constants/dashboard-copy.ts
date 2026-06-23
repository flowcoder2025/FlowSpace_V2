/**
 * 어드민 대시보드 한글 카피 상수 (WI-033).
 *
 * 대시보드(`app/dashboard/**` + `components/dashboard/**`)의 모든 사용자 노출 문자열을
 * 단일 SoT로 모은다(하드코딩 금지 — CLAUDE.md / rules/app.md #9). i18n 라이브러리는
 * 미도입(한국어 단일 언어 제품) — 단순 한글 상수로 충분.
 *
 * 원칙(codex 설계 협의 Q5 — 표시 라벨과 도메인/API 값 분리):
 * - 키는 영문(검색성·refactor 안정성·타입 추론 유지), 값은 한국어.
 * - `<select>`의 `value`·필터 키·API payload·CSS 색상 맵 키 같은 **도메인/API 값은
 *   절대 한글로 바꾸지 않는다**. 화면 표시 라벨만 한글화한다.
 * - enum 코드(role/restriction/eventType/messageType/accessType)는 코드를 그대로
 *   값으로 유지하고, 아래 `*Label()` 헬퍼로 표시 라벨만 매핑한다(미정의 코드는 코드로
 *   폴백 — 신규 enum 추가 시 빈 칸/undefined 대신 코드 노출).
 * - 동적/보간 문자열은 문자열만 반환하는 함수 엔트리로 둔다.
 */

// 도메인 enum → 한국어 표시 라벨 (값/라벨 분리 — value/필터/CSV는 코드, 표시만 한글).
// 화면(배지·드롭다운)과 CSV가 동일 라벨을 공유한다(일관성).
const ROLE_LABELS: Record<string, string> = {
  OWNER: "소유자",
  STAFF: "스태프",
  PARTICIPANT: "참여자",
};

const RESTRICTION_LABELS: Record<string, string> = {
  NONE: "없음",
  MUTED: "음소거",
  BANNED: "차단됨",
};

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  MESSAGE: "일반",
  WHISPER: "귓속말",
  PARTY: "파티",
  SYSTEM: "시스템",
  ANNOUNCEMENT: "공지",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  ENTER: "입장",
  EXIT: "퇴장",
  INTERACTION: "상호작용",
  CHAT: "채팅",
  ADMIN_ACTION: "관리자 작업",
  VIDEO_START: "화상 시작",
  VIDEO_END: "화상 종료",
  SCREEN_SHARE_START: "화면 공유 시작",
  SCREEN_SHARE_END: "화면 공유 종료",
};

const ACCESS_TYPE_LABELS: Record<string, string> = {
  PUBLIC: "공개",
  PRIVATE: "비공개",
  PASSWORD: "비밀번호",
};

export const DASHBOARD_COPY = {
  COMMON: {
    loading: "불러오는 중...",
    loadMore: "더 보기",
    unknown: "알 수 없음",
    unknownError: "알 수 없는 오류가 발생했습니다.",
    networkError: "네트워크 오류가 발생했습니다.",
    exportCsv: "CSV 내보내기",
  },

  NAV: {
    backToSpaces: "← 스페이스 목록",
    adminDashboard: "관리자 대시보드",
    openSpace: "스페이스 열기 →",
    spaceFallback: "스페이스",
    items: {
      overview: "개요",
      members: "멤버",
      messages: "메시지",
      logs: "로그",
      media: "미디어",
      analytics: "분석",
      settings: "설정",
    },
  },

  OVERVIEW: {
    title: "대시보드",
    totalMembers: "전체 멤버",
    totalMessages: "전체 메시지",
    todayMessages: "오늘 메시지",
    todayMessagesDesc: "오늘 자정 이후",
    recentActivity: "최근 활동",
    noRecentActivity: "최근 활동이 없습니다",
    loadError: "통계를 불러오지 못했습니다.",
  },

  ANNOUNCE: {
    title: "공지 보내기",
    placeholder: "공지사항을 입력하세요...",
    submitting: "발송 중...",
    submit: "공지 발송",
    success: "공지가 발송되었습니다.",
    error: "공지 발송에 실패했습니다.",
  },

  MEMBERS: {
    title: "멤버",
    /** 표시 중인 멤버 수(필터 적용 시 "표시 / 전체"). */
    count: (visible: number, total: number) =>
      visible === total ? `${visible}명` : `${visible} / ${total}명`,
    searchPlaceholder: "이름 또는 이메일 검색...",
    searchAriaLabel: "멤버 검색",
    roleFilterAriaLabel: "역할 필터",
    empty: "멤버가 없습니다.",
    emptySearch: "검색 결과가 없습니다.",
    loadError: "멤버를 불러오지 못했습니다.",
    guest: "게스트",
    actionFailed: "작업에 실패했습니다.",
    table: {
      name: "이름",
      role: "역할",
      status: "상태",
      joined: "가입일",
      actions: "관리",
    },
    /** 행 관리 드롭다운 — value는 UI 액션 토큰(handleAction이 소비), 라벨만 한글. */
    actions: {
      placeholder: "관리 작업...",
      unmute: "음소거 해제",
      mute: "음소거",
      kick: "내보내기",
      ban: "차단",
      setStaff: "스태프로 지정",
      setParticipant: "참여자로 지정",
    },
    /** 역할 필터 옵션 — value는 필터 키(ALL/OWNER/STAFF/PARTICIPANT), 라벨만 한글. */
    roleFilters: {
      ALL: "전체 역할",
      OWNER: "소유자",
      STAFF: "스태프",
      PARTICIPANT: "참여자",
    },
  },

  MESSAGES: {
    title: "메시지",
    allTypes: "전체 유형",
    typeFilterAriaLabel: "메시지 타입 필터",
    loadError: "메시지를 불러오지 못했습니다.",
    delete: "삭제",
    deleteConfirm: "이 메시지를 삭제하시겠습니까?",
    deleteFailed: "삭제에 실패했습니다.",
    deletedBadge: "삭제됨",
  },

  LOGS: {
    title: "이벤트 로그",
    allEvents: "전체 이벤트",
    typeFilterAriaLabel: "이벤트 타입 필터",
    startDateAriaLabel: "시작 날짜",
    endDateAriaLabel: "종료 날짜",
    loadError: "로그를 불러오지 못했습니다.",
    /** CSV 내보내기 버튼 — 로드된 분량만 대상임을 건수로 노출. */
    csvLabel: (count: number) => `CSV 내보내기 (로드된 ${count}건)`,
    table: {
      event: "이벤트",
      user: "사용자",
      details: "상세",
      time: "시각",
    },
  },

  MEDIA: {
    title: "미디어 관리",
    description:
      "스페이스 멤버의 스포트라이트 권한을 관리합니다. 녹화 및 근접 설정은 스페이스 내부에서 실시간으로 제어합니다.",
    loadDataError: "미디어 데이터를 불러오지 못했습니다.",
    loadMembersError: "멤버를 불러오지 못했습니다.",
    grantError: "스포트라이트 권한 부여에 실패했습니다.",
    revokeError: "권한 회수에 실패했습니다.",
    grantTitle: "스포트라이트 권한 부여",
    memberLabel: "멤버",
    selectMember: "멤버 선택...",
    expiresLabel: "만료(분)",
    unlimited: "무제한",
    grant: "부여",
    /** 부여된 권한 목록 헤딩 + 개수. */
    grantsTitle: (count: number) => `스포트라이트 권한 (${count})`,
    noGrants: "부여된 스포트라이트 권한이 없습니다",
    revoke: "회수",
    statusExpired: "만료됨",
    statusActive: "활성",
    statusGranted: "부여됨",
    table: {
      user: "사용자",
      status: "상태",
      expires: "만료",
      granted: "부여일",
      actions: "관리",
    },
  },

  ANALYTICS: {
    title: "분석",
    loadError: "분석 데이터를 불러오지 못했습니다.",
    /** 기간 선택 옵션 — value는 일수(숫자), 라벨만 한글. */
    ranges: [
      { value: 7, label: "최근 7일" },
      { value: 14, label: "최근 14일" },
      { value: 30, label: "최근 30일" },
      { value: 90, label: "최근 90일" },
    ],
    dailyMessages: "일별 메시지",
    dailyVisitors: "일별 방문자",
  },

  SETTINGS: {
    title: "설정",
    notFound: "스페이스를 찾을 수 없습니다",
    saveError: "설정 저장에 실패했습니다.",
    success: "설정이 저장되었습니다.",
    form: {
      name: "스페이스 이름",
      description: "설명",
      maxUsers: "최대 인원",
      accessType: "접근 유형",
      primaryColor: "기본 색상",
      loadingMessage: "로딩 메시지",
      loadingPlaceholder: "스페이스에 입장 중입니다...",
      saving: "저장 중...",
      save: "설정 저장",
    },
    // 접근 유형(PUBLIC/PRIVATE/PASSWORD) 표시 라벨은 다른 enum과 동일하게
    // `accessTypeLabel()` 헬퍼(ACCESS_TYPE_LABELS SoT)를 렌더 지점에서 사용한다.
  },

  CHART: {
    noData: "데이터가 없습니다",
  },

  /** CSV 내보내기 — 헤더·표시 값(화면 라벨과 동일). payload JSON 키는 데이터라 미번역. */
  CSV: {
    memberHeaders: ["이름", "이메일", "역할", "제재", "게스트", "가입일"],
    logHeaders: ["시각", "이벤트 유형", "사용자", "상세"],
    analyticsHeaders: ["날짜", "메시지", "방문자"],
    guestYes: "예",
    guestNo: "아니오",
    unknown: "알 수 없음",
    unserializable: "[직렬화 불가]",
  },

  /** enum 코드 → 표시 라벨(미정의 코드는 코드로 폴백). 화면·CSV 공유 SoT. */
  roleLabel: (role: string): string => ROLE_LABELS[role] ?? role,
  restrictionLabel: (restriction: string): string =>
    RESTRICTION_LABELS[restriction] ?? restriction,
  messageTypeLabel: (type: string): string => MESSAGE_TYPE_LABELS[type] ?? type,
  eventTypeLabel: (type: string): string => EVENT_TYPE_LABELS[type] ?? type,
  accessTypeLabel: (type: string): string => ACCESS_TYPE_LABELS[type] ?? type,
} as const;
