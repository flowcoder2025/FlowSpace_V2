import { prisma } from "./prisma";

const GUEST_SESSION_DURATION_HOURS = 24;

/** 게스트 세션 생성 */
export async function createGuestSession(spaceId: string, nickname: string) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + GUEST_SESSION_DURATION_HOURS);

  const guest = await prisma.guestSession.create({
    data: {
      spaceId,
      nickname,
      expiresAt,
    },
    select: {
      id: true,
      nickname: true,
      sessionToken: true,
      expiresAt: true,
    },
  });

  return guest;
}

/** 게스트 세션 검증 */
export async function validateGuestSession(sessionToken: string) {
  const guest = await prisma.guestSession.findUnique({
    where: { sessionToken },
    include: {
      space: { select: { id: true, name: true, status: true } },
    },
  });

  if (!guest) return null;
  if (guest.expiresAt < new Date()) return null;
  if (guest.space.status !== "ACTIVE") return null;

  return guest;
}
