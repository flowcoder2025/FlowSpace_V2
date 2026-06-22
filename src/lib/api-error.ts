/**
 * API 500 응답 표준화 헬퍼 (WI-023, 순수 서버 유틸 — next/server 의존).
 *
 * 배경: 다수 라우트가 catch 블록에서 `details: error.message`를 그대로 반환해
 * 원본 에러 메시지(Prisma 제약명/컬럼명, 내부 파일 경로, 스택 단편 등)를
 * 클라이언트에 노출했다(CWE-209 정보 노출).
 *
 * 정책:
 * - 원본 에러는 **서버 로그에만** 남긴다(디버깅 가능성 보존).
 * - 클라이언트에는 라우트가 정한 안전한 일반 메시지만 반환한다(app.md 불변식 #4: `{ error }`).
 * - `details`는 어떤 환경에서도(dev 포함) 반환하지 않는다 — 환경별 응답 shape 분기 금지.
 */

import { NextResponse } from "next/server";

/**
 * 500 Internal Server Error 응답을 표준 형식으로 생성한다.
 *
 * @param context 서버 로그 식별용 라우트 태그 (예: `"GET /api/assets"`). 응답에는 포함되지 않음.
 * @param error   catch된 원본 에러 — 서버 로그 전용(클라이언트에 노출 금지).
 * @param message 클라이언트에 노출할 안전한 일반 메시지 (예: `"Failed to fetch assets"`).
 */
export function internalErrorResponse(
  context: string,
  error: unknown,
  message: string
): NextResponse {
  console.error(`[${context}]`, error);
  return NextResponse.json({ error: message }, { status: 500 });
}
