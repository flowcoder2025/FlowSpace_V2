# WI-024 설계 협의 — assets 상세 `metadata.error` 정보 노출(CWE-209)

너는 FlowSpace(Next.js 15 + Prisma + Phaser) 보안 정보위생 설계의 독립 협의 파트너다. 아래는 실측 근거다. 결정과 "내가 놓칠 위험 1가지"를 달라.

## 문제 (CWE-209, WI-023 evaluator가 발굴, WI-019/021/022/023 정보위생 트랙 후속)

비동기 에셋 생성 실패 시 **raw `error.message`가 DB `GeneratedAsset.metadata.error`에 저장**되고, WI-019에서 도입한 응답 allowlist `PUBLIC_METADATA_KEYS`가 `"error"`를 포함해 **`GET /api/assets/[id]` 응답으로 그대로 도달**한다. `processAssetGeneration` 실패 메시지엔 ComfyUI 내부 URL·로컬 파일 경로·프롬프트 단편·스택 조각이 들어갈 수 있어 WI-023과 동일 클래스 누출이다.

### 저장 시점 (raw error.message → metadata.error)
- `src/app/api/assets/generate/route.ts:95-106` (fire-and-forget `.catch`):
  ```ts
  .catch(async (error) => {
    await prisma.generatedAsset.update({
      where: { id: dbAsset.id },
      data: { status: "FAILED",
        metadata: { error: error instanceof Error ? error.message : "Unknown error" } },
    });
  });
  ```
- `src/app/api/assets/batch/route.ts:87-98` (동일 패턴, `metadata: { batchId, error: ... }`)

### 응답 도달 경로 (owner-gated)
- `src/features/assets/internal/public-asset.ts`: `PUBLIC_METADATA_KEYS = [..., "error"]`, `toPublicGeneratedAsset` → `toPublicMetadata`가 allowlist 키만 골라 반환.
- `src/app/api/assets/[id]/route.ts:55`: `GET`이 `toPublicGeneratedAsset(asset)` 반환. **owner(`asset.userId===session.user.id`) 또는 superAdmin만 통과**(L51) → 표면은 좁음(본인 자산만). 그래도 raw 내부 메시지가 클라에 도달.

## 실측 — `metadata.error`를 읽는 런타임 소비처

전수 grep 결과 **런타임 소비처 0**. `metadata.error`를 읽는 유일한 참조는 합성 테스트 `src/features/assets/internal/public-asset.test.ts:170` ("FAILED 자산의 metadata.error는 보존한다 (실패 폴링 계약)") 뿐이다.
- `game-loader.ts`: `...(asset.metadata||{})`를 spread하나 FAILED 자산은 `filePath` 없어 `throw` → ASSET_GENERATION_FAILED 자체 에러로 분기. `.error` 미사용.
- `sprite-generator.ts`: `metadata.frameWidth/frameHeight`만 읽음.
- 클라이언트 폴링 UI에서 실패 사유를 `metadata.error`로 표시하는 코드 없음.

## WI-023이 막 확립한 정책 (`src/lib/api-error.ts`)

`internalErrorResponse(context, error, message)`: 원본 에러는 `console.error("[context]", error)`로 **서버 로그에만**, 클라엔 generic message만, `details`는 환경 무관 영구 미반환. WI-023은 metadata.error를 "500 아닌 DB 저장"이라 의도적으로 defer → 이 WI-024로 분리했다.

## 후보안

- **A. allowlist 제외**: `PUBLIC_METADATA_KEYS`에서 `"error"` 제거. 응답에 metadata.error 영구 미도달. 단 DB엔 raw error 여전히 저장(읽기 경로만 차단 — allowlist 드리프트/신규 read 경로 추가 시 잠재 재누출). 테스트 L170 갱신 필요.
- **B. 저장 시 generic 정규화**: generate/batch `.catch`에서 raw `error.message` 대신 generic 고정 문자열(예 `"Asset generation failed"`)을 metadata.error에 저장 + raw는 `console.error`로 서버 로그(WI-023 정책 정합). DB가 애초에 raw를 안 가짐(근본 차단·심층방어). 응답엔 generic만 흐름(status=FAILED + 사유). allowlist `"error"`는 유지 가능(이제 안전).
- **C. A+B 둘 다**: 저장 generic 정규화(B) **그리고** allowlist에서 `"error"` 제거(A). DB도 응답도 둘 다 raw 없음 + status=FAILED만으로 충분하면 응답에서 error 키 자체 제거. 최대 위생.

## 내 잠정 추천: B (필요시 C)

근거: (1) **근본 차단** — A는 raw error를 DB에 남겨 둠(allowlist만 막음), B는 소스에서 차단해 DB가 깨끗(심층방어 우위). (2) **WI-023 정책 정합** — raw→서버 로그, generic→클라 노출은 internalErrorResponse가 막 세운 표준과 동일. (3) **폴링 계약 보존** — status=FAILED + generic 사유 유지(미래 UI가 "실패했음"은 알 수 있음). C는 응답에서 error 키까지 제거하나 status로 충분하면 과하지 않음.

## 질문

1. B vs C — 응답에 generic error 문자열을 남길 가치가 있나(status=FAILED로 충분한가)? generic 문자열을 둔다면 고정 1개 vs 실패 카테고리 분류 중 무엇?
2. 기존 DB에 이미 저장된 raw metadata.error 행은 어떻게 처리(마이그레이션/백필 vs 응답 allowlist 제외로 차단)? generate/batch만 고치면 **기존 행**은 여전히 raw를 갖고 있어 A 없이 B만으론 기존 행이 응답에 새 나간다 — 이게 B 단독의 결정적 허점인가? (즉 C가 사실상 필수?)
3. `processAssetGeneration` 실패가 사용자 입력 검증 실패(잘못된 type 등 사용자에게 유용한 사유)와 내부 인프라 실패(ComfyUI down 등 민감)를 구분해야 하나, 아니면 전부 generic으로 뭉개도 되나?
4. 내가 놓친 위험 1가지.

read-only로 위 파일들 직접 확인하고 답하라.
