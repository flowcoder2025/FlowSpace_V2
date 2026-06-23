권고는 **단일 토글이 아니라 “음성 강제 음소거”와 “음성 발언 허용”을 별도 액션으로 제공**하는 쪽입니다.

**Q1. 노출 대상**

음성 액션은 **LiveKit 참가자, 즉 `participantTracks`에 존재하는 참가자에게만 노출**하는 게 맞습니다. 아바타 리스트의 소켓 전용 플레이어에는 노출하지 않는 것이 좋습니다. 백엔드가 `getParticipant`를 전제로 하고 있으므로, 소켓에는 있지만 LiveKit room에 없는 대상은 정상 UX가 아니라 예측 가능한 404 흐름이 됩니다.

판정 기준은 `audioTrack` 유무가 아니라 **LiveKit identity 존재 여부**, 구체적으로는 `track.participantId`가 있는 VideoTile 쪽 컨텍스트여야 합니다. 마이크를 꺼둔 사용자는 `audioTrack`이 없을 수 있지만 여전히 LiveKit participant일 수 있고, 이 경우 `muted=true`는 “현재 트랙 mute”보다 “MICROPHONE publish 권한 회수”가 핵심 의미를 가집니다.

**Q2. 토글 상태**

`track.isAudioMuted`로 라벨을 바꾸는 방식은 피하는 게 좋습니다. 이 값은 self-mute와 moderator-mute를 구분하지 못하고, 특히 self-mute 상태에서 “음성 음소거 해제”를 보여주면 사용자가 클릭해도 실제 마이크가 켜지지 않습니다. WI-038 계약상 unmute는 publish 권한 복원일 뿐 force-unmute가 아니기 때문입니다.

따라서 권고는 **두 액션을 명시적으로 제공**하는 것입니다.

“음성 강제 음소거”는 `muted: true`, “음성 발언 허용” 또는 “음성 제한 해제”는 `muted: false`로 보내는 식이 적절합니다. 후자는 “마이크 켜기”나 “음소거 해제”처럼 들리면 안 됩니다. 실제로는 사용자의 self-mute를 해제하지 않으므로, 라벨도 **권한 복원**의 의미가 드러나야 합니다.

**Q3. 게스트 포함 여부**

WI-039에서는 **등록 멤버만 1차 범위로 두고, guest-* 음성 음소거는 후속 WI로 분리**하는 것을 권합니다.

백엔드는 guest-*를 지원하지만, 현재 프론트엔드의 관리 메뉴 게이트는 `ManagedMember`와 `actorRole` 중심입니다. 게스트를 이번에 넣으면 “member가 없는데 음성 액션만 표시되는 메뉴”라는 별도 권한/렌더링 경로가 생깁니다. 이건 단순 연결 작업을 넘어 메뉴 모델을 바꾸는 작업입니다.

다만 Q5를 고려해 지금부터 prop 구조는 `identity`를 받을 수 있게 설계하는 게 좋습니다. 즉, **이번 WI에서 게스트 액션은 숨기되, 나중에 guest-*를 막지 않는 인터페이스로 정리**하는 방향이 가장 안전합니다.

**Q4. 성공/실패 후 처리**

음성 액션 성공 후에는 **멤버 refetch를 호출하지 않는 게 맞습니다.** DB의 `restriction`이나 `SpaceMember` 상태가 바뀌지 않고, 실제 오디오 상태는 LiveKit 이벤트로 갱신되는 영역입니다. `onActionDone`은 채팅 음소거/킥/밴처럼 멤버 상태를 바꾸는 액션에만 남기는 편이 낫습니다.

대신 액션 단위 로딩 상태는 필요합니다. 같은 대상에게 중복 클릭으로 `muted=true/false` 요청이 연속 전송되면 최종 상태가 사용자의 기대와 달라질 수 있습니다. 메뉴 항목 단위로 pending을 막고, 성공 시 짧은 토스트를 주는 정도가 적절합니다.

에러는 서버의 영문 문자열을 그대로 노출하지 말고, `code`를 기준으로 `SPACE_COPY`에 한글 매핑하는 게 좋습니다. 특히 `PARTICIPANT_NOT_FOUND`는 “참가자가 음성 방에 연결되어 있지 않습니다”, `LIVEKIT_NOT_CONFIGURED`는 “음성 서버 설정을 확인할 수 없습니다”, `LIVEKIT_OPERATION_FAILED`는 “음성 제한 처리에 실패했습니다”처럼 사용자 행동 가능성에 맞춰 표현해야 합니다. 알 수 없는 코드는 일반 실패 메시지로 폴백하면 됩니다.

**Q5. 식별자 전달**

`MemberActionsMenu`에는 **LiveKit identity를 별도 prop으로 추가 전달**하는 것이 맞습니다. `userId`에서 `user-${userId}`를 재구성하는 방식은 이번 범위에서는 동작할 수 있어도 계약을 UI 쪽에서 복제하는 셈이고, guest-* 확장도 막습니다.

`ParticipantPanel`은 이미 `track.participantId`로 정확한 identity를 알고 있으므로, 그 값을 그대로 내려보내야 합니다. 음성 moderate API의 식별자는 `SpaceMember.id`도, `userId`도 아니라 LiveKit identity입니다. 이 경계를 prop 이름에서도 분명히 드러내는 편이 좋습니다. 예를 들면 `livekitIdentity` 또는 `participantIdentity`가 적절합니다.

**내가 놓칠 위험 1가지**

가장 큰 누락 위험은 **메뉴 가시성 게이트와 액션별 게이트를 분리하지 않아서, 음성 액션 때문에 기존 채팅/킥/밴 권한 모델이 흐려지는 것**입니다. 지금 `MemberActionsMenu`는 “등록 멤버에 대한 관리 메뉴”입니다. 여기에 LiveKit 세션 액션을 섞으면 메뉴 자체를 띄우는 조건과 각 액션을 띄우는 조건이 달라집니다. WI-039에서는 최소한 “메뉴는 기존 member 게이트를 유지하되, 음성 액션은 `participantIdentity`가 있는 경우에만 추가”처럼 경계를 명확히 두는 게 좋습니다.
