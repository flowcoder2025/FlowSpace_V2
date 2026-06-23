import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveSpaceRoleDecision } from "@/lib/space-role";
import SpaceClient from "./space-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SpacePage({ params }: PageProps) {
  const session = await auth();
  const { id } = await params;

  // 게스트/미인증 → 로그인
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/space/${id}`);
  }

  // 공간 데이터 조회
  const space = await prisma.space.findUnique({
    where: { id, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      description: true,
      maxUsers: true,
      ownerId: true,
      accessType: true,
      template: { select: { key: true, name: true } },
      _count: { select: { members: true } },
    },
  });

  if (!space) {
    redirect("/my-spaces");
  }

  // 유저 정보
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, image: true, avatarConfig: true },
  });

  if (!user) {
    redirect("/login");
  }

  // 멤버십 + 인-스페이스 role 결정.
  // 인-스페이스 권한 SoT = SpaceMember.role (소켓 join:space·requireSpaceAdmin 정합).
  // 클라이언트가 다른 근거로 role을 추정하면 권한 UI는 열리나 소켓이 거부하는 발산이 생긴다.
  const isOwner = space.ownerId === session.user.id;

  const member = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: id, userId: user.id } },
    select: { role: true },
  });

  const decision = resolveSpaceRoleDecision({
    memberRole: member?.role ?? null,
    isOwner,
    accessType: space.accessType,
  });

  // PRIVATE/PASSWORD 스페이스는 초대 코드로만 가입 가능
  if (decision.action === "redirect") {
    redirect("/my-spaces");
  }

  let role = decision.role;
  if (decision.action === "create") {
    // owner=OWNER self-heal / PUBLIC 비멤버=PARTICIPANT 자동 가입
    const created = await prisma.spaceMember.create({
      data: {
        spaceId: id,
        userId: user.id,
        displayName: user.name,
        role: decision.role,
      },
      select: { role: true },
    });
    role = created.role;
  }

  // avatarConfig에서 avatarString 추출, 없으면 userId 해시 폴백
  const avatarConfig = user.avatarConfig as Record<string, unknown> | null;
  const avatarString = (avatarConfig?.avatarString as string) ?? user.image ?? "default";

  return (
    <SpaceClient
      space={{
        id: space.id,
        name: space.name,
        description: space.description,
        maxUsers: space.maxUsers,
        memberCount: space._count.members,
      }}
      user={{
        id: user.id,
        nickname: user.name ?? "Anonymous",
        avatar: avatarString,
        role,
      }}
    />
  );
}
