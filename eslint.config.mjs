import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@next/next/no-img-element": "off",
      // 캡슐화 강제: 타 모듈의 internal/* 직접 import 금지 (WI-003).
      // 동일 모듈은 상대경로(./internal)를 쓰므로 영향 없음.
      // server/**·scripts/** 는 globalIgnores 대상(별도 빌드/툴 — 순수 계약 예외).
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // 타 모듈 internal 접근 차단(alias 정밀 차단, 오탐 0):
              //  - "@/**/internal"      : internal 디렉토리 루트 import 차단
              //  - "@/**/internal/**"   : internal 하위 경로 import 차단
              //  동일 모듈은 "./internal/*"(상대경로)를 쓰므로 매칭되지 않음.
              //  본 코드베이스는 cross-module import에 100% @/ alias를 쓰며(상대경로
              //  internal import는 0건), 상대경로로의 cross-module internal 침범은
              //  glob 문자열로는 동일모듈 상향(`../../internal/*`)과 정밀 구분이 불가능하다.
              //  → 상대경로 침범 차단은 path-resolving 경계 플러그인이 필요하므로 후속
              //    boundary WI 범위로 분리(현재는 @/ alias 컨벤션으로 실질 차단됨).
              group: ["@/**/internal", "@/**/internal/**"],
              message:
                "타 모듈의 internal/* 직접 import 금지 — 해당 모듈의 배럴(index.ts)을 통해 import하세요 (경계 캡슐화).",
            },
            {
              // EventBridge 공개 계약 단일 진입점 강제 (WI-012-2 S3):
              // game/events 서브배럴을 타 모듈이 직접 import 금지 — 최상위 game 배럴(@/features/space/game) 경유.
              // "**/game/events" glob은 alias(@/features/space/game/events)와 상대(../../game/events)를 모두 차단하며,
              // game 내부(game/internal/**)의 상대경로 "../events"/"../../events"는 game 세그먼트가 없어 미매칭(영향 0).
              group: ["**/game/events", "**/game/events/**"],
              message:
                "game/events 서브배럴 직접 import 금지 — 최상위 배럴 @/features/space/game 을 통해 import하세요 (공개 계약 단일 진입점). game 내부 파일만 상대경로 ../events 허용.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "comfyui-workflows/**",
    "server/**",
    "scripts/**",
  ]),
])

export default eslintConfig
