import { describe, it, expect } from "vitest";
import {
  isRemoteDatabase,
  hasExtraStoredKeys,
  normalizeStored,
} from "../../../../scripts/backfill-stored-asset-metadata.core.mjs";

/**
 * 백필 prod 코드 게이트 + 정화 코어 단위 테스트 (WI-026 r3 — codex 우회 적출 해소).
 *
 * codex r2 적출: 전체 URL 문자열 regex는 query/user/pass/db명에 'localhost'가 섞이면
 * 우회된다(`?schema=localhost`). 코어는 이제 `new URL().hostname`만 검사한다 —
 * 아래 우회 케이스가 전부 원격으로 판정되어야 게이트가 실효한다.
 */
describe("isRemoteDatabase — hostname만 검사 (URL 컴포넌트 우회 차단)", () => {
  it("정확한 로컬 호스트는 로컬(false)로 판정한다", () => {
    expect(isRemoteDatabase("postgresql://u:p@localhost:5432/app")).toBe(false);
    expect(isRemoteDatabase("postgresql://u:p@127.0.0.1:5432/app")).toBe(false);
    expect(isRemoteDatabase("postgresql://u:p@[::1]:5432/app")).toBe(false);
  });

  it("원격 호스트는 원격(true)으로 판정한다", () => {
    expect(
      isRemoteDatabase("postgresql://u:p@db.fqhcnudechuchaazwrzg.supabase.co:5432/postgres")
    ).toBe(true);
    expect(isRemoteDatabase("postgresql://u:p@prod.invalid:5432/app")).toBe(true);
  });

  it("query/user/pass/db명에 'localhost'가 섞인 원격 URL을 우회 허용하지 않는다", () => {
    // codex r2 실증 케이스 — hostname은 prod.invalid라 원격이어야 한다.
    expect(
      isRemoteDatabase(
        "postgresql://user:pass@prod.invalid:5432/app?schema=localhost&connect_timeout=1"
      )
    ).toBe(true);
    // username/password에 localhost
    expect(
      isRemoteDatabase("postgresql://localhost:127.0.0.1@prod.invalid:5432/db")
    ).toBe(true);
    // db명에 localhost
    expect(
      isRemoteDatabase("postgresql://u:p@prod.invalid:5432/localhost")
    ).toBe(true);
    // hostname 부분문자열(localhost를 포함하지만 다른 호스트)
    expect(
      isRemoteDatabase("postgresql://u:p@localhost.evil.com:5432/db")
    ).toBe(true);
    expect(
      isRemoteDatabase("postgresql://u:p@127.0.0.1.evil.com:5432/db")
    ).toBe(true);
  });

  it("host/hostaddr query 파라미터로 접속 대상을 바꾼 우회를 차단한다 (libpq override)", () => {
    // codex r3 실증 케이스 — authority는 localhost지만 ?host=가 실제 접속 대상을 바꾼다.
    expect(
      isRemoteDatabase(
        "postgresql://u:p@localhost:5432/app?host=prod.invalid&connect_timeout=1"
      )
    ).toBe(true);
    // hostaddr(IP override)
    expect(
      isRemoteDatabase("postgresql://u:p@localhost:5432/app?hostaddr=8.8.8.8")
    ).toBe(true);
    // 콤마 다중호스트 query — 하나라도 비-로컬이면 원격
    expect(
      isRemoteDatabase("postgresql://u:p@localhost:5432/app?host=localhost,prod.invalid")
    ).toBe(true);
  });

  it("host query가 전부 로컬이면 로컬(false)로 유지한다 (과다 활성 회피)", () => {
    expect(
      isRemoteDatabase("postgresql://u:p@localhost:5432/app?host=127.0.0.1")
    ).toBe(false);
    expect(
      isRemoteDatabase("postgresql://u:p@localhost:5432/app?host=localhost,127.0.0.1")
    ).toBe(false);
  });

  it("반복 host/hostaddr 키도 전부 검사한다 (libpq 마지막-값 우회 차단)", () => {
    // codex r4 실증 — get()은 첫 값만 봐 우회됐다. getAll()로 전부 검사.
    expect(
      isRemoteDatabase("postgresql://u:p@localhost:5432/app?host=localhost&host=prod.invalid")
    ).toBe(true);
    expect(
      isRemoteDatabase("postgresql://u:p@localhost:5432/app?hostaddr=127.0.0.1&hostaddr=8.8.8.8")
    ).toBe(true);
  });

  it("Unix 도메인 소켓(절대경로 host)은 로컬로 인정한다 (로컬 dev UX)", () => {
    // codex r4 P3 — 로컬 소켓은 원격 도달 불가라 confirm 불필요.
    expect(
      isRemoteDatabase("postgresql://u:p@localhost:5432/app?host=%2Fvar%2Frun%2Fpostgresql")
    ).toBe(false);
    expect(
      isRemoteDatabase("postgresql://u:p@localhost:5432/app?host=/var/run/postgresql")
    ).toBe(false);
  });

  it("빈 값은 false(미설정 → 게이트 비활성, dry-run 보호에 의존)", () => {
    expect(isRemoteDatabase("")).toBe(false);
    expect(isRemoteDatabase(undefined)).toBe(false);
  });

  it("파싱 불가/호스트 전무는 보수적으로 원격(true)으로 취급한다", () => {
    expect(isRemoteDatabase("not a url")).toBe(true);
    // 다중호스트 authority(콤마)는 new URL 파싱 실패 → 보수적 원격
    expect(isRemoteDatabase("postgresql://u:p@host1:5432,host2:5432/db")).toBe(true);
  });
});

describe("정화 코어 — hasExtraStoredKeys / normalizeStored", () => {
  it("공개 키(+batchId)만 가진 행은 과다 저장이 아니다(멱등)", () => {
    expect(
      hasExtraStoredKeys({ width: 512, frameWidth: 64, batchId: "batch-1" })
    ).toBe(false);
  });

  it("민감/내부 키가 섞인 행은 과다 저장으로 판정한다", () => {
    expect(
      hasExtraStoredKeys({ width: 512, prompt: "secret", workflow: "wf" })
    ).toBe(true);
  });

  it("null/배열/비객체는 과다 저장 아님(스킵)", () => {
    expect(hasExtraStoredKeys(null)).toBe(false);
    expect(hasExtraStoredKeys(["a"])).toBe(false);
    expect(hasExtraStoredKeys("raw")).toBe(false);
  });

  it("normalizeStored는 허용 키(공개+batchId)만 남기고 민감 필드를 제거한다", () => {
    const out = normalizeStored({
      width: 512,
      frameWidth: 64,
      prompt: "secret",
      workflow: "wf",
      comfyuiJobId: "job-1",
      batchId: "batch-1",
    });
    expect(out).toEqual({ width: 512, frameWidth: 64, batchId: "batch-1" });
  });
});
