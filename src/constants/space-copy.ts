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
     * 귓속말(WI-040) — 채팅 입력창에 `/닉네임 `을 prefill하는 발견성 버튼.
     * 관리 액션과 무관(모든 로그인 사용자·self 제외). 공백 없는 닉네임에만 노출(slash 문법 한계).
     */
    whisper: {
      title: "귓속말",
      ariaLabel: (nickname: string) => `${nickname}님에게 귓속말`,
    },
    /**
     * 관리 액션 — value(토큰)는 admin API의 action 값(mute/unmute/kick/ban),
     * 라벨만 한글. "채팅 음소거"는 음성 강제 음소거(WI-038/039)와 혼동 방지용 명시.
     */
    actions: {
      mute: "채팅 음소거",
      unmute: "채팅 음소거 해제",
      kick: "내보내기",
      ban: "차단",
      // WI-045: 차단된 멤버에게만 노출(restriction=BANNED → NONE 복원, 재입장 허용).
      unban: "차단 해제",
    },
    /**
     * 음성 제어(WI-038/039) — LiveKit 서버 측 강제 음소거. **채팅 음소거와 별개 레이어**라
     * 라벨로 명확히 구분한다(운영자 오제재 방지). LiveKit room 참가자에게만 노출.
     * - mute: 마이크 publish 권한 회수 + 기존 트랙 강제 음소거(muted:true).
     * - allow: publish 권한 복원만(muted:false). **사용자 self-mute는 풀지 않음** →
     *   "해제"가 아니라 "발언 허용"으로 표기(force-unmute 아님을 드러냄).
     */
    voiceSectionLabel: "음성 제어",
    voiceActions: {
      mute: "음성 강제 음소거",
      allow: "음성 발언 허용",
    },
    /** 음성 제어 실패 — 라우트 code별 한글 매핑(서버 영문 미노출). 미지의 code는 actionFailed 폴백. */
    voiceError: {
      INVALID_IDENTITY: "참가자 식별자가 올바르지 않습니다.",
      SELF_TARGET: "자기 자신은 음성 제어할 수 없습니다.",
      TARGET_NOT_MEMBER: "대상이 이 공간의 멤버가 아닙니다.",
      PARTICIPANT_NOT_FOUND: "참가자가 음성 방에 연결되어 있지 않습니다.",
      LIVEKIT_NOT_CONFIGURED: "음성 서버 설정을 확인할 수 없습니다.",
      LIVEKIT_OPERATION_FAILED: "음성 제한 처리에 실패했습니다.",
    } as Record<string, string>,
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
  /** 실시간 소켓 연결 상태 안내. */
  SOCKET: {
    /** 강퇴(WI-047) 쿨다운 중 재입장 시도 — 클라 가드/서버 게이트 모두 거부. */
    kickedCooldown: "강퇴되어 잠시 후 다시 입장할 수 있습니다.",
  },
} as const;
