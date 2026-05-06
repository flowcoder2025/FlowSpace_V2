# Landing Page: 초기 구현

**날짜**: 2026-05-06
**유형**: Ad-hoc (신규 기능)

## 개요

마케팅 랜딩페이지 신설. `/` 라우트가 비로그인/로그인 사용자 모두에게 랜딩 화면을 보여준다.
기존 Dashboard 카드 UI를 9개 섹션 구조로 교체하고, 구현된 기능만 카피로 사용(AI/ComfyUI/경쟁사명 일절 없음).
디자인 시스템(모노크롬 컬러, 타입 스케일, 이미지 슬롯 패턴)을 이 작업에서 최초 확정.

## 변경 파일

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `src/app/page.tsx` | 수정 | Dashboard 카드 제거 → 랜딩 섹션 조합으로 교체 |
| `src/app/layout.tsx` | 수정 | Source_Serif_4 next/font 추가, Pretendard CDN, metadata 갱신 |
| `src/app/globals.css` | 수정 | Tailwind v4 `@theme` 토큰 + `.landing-placeholder` 유틸 추가 |
| `src/components/layout/navbar-wrapper.tsx` | 수정 | `/`에서 글로벌 navbar 숨김 (랜딩 자체 navbar 사용) |
| `src/components/landing/index.ts` | 신규 | 9개 섹션 컴포넌트 barrel export |
| `src/components/landing/internal/landing-navbar.tsx` | 신규 | 세션 분기 navbar |
| `src/components/landing/internal/hero.tsx` | 신규 | 헤드라인 + CTA + Hero 이미지 슬롯 |
| `src/components/landing/internal/trust-strip.tsx` | 신규 | 사용 시나리오 5개 |
| `src/components/landing/internal/features.tsx` | 신규 | 3 카드 (공간 도구 / 캐릭터 / 음성·화상) |
| `src/components/landing/internal/how-it-works.tsx` | 신규 | Step 1~3 |
| `src/components/landing/internal/use-cases.tsx` | 신규 | 사무실 / 행사장 2 케이스 |
| `src/components/landing/internal/pricing.tsx` | 신규 | 단일 "문의" 카드 |
| `src/components/landing/internal/final-cta.tsx` | 신규 | 마지막 CTA |
| `src/components/landing/internal/footer.tsx` | 신규 | 푸터 |
| `src/components/landing/internal/image-slot.tsx` | 신규 | 이미지/와이어프레임 placeholder 헬퍼 |

## 디자인 시스템 토큰

`src/app/globals.css` — `@theme` 블록에 정의. Tailwind v4 네이티브 CSS 변수로 사용.

### 컬러

| 토큰 | 값 | 용도 |
|------|----|------|
| `cream` | `#ffffff` | 페이지 배경 |
| `cream-deep` | `#fafafa` | 카드/섹션 배경 |
| `ink` | `#0a0a0a` | 본문 텍스트 |
| `ink-soft` | `#262626` | 보조 텍스트 |
| `ink-muted` | `#737373` | 캡션, 플레이스홀더 |
| `ink-light` | `#a3a3a3` | 비활성 |
| `line` | `#e5e5e5` | 구분선, 테두리 |
| `line-soft` | `#f0f0f0` | 배경 구분 |
| `brand` | `#0a0a0a` | CTA 버튼 배경 |
| `brand-deep` | `#000000` | CTA 버튼 hover |
| `accent` | `#0a0a0a` | (현재 ink와 동일, 확장 예약) |
| `accent-soft` | `#f0f0f0` | 강조 배경 |

**원칙**: 컬러 사용 0건 — 로고만 유일한 컬러 포인트. 위계는 회색 농도로 표현.

### 타입

| 토큰 | 값 |
|------|----|
| `font-serif` | `"Source Serif 4", Georgia, serif` |
| `font-sans` | `"Pretendard", "Inter", system-ui, sans-serif` |
| `tracking-tightest` | `-0.04em` |

- **Source Serif 4**: `next/font/google`, weight 300/400/500/600, CSS var `--font-source-serif`
- **Pretendard**: CDN(`jsdelivr.net/orioncactus/pretendard v1.3.9`) — `font-sans` fallback

### 유틸리티

```css
.landing-placeholder {
  background:
    linear-gradient(135deg, transparent 49.5%, rgba(10,10,10,0.05) 49.5%, rgba(10,10,10,0.05) 50.5%, transparent 50.5%),
    linear-gradient(45deg,  transparent 49.5%, rgba(10,10,10,0.05) 49.5%, rgba(10,10,10,0.05) 50.5%, transparent 50.5%),
    var(--color-cream-deep);
}
```

