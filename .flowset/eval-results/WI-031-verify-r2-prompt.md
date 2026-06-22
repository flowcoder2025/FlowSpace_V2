# WI-031-feat 블라인드 적대 검증 r2 — CSV 내보내기 (r1 지적 반영 후)

너는 독립 적대 검증자(codex)다. read-only로 검증하고 **출력 스키마(JSON)에 맞춰** 판정하라. 다른 검증자 산출물 미참조.

## r1 → r2 변경 (HEAD = d106a4b)
r1(WARNING, fixNow P2×2 + defer P3×2) 대응 완료:
- **P2-B 해소**: `src/components/dashboard/csv-export.ts` membersToCsv 이름 폴백을 `m.user?.name || m.guestSession?.nickname || m.displayName || "Unknown"`로 변경(MemberTable/filterMembers `||` 체인·"Unknown" 일치). 빈 문자열 이름 폴백 변이검출 테스트 추가.
- **P3-C 해소**: `downloadCsv`에 try/finally — click이 throw해도 `a.remove()` + `URL.revokeObjectURL(url)` 보장.
- **P2-A 처분 = defer(accepted-risk, consult r2 합의)**: `logsToCsv`는 payload 전체를 Details에 JSON.stringify하나, 이는 신규 노출이 아니다 — `event-log-table.tsx:54`가 **이미 화면 Details에 동일 `JSON.stringify(log.payload)` 렌더**, `GET .../admin/logs`가 payload raw 반환, 뷰어는 항상 space admin(`requireSpaceAdmin`). payload 실내용은 operational ID(targetMemberId/messageId)+표시명뿐, 비밀(accessSecret/inviteCode/타인 email/prompt) 아님. CSV만 sanitize하면 화면≠CSV 발산·실노출 미감소. 향후 payload에 PII 추가 시 UI/API/CSV 동시 정형화(백로그).
- P3-D(vitest EPERM): 로컬 전체 vitest **363 통과**로 해소.

## 검증 대상 파일
- `src/lib/csv.ts`, `src/components/dashboard/csv-export.ts`, `export-csv-button.tsx`, `{members,logs,analytics}/page.tsx`, 테스트 2종.

## 검증 관점
1. P2-B 수정이 실제로 화면 표시 우선순위와 일치하는가(빈 문자열 케이스 포함)?
2. P3-C try/finally가 누수를 막는가(click throw 시 remove+revoke 도달)?
3. **P2-A 처분 동의 여부** — 화면이 이미 raw payload를 렌더한다는 전제가 맞는가(event-log-table.tsx 확인)? 신규 fixNow 결함이 남아 있나?
4. CSV 인젝션 중화·RFC4180·analytics union·기타 정확성 회귀 없는가?
5. 경계(lib 순수/dashboard 도메인+DOM)·하드코딩·민감필드 누출 없는가?

남은 fixNow(P0/P1 또는 미해소 P2)가 있으면 명시하라. 게이트 무관 개선은 defer=true.
