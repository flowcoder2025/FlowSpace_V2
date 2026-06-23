/**
 * 인-스페이스(실시간 공간) UI 카피 — 단일 SoT.
 *
 * 어드민 대시보드 카피(`dashboard-copy.ts`)와 분리한다. WI-033이 대시보드 카피를
 * dashboard scope로 엄격히 고정했고, 인-스페이스는 권한/UX 경계가 달라
 * (예: "채팅 음소거"는 음성 음소거와 명확히 구분해야 함) 별도 상수로 둔다.
 *
 * 키는 영문, 값은 한글 (단일 한국어 제품 — i18n 미도입).
 */
export const SPACE_COPY = {
  /** 참가자 패널의 멤버 관리(채팅 음소거/해제·내보내기·차단) UI. */
  PARTICIPANT_PANEL: {
    /** 관리 메뉴 토글 버튼 aria-label. */
    manageAriaLabel: (nickname: string) => `${nickname} 관리`,
    /**
     * 관리 액션 — value(토큰)는 admin API의 action 값(mute/unmute/kick/ban),
     * 라벨만 한글. "채팅 음소거"는 음성 강제 음소거(WI-038/039)와 혼동 방지용 명시.
     */
    actions: {
      mute: "채팅 음소거",
      unmute: "채팅 음소거 해제",
      kick: "내보내기",
      ban: "차단",
    },
    /** 파괴적 액션(내보내기/차단) 인라인 확인 — kick=재입장 가능, ban=재입장 차단. */
    confirm: {
      kick: (nickname: string) =>
        `${nickname}님을 내보낼까요? 다시 입장할 수 있습니다.`,
      ban: (nickname: string) =>
        `${nickname}님을 차단할까요? 재입장이 차단됩니다.`,
      confirmLabel: "확인",
      cancelLabel: "취소",
    },
    /** 액션 실패 메시지(서버가 error 미반환 시 폴백). */
    actionFailed: "작업에 실패했습니다.",
    /** 네트워크 오류(fetch 예외). */
    networkError: "네트워크 오류가 발생했습니다.",
  },
} as const;
