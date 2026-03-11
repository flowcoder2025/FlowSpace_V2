import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  // 멤버십 자동 생성 (스페이스 입장 시 PARTICIPANT로 자동 가입)
  const existingMember = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: id, userId: user.id } },
    select: { id: true },
  });

  if (!existingMember) {
    // 오너가 아닌 경우에만 생성 (오너는 LiveKit에서 별도 체크)
    const isOwner = await prisma.space.findFirst({
      where: { id, ownerId: user.id },
      select: { id: true },
    });

    if (!isOwner) {
      await prisma.spaceMember.create({
        data: {
          spaceId: id,
          userId: user.id,
          displayName: user.name,
          role: "PARTICIPANT",
        },
      });
    }
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
      }}
    />
  );
}
