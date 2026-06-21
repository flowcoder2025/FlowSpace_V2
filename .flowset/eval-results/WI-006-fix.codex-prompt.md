[블라인드 적대 검증 — WI-006-fix, P3]

리뷰어=codex. 아래 변경을 read-only로 독립 검증하고, 마지막 메시지로 review 스키마(평탄화본) 형식 JSON만 출력하라. `scores`/`weightedTotal`은 null. `issues`는 P0~P3, 각 항목에 `defer`/`deferRationale`/`fixNow` 포함. 권위는 최종 JSON.

대상 커밋: HEAD. `git show HEAD` 또는 `git diff HEAD~1 HEAD`로 변경을 직접 확인하라.

변경 파일:
- src/features/space/hooks/internal/useScreenRecorder.ts (recorder.onerror 핸들러)
- src/features/space/hooks/internal/useScreenRecorder.test.ts (신규 테스트)

[해결 대상 결함]
stopRecording()은 `new Promise((resolve) => { pendingStopResolveRef.current = resolve; recorder.onstop = ...resolve...; recorder.stop() })` 형태로 onstop에서만 resolve한다. 그런데 recorder.onerror(startRecording에서 설정)는 handleError + setRecordingState("idle") + stopTimer()만 하고 pendingStopResolveRef를 settle하지 않았다 → MediaRecorder 'error' 이벤트 시 onstop이 발화되지 않으면 stopRecording()이 반환한 Promise가 영구 pending (자원 누수 없음·기능 무영향 P3).

[수정 요지]
recorder.onerror를 '정상 abort'로 강화: (1) onstop=null로 이후 onstop 중복 저장/처리 차단, (2) audioContext close + chunks 폐기로 실패 녹화 자원 회수, (3) mediaRecorderRef===recorder일 때 null로 idle-상태/errored-recorder-참조 불일치 해소, (4) pendingStopResolveRef settle로 영구 pending 차단. resolve 시맨틱은 기존 onstop의 `result.status==="error"` 경로(reject 아님 resolve)와 일관 — 오류는 `error` 상태/`onError` 콜백으로 전달되며 Promise<void> 계약 유지. 호출부 src/components/space/video/ScreenShare.tsx `handleToggleRecording`는 `await stopRecording()` 뒤 후속 UI 없음.

[검증 관점]
1. dangling Promise가 실제로 해소되는가? 새 누수/회귀를 만들지 않는가?
2. onerror / onstop / unmount cleanup 3경로 상호작용에 중복 resolve·중복 저장·use-after-free·이중 close가 없는가?
3. 호출부 계약(Promise<void> resolve semantics) 위반이 없는가?
4. 신규 테스트가 결함을 실제로 잡는가(MediaRecorder mock의 stop()이 onstop을 자동 발화하지 않게 해 'error 시 onstop 미발화'를 결정적으로 재현 — 가짜 PASS 아닌가)?
5. 도메인 rules(app.md 클라이언트 불변식, 모듈 경계/캡슐화) 위반이 없는가?

P0/P1 또는 fixNow:true가 있으면 반드시 명시하라. 없으면 P2/P3로 분류하고 defer 여부와 근거(deferRationale)를 채워라.