## 주요 구현

### page.tsx — 최종 조합

```tsx
import {
  LandingNavbar, Hero, TrustStrip, Features,
  HowItWorks, UseCases, Pricing, FinalCta, Footer,
} from "@/components/landing";

export default function Home() {
  return (
    <main className="bg-cream text-ink antialiased">
      <LandingNavbar />
      <Hero />
      <TrustStrip />
      <Features />
      <HowItWorks />
      <UseCases />
      <Pricing />
      <FinalCta />
      <Footer />
    </main>
  );
}
```

### LandingNavbar — 세션 분기

```tsx
"use client";
// useSession()으로 세션 감지
// 비로그인: "로그인" 링크 + "시작하기" CTA → ROUTES.LOGIN
// 로그인:   "내 스페이스 →" CTA              → ROUTES.MY_SPACES
// 섹션 앵커: #features / #how / #cases / #pricing
```

### ImageSlot — 이미지/와이어프레임 헬퍼

```tsx
type ImageSlotProps = {
  src?: string;       // 없으면 와이어프레임 placeholder
  alt: string;
  aspect?: string;    // Tailwind aspect 클래스 (기본: "aspect-[4/3]")
  caption?: string;   // placeholder 캡션 텍스트
  className?: string;
  rounded?: string;   // 기본: "rounded-2xl"
  border?: boolean;   // 기본: true
  priority?: boolean;
};
// src 있음  → next/image (fill + object-cover)
// src 없음  → .landing-placeholder + [ caption ] 텍스트
```

### NavbarWrapper — `/` 숨김

```tsx
const isHomeRoute = pathname === "/";
const isHidden = isHomeRoute || NAVBAR_HIDDEN_ROUTES.some(…);
if (isHidden) return null;
```

`/`에서 글로벌 Navbar를 렌더링하지 않는다. 랜딩이 `LandingNavbar`를 자체 보유.

### layout.tsx — 폰트 + 메타데이터

```tsx
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "FlowSpace — 다 함께 모이는 가상의 사무실",
  description: "팀이 매일 출근하는 공간을 직접 디자인하고, 음성과 영상으로 실시간 연결됩니다.",
};
// <html> className에 sourceSerif.variable 주입
// <head>에 Pretendard CDN <link> 직접 삽입
```

## 카피 원칙

언급 가능한 기능 (구현 완료):
- 공간/맵 에디터 (타일 기반)
- 캐릭터 이동
- LiveKit 음성·화상
- 채팅

언급 금지:
- AI / ComfyUI / 캐릭터 생성 파이프라인
- 경쟁사명

## 미완성 슬롯 (남은 작업)

| 슬롯 | 위치 | 상태 |
|------|------|------|
| Hero 메인 이미지 | `<Hero />` | placeholder — 스크린샷 필요 |
| Step 1 이미지 | `<HowItWorks />` | placeholder — 스크린샷 필요 |
| Step 2 이미지 | `<HowItWorks />` | placeholder — 스크린샷 필요 |
| Step 3 이미지 | `<HowItWorks />` | placeholder — 스크린샷 필요 |
| Use Case 1 (사무실) | `<UseCases />` | placeholder — 스크린샷 필요 |
| Use Case 2 (행사장) | `<UseCases />` | placeholder — 스크린샷 필요 |

총 6개 슬롯. `<ImageSlot src="..." />` prop만 채우면 즉시 반영.

## 비고

- `src` prop이 없는 `ImageSlot`은 빌드/런타임 에러 없이 와이어프레임 패턴을 보여주므로 스크린샷 확보 전에도 페이지가 동작한다.
- Tailwind v4 `@theme`으로 정의한 토큰은 `bg-cream`, `text-ink-muted` 등 유틸리티 클래스로 직접 사용된다.
- `brand` / `accent` 토큰을 `ink`와 동일값(`#0a0a0a`)으로 설정한 것은 의도적 선택 — 향후 컬러 도입 시 토큰만 교체하면 전체 반영.

## 이후 확장

2026-05-06 동일 세션에서 이 파일에서 확정한 토큰이 전체 앱(Navbar/인증/운영자 대시보드/인게임 UI)으로 확산됨.
상세: `landing/2026-05-06-design-system-rollout.md`
