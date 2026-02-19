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
    select: { id: true, name: true, image: true },
  });

  if (!user) {
    redirect("/login");
  }

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
        avatar: user.image ?? "default",
      }}
    />
  );
}
