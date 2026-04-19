// Prisma singleton for socket server
// Supabase PgBouncer 환경에서 connection pool 재사용을 위해 단일 인스턴스 유지
// Dynamic import로 번들링 회피 (esbuild --external:@prisma/client)

type PrismaClientType = import("@prisma/client").PrismaClient;

let clientPromise: Promise<PrismaClientType> | null = null;

export function getPrisma(): Promise<PrismaClientType> {
  if (!clientPromise) {
    clientPromise = import("@prisma/client").then(
      ({ PrismaClient }) => new PrismaClient()
    );
  }
  return clientPromise;
}
