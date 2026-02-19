# ⚠️ MANDATORY: Session Start Protocol

> **Claude는 모든 작업 시작 전 이 섹션을 반드시 확인해야 함**

## 전역 규칙 참조 (필수)
다음 전역 CLAUDE.md (`~/.claude/CLAUDE.md`) 규칙을 준수:
- Git 커밋 컨벤션: 영어 prefix + 한글 본문 (예: `feat: 인증 시스템 추가`)
- Memory System: 사용자가 `/mem:load` 요청 시 실행
- Epic > Phase > Task 계층 추적
- DocOps: Phase 완료 시 스펙 문서 생성

## 프로젝트 규칙 체크리스트 (필수)
작업 시작 전 다음 항목 확인:
- [ ] **경계 분리**: 변경 전 "이 코드의 경계는 무엇인가?" 정의
- [ ] **모듈화**: `module/index.ts` + `module/internal/` 구조 준수
- [ ] **캡슐화**: `index.ts`만 외부 노출, `internal/*` 직접 import 금지
- [ ] **컴포넌트 재사용**: 2회 이상 반복 → 분리
- [ ] **하드코딩 금지**: 상수는 `constants/`로 분리
- [ ] **UTF-8**: 모든 파일 UTF-8 (BOM 없음)

## 위반 시
**이 체크리스트를 확인하지 않고 작업 시작 시, 사용자에게 경고 후 체크리스트 확인**

---

# Project Rules

## Architecture Flow (Core)

```
경계 분리(개념) → 모듈화(구조) → 캡슐화(접근제어)
```

### 1. 경계 분리 (Boundary)
- 변경 전 "이 코드의 경계는 무엇인가?" 먼저 정의
- 새 코드는 반드시 특정 경계에 소속

### 2. 모듈화 (Module)
- 경계 = 모듈 폴더
- 구조: `module/index.ts` + `module/internal/`

### 3. 캡슐화 (Encapsulation)
- `index.ts`만 외부 노출 (Public API)
- `internal/*` 외부 import 금지

## Structure
```
moduleA/
  index.ts        # Public API
  internal/       # Private
```

---

## Code Quality Rules

### 컴포넌트 재사용 (Component Reuse)
- **같은 UI/로직이 2번 이상 나오면 컴포넌트로 분리**
- 기존 컴포넌트 확인 후 새로 만들기 (중복 생성 금지)
- 공통 컴포넌트는 `shared/` 또는 `common/` 모듈에 배치

```
❌ 복붙해서 여러 곳에 같은 코드
✅ 컴포넌트화 후 import해서 재사용
```

### 하드코딩 금지 (No Hardcoding)
- **문자열, 숫자, URL 등 직접 코드에 박지 않기**
- 상수는 `constants/` 또는 설정 파일로 분리
- 환경별 값은 환경변수 사용

### UTF-8 인코딩 (Encoding)
- **모든 파일은 UTF-8 (BOM 없음) 저장**
- 파일 읽기/쓰기 시 `utf-8` 명시
- HTML은 `<meta charset="UTF-8">` 필수

---

## PR Checklist
- [ ] 경계(모듈)는?
- [ ] internal 직접 import 없음?
- [ ] 공개 API 최소화?
- [ ] 중복 컴포넌트 없이 재사용?
- [ ] 하드코딩된 값 없음?
