/**
 * 슈퍼어드민 부트스트랩 스크립트.
 *
 * 슈퍼어드민 플래그(User.isSuperAdmin)는 UI로 부여하지 않고 이 스크립트로만 관리한다.
 * (최초 슈퍼어드민 생성 = 신뢰 부트스트랩이므로 DB 직접 조작 경로를 단일화)
 *
 * 사용법:
 *   node scripts/set-super-admin.mjs <email> [true|false]   # 부여(기본) / 회수
 *   node scripts/set-super-admin.mjs --list                 # 현재 슈퍼어드민 목록
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();

const prisma = new PrismaClient();

async function list() {
  const supers = await prisma.user.findMany({
    where: { isSuperAdmin: true },
    select: { email: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`현재 슈퍼어드민 (${supers.length}명):`);
  supers.forEach((u) => console.log(`  - ${u.email} (${u.name ?? "no-name"})`));
}

async function main() {
  const arg = process.argv[2];

  if (!arg || arg === "--list") {
    await list();
    return;
  }

  const email = arg;
  const next = process.argv[3] !== "false"; // 기본 true, 'false' 명시 시에만 회수

  const before = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isSuperAdmin: true },
  });

  if (!before) {
    console.error(`[실패] 사용자를 찾을 수 없음: ${email}`);
    console.error("  → 해당 이메일로 최소 1회 로그인하여 User 레코드가 생성된 뒤 다시 실행하세요.");
    process.exitCode = 1;
    return;
  }

  if (before.isSuperAdmin === next) {
    console.log(`[변경없음] ${email} 은 이미 isSuperAdmin=${next} 입니다.`);
  } else {
    await prisma.user.update({
      where: { email },
      data: { isSuperAdmin: next },
    });
    console.log(`[완료] ${email} : isSuperAdmin ${before.isSuperAdmin} → ${next}`);
  }

  console.log("");
  await list();
}

main()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
