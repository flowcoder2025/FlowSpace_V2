# WI-031 협의 r2 — codex 블라인드 검증 P2 처분 확정

너는 설계 협의자다. 직전 codex 블라인드 검증(r1)이 WARNING + fixNow P2×2 + defer P3×2를 냈다. 산문으로 답하라.

## codex r1 지적 4건
- **P2-A (fixNow)**: `logsToCsv`가 payload 전체를 Details 셀에 JSON.stringify — ADMIN_ACTION payload의 `targetMemberId`/`messageId` 등 내부 식별자가 CSV로 누출. 정보위생(WI-014/019/021) 위반.
- **P2-B (fixNow)**: 멤버 이름 폴백이 `??`(nullish)인데 MemberTable/filterMembers는 `||`(truthy) — 이름이 빈 문자열이면 CSV가 화면과 다른 빈 Name을 낸다.
- **P3-C (defer)**: `downloadCsv`가 try/finally 없음 — click/제거 throw 시 앵커 잔존·objectURL 미해제.
- **P3-D (defer)**: codex 샌드박스에서 vitest EPERM으로 미실행(환경 제약, 결함 아님).

## 내가 이미 적용한 수정
- **P2-B 수정**: `m.user?.name || m.guestSession?.nickname || m.displayName || "Unknown"`로 변경(MemberTable와 동일 표시 우선순위·최종 "Unknown"). 빈 문자열 폴백 변이검출 테스트 추가. → 동의?
- **P3-C 수정**: `downloadCsv`에 try/finally — `a.remove()` + `URL.revokeObjectURL(url)`를 finally에서 보장. → 동의?
- P3-D: 로컬에서 vitest 전체 362 통과(363 예정)로 해소. 동의?

## P2-A 처분 — 핵심 쟁점(증거 제시, 재평가 요청)
실측 증거:
1. `src/components/dashboard/event-log-table.tsx:54`는 **이미 화면 Details 컬럼에 `JSON.stringify(log.payload)` 전체를 렌더링**한다(현행). 즉 admin은 지금도 targetMemberId/messageId를 화면에서 본다.
2. `GET /api/spaces/[id]/admin/logs`는 payload를 **raw로 반환**(정형화 없음) — 데이터가 이미 admin 브라우저에 도달.
3. 뷰어는 항상 space admin(`requireSpaceAdmin`: OWNER/STAFF/superAdmin).
4. payload 실내용 전수: members `{action,targetMemberId,targetName}`/`{action:"kick",targetName}`, announce `{action,messageId}`, messages `{action,messageId,senderName}`, livekit `{trackType,trackSource,participantName}`. → 내부 cuid 식별자(targetMemberId/messageId)와 표시명. **자격증명(accessSecret/inviteCode/email-of-others/prompt) 아님.**
5. WI-014/019/021 정보위생은 **API 응답이 권한 밖 당사자에게 비밀을 노출**하던 케이스. 여기 데이터는 (a)이미 admin 화면 노출, (b)이미 API 응답, (c)operational ID(비밀 아님), (d)admin-scoped.

내 판단: **CSV는 admin 전용 화면 Details를 그대로 미러링** — 신규 노출 아님. CSV만 sanitize하면 (i)화면≠CSV 불일치(네가 consult r1 Q1/Q5에서 "export what you see" 승인), (ii)실제 노출 미감소, (iii)로그 표시 의미론으로 스코프 확대.

**질문**: P2-A를 (옵션1) "화면 미러링·admin-scoped·operational ID라 신규 노출 아님 → defer(문서화)"로 처분하는 게 타당한가? 아니면 (옵션2) CSV가 portable artifact라 화면 발산을 감수하고 내부 식별자 키(targetMemberId/messageId/memberId/spaceId/userId/guestSessionId) recursive omit을 해야 하나? 후자라면 그 근거(화면은 그대로 두면서 CSV만 줄이는 것이 정합적인 이유)는?

**마지막에 "내가 놓칠 위험 1가지"를 지적하라.**
