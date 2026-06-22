# 설계 협의(적대적) — WI-020-fix: 미들웨어가 public 정적에셋을 로그인으로 리다이렉트하는 회귀

당신은 독립 적대 검토자. read-only. 아래 결함과 수정안을 검토하고 **수정안이 인증 우회를 재개방하는지** 적대적으로 따져라. 산문, 간결.

## 결함 (라이브 회귀)
`src/middleware.ts`가 미인증 요청 시 **public/ 정적 파일 `/Logo.png`을 `/login?callbackUrl=%2FLogo.png`로 307 리다이렉트** → Next.js Image 최적화기가 이미지 대신 리다이렉트를 받아 **로그인 페이지 로고 깨짐**. 실측: `curl https://space.flow-coder.com/Logo.png` → 307 Location `/login?...`.

원인: 미들웨어 로직
```
const isStaticAsset = pathname.startsWith("/_next") || pathname.startsWith("/favicon");
// /Logo.png 은 위에 안 걸리고 PUBLIC_PREFIXES(/login,/api/auth,/api/guest)·"/"도 아님 → 보호 라우트로 간주 → !req.auth면 /login 리다이렉트
matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]   // public/ 루트 파일은 matcher에 안 걸러져 미들웨어 실행됨
```
WI-001 보안 픽스("middleware exact", `startsWith("/")` no-op 제거)가 정적파일까지 보호 대상으로 만든 회귀. 승격 전 old 미들웨어는 no-op으로 통과시켰음. public/ 에는 현재 `Logo.png` 1개(향후 og/robots/manifest 추가 시 동일 영향).

## 수정안 (비판해 달라)
**옵션1 (코드)**: `isStaticAsset`에 파일 확장자 통과 추가 —
```
const isStaticAsset =
  pathname.startsWith("/_next") ||
  pathname.startsWith("/favicon") ||
  /\.[A-Za-z0-9]+$/.test(pathname);   // public 정적파일(Logo.png 등)
```
**옵션2 (matcher)**: `matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]` — 점(.) 포함 경로 미들웨어 제외.
**옵션3**: 둘 다(심층방어).

## 묻는 것 (적대적)
A. 확장자 통과(`/\.[A-Za-z0-9]+$/`)가 **인증 우회를 재개방하나?** 보호되어야 하는데 확장자를 가진 경로가 이 앱에 존재하나(예: 동적 라우트 `/spaces/[id]`가 `foo.png` 같은 값을 받으면? `/api/*`는 확장자 없음)? `path traversal`/인코딩(`%2e`)로 우회 가능?
B. matcher 제외(옵션2) vs 코드 통과(옵션1)의 트레이드오프 — matcher 제외는 미들웨어가 아예 안 도므로 더 견고한가, 아니면 향후 보호 필요한 확장자 경로를 못 막나? 권장은?
C. Next.js Image 최적화(`/_next/image?url=/Logo.png`)는 matcher에서 이미 제외인데도 왜 307이 났나(최적화기가 upstream `/Logo.png` redirect를 전파?) — 수정 후 `/Logo.png` 통과되면 최적화도 정상화되나?
D. 회귀 방지 테스트로 무엇을 강제해야 하나(미인증 `/Logo.png` 200 + 보호 라우트 `/spaces/x` 여전히 리다이렉트 + `/api/spaces` 미인증 차단 유지)?
E. 놓친 위험 1가지.
