"use client";

/**
 * 어드민 대시보드 CSV 내보내기 — 도메인 매퍼(순수) + 브라우저 다운로드(DOM) (WI-031).
 *
 * 순수 직렬화/이스케이프/인젝션 중화는 `@/lib/csv`가 담당하고, 여기서는 화면별 컬럼
 * 정책(멤버/로그/analytics)과 다운로드 트리거만 둔다. 매퍼는 DOM 무의존이라 단독 테스트
 * 가능하며, `downloadCsv`만 브라우저 API를 사용한다(useScreenRecorder 다운로드 패턴 동일).
 *
 * 로그 내보내기는 클라가 cursor로 **로드한 분량만** 대상(원장: 클라 측 생성) — 호출부가
 * 버튼 라벨에 건수를 노출해 "로드된 범위"임을 드러낸다.
 */

import { toCsv, CSV_BOM } from "@/lib/csv";
import type { Member } from "@/components/dashboard/member-table";

/** 로그 CSV 입력(로그 페이지 state와 구조 호환 — 내보내기에 필요한 필드만). */
export interface LogExportEntry {
  eventType: string;
  payload?: Record<string, unknown> | null;
  createdAt: string;
  user?: { name: string | null; email: string } | null;
}

/** analytics CSV 입력(analytics 페이지 state와 구조 호환). */
export interface AnalyticsExportData {
  dailyMessages: { date: string; count: number }[];
  dailyVisitors: { date: string; count: number }[];
}

const MEMBER_HEADERS = [
  "Name",
  "Email",
  "Role",
  "Restriction",
  "Guest",
  "Joined",
] as const;
const LOG_HEADERS = ["Time", "Event Type", "User", "Details"] as const;
const ANALYTICS_HEADERS = ["Date", "Messages", "Visitors"] as const;

/** payload 직렬화 실패 시 표기(JSON.stringify가 던지는 경우 — 순환참조 등). */
const UNSERIALIZABLE_PAYLOAD = "[unserializable]";

/**
 * 멤버 목록을 CSV로 직렬화한다. 이름은 MemberTable/filterMembers와 **동일한 표시
 * 우선순위**(truthy `||` 체인)로 해석한다 — `??`(nullish)를 쓰면 빈 문자열 이름이
 * 폴백되지 않아 화면과 CSV가 어긋난다(codex 적출). 최종 폴백은 화면 표기와 동일한 "Unknown".
 */
export function membersToCsv(members: ReadonlyArray<Member>): string {
  const rows = members.map((m) => [
    m.user?.name || m.guestSession?.nickname || m.displayName || "Unknown",
    m.user?.email ?? "",
    m.role,
    m.restriction,
    m.guestSession ? "Yes" : "No",
    m.createdAt,
  ]);
  return toCsv(MEMBER_HEADERS, rows);
}

/** 로드된 이벤트 로그를 CSV로 직렬화한다(화면 정렬 순서 유지). */
export function logsToCsv(logs: ReadonlyArray<LogExportEntry>): string {
  const rows = logs.map((log) => [
    log.createdAt,
    log.eventType,
    log.user?.name || log.user?.email || "",
    stringifyPayload(log.payload),
  ]);
  return toCsv(LOG_HEADERS, rows);
}

function stringifyPayload(payload?: Record<string, unknown> | null): string {
  if (payload == null) return "";
  try {
    return JSON.stringify(payload);
  } catch {
    return UNSERIALIZABLE_PAYLOAD;
  }
}

/**
 * 일별 메시지/방문자 두 시계열을 날짜 union으로 머지해 CSV로 직렬화한다.
 * 한쪽에만 있는 날짜의 결측 값은 0, 날짜는 오름차순(YYYY-MM-DD 사전식=시간순).
 */
export function analyticsToCsv(data: AnalyticsExportData): string {
  const messagesByDate = new Map(
    data.dailyMessages.map((d) => [d.date, d.count])
  );
  const visitorsByDate = new Map(
    data.dailyVisitors.map((d) => [d.date, d.count])
  );
  const dates = [
    ...new Set([...messagesByDate.keys(), ...visitorsByDate.keys()]),
  ].sort();
  const rows = dates.map((date) => [
    date,
    String(messagesByDate.get(date) ?? 0),
    String(visitorsByDate.get(date) ?? 0),
  ]);
  return toCsv(ANALYTICS_HEADERS, rows);
}

/** `flowspace-<kind>-<spaceId>-<YYYY-MM-DD>.csv` 다운로드 파일명을 만든다. */
export function csvFilename(kind: string, spaceId: string, date: Date): string {
  const ymd = date.toISOString().slice(0, 10);
  return `flowspace-${kind}-${spaceId}-${ymd}.csv`;
}

/**
 * CSV 문자열을 BOM과 함께 다운로드한다(브라우저 전용). useScreenRecorder의 앵커 클릭
 * 패턴과 동일 — createObjectURL → a[download] → click → revoke.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([CSV_BOM + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    // click/제거가 던져도 앵커 분리 + objectURL 해제를 보장(누수 방지).
    a.remove();
    URL.revokeObjectURL(url);
  }
}
