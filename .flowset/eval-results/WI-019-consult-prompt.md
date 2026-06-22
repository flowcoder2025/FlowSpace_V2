# 설계 협의 — 다음 WI 우선순위 + WI-019 응답 allowlist 설계

FlowSpace = Next.js 15 풀스택 + Phaser 메타버스. 너는 Claude(메인)의 **독립 설계 파트너**다. 산문으로 답하라(스키마 없음). read-only.

## 현재 상태 (실측)
- WI-001~016 + WI-020 전부 완료·develop→main 승격·라이브 반영. V1→V2 도메인 컷오버 e2e 검증 완료(사용자 정상확인).
- READY 큐 비어 있음. BACKLOG 3건(승격前 통합감사 발굴):
  - **WI-017 (improve)** 소켓 토큰 폴백: `src/features/space/socket/internal/socket-client.ts:40` — `const res = await fetch("/api/socket/token"); if (!res.ok) throw new Error("Failed to get socket token");` retry/offline fallback 없이 즉시 throw. AUTH_SECRET 오설정 시 메타버스 진입 전면 실패. UX 방어심화(승격 차단 아님).
  - **WI-018 (feat)** prod env fail-fast: `dispatchEnforcement`/소켓 서버가 prod env(`SOCKET_INTERNAL_*`) 미설정 시 조용히 degrade. startup 검증으로 fail-fast(운영 안전망). 현재 graceful degrade라 차단 아님.
  - **WI-019 (fix)** assets GET 응답 정형화: `src/app/api/assets/[id]/route.ts:38`이 raw GeneratedAsset 전체 행(+user) 반환. WI-014(spaces 응답 allowlist)와 동일 클래스·별 도메인. owner/superAdmin 게이트 + 본인 소유 메타만이라 저위험. WI-014 evaluator P3 defer 흡수.

## 질문 1 — 우선순위
라이브/승격 완료 상태에서 WI-017/018/019 중 무엇을 먼저 처리해야 하나? 내 잠정안은 **WI-019 먼저**(가장 구체적·저위험·WI-014 패턴 확립·REST 계약 변경이라 어차피 consult 필요·prior defer 흡수)다. 동의/반대와 근거.

## 질문 2 — WI-019 설계 (REST 응답 계약 변경)
`GET /api/assets/[id]`는 현재 `prisma.generatedAsset.findUnique({ where:{id}, include:{ user:{select:{id,name}} } })` 결과 `asset` 전체를 그대로 JSON 반환.

**GeneratedAsset 스칼라**: id, userId, type, name, prompt(@db.Text), workflow, status, metadata(Json?), filePath, thumbnailPath, fileSize, comfyuiJobId, isShared, createdAt, updatedAt + user{id,name}.

**실제 소비처 2곳(앱 내부) + 1(dev 스크립트)이 쓰는 필드 (grep 실측)**:
- `src/features/assets/internal/game-loader.ts`(loadAssetToPhaser): `id`, `type`, `filePath`, `name`, `metadata`
- `src/features/space/avatar/internal/sprite-generator.ts`(loadCustomAvatarTexture): `filePath`, `metadata`(metadata.frameWidth/frameHeight)
- `scripts/test-chibi-generation.ts`(dev 폴링): `status` 추정

내 잠정 allowlist 안: **반환** `{ id, userId, type, name, status, metadata, filePath, thumbnailPath, fileSize, isShared, createdAt, updatedAt, user:{id,name} }` / **제외** `prompt`(생성 프롬프트), `workflow`(내부 워크플로우명), `comfyuiJobId`(내부 인프라 job ID).

- WI-014가 spaces에서 쓴 패턴은 `findUnique`의 `include`→`select`로 교체 + 응답 객체를 명시 키로 구성. 동일 적용이 맞나?
- 제외 3필드(prompt/workflow/comfyuiJobId)가 맞나, 아니면 더 줄이거나(예: status 폴링 외 소비처 없으면 더 타이트) 더 보존해야 하나? `prompt`는 본인 소유라 노출해도 무방하다는 반론도 가능 — 판단.
- `metadata`(Json?)를 통째 반환하는 게 안전한가? 파이프라인 내부 데이터가 섞일 위험은? (소비처는 frameWidth/frameHeight/name/filePath만 읽음)
- 회귀 위험: 두 소비처 타입이 `{ filePath?, metadata? }`/`{id,type,filePath,name,metadata}`로 좁게 선언돼 있어 필드 추가/제거에 둔감. 그래도 빠뜨리면 안 되는 게 있나?

## 질문 3
**내가 놓칠 위험 1가지**를 반드시 지적하라(우선순위·설계 어느 쪽이든).
