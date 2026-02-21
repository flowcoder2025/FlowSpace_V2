import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Test User
  const password = await bcrypt.hash("password123", 12);
  const testUser = await prisma.user.upsert({
    where: { email: "test@flowspace.dev" },
    update: {},
    create: {
      email: "test@flowspace.dev",
      name: "Test User",
      password,
      avatarConfig: {
        avatarString:
          "parts:body_01:f5d0a9|hair_01:2a1a0a|eyes_01|top_01:4060c0|bottom_01:304080|acc_none",
      },
    },
  });
  console.log(`  User: ${testUser.email} (id: ${testUser.id})`);

  // 2. Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@flowspace.dev" },
    update: {},
    create: {
      email: "admin@flowspace.dev",
      name: "Admin",
      password,
      isSuperAdmin: true,
      avatarConfig: {
        avatarString:
          "parts:body_02:e8b88a|hair_03:c08040|eyes_02|top_03:c04040|bottom_02:404040|acc_01",
      },
    },
  });
  console.log(`  Admin: ${adminUser.email} (id: ${adminUser.id})`);

  // 3. Templates
  const templates = [
    {
      key: "OFFICE" as const,
      name: "Office",
      description: "Professional office space for team collaboration",
      assetsPath: "/assets/templates/office",
    },
    {
      key: "CLASSROOM" as const,
      name: "Classroom",
      description: "Educational space for teaching and learning",
      assetsPath: "/assets/templates/classroom",
    },
    {
      key: "LOUNGE" as const,
      name: "Lounge",
      description: "Casual social space for hanging out",
      assetsPath: "/assets/templates/lounge",
    },
  ];

  for (const t of templates) {
    const template = await prisma.template.upsert({
      where: { key: t.key },
      update: { name: t.name, description: t.description },
      create: t,
    });
    console.log(`  Template: ${template.name} (${template.key})`);
  }

  // 4. Sample Space
  const officeTemplate = await prisma.template.findUnique({
    where: { key: "OFFICE" },
  });

  if (officeTemplate) {
    const space = await prisma.space.upsert({
      where: { inviteCode: "demo-space-001" },
      update: {},
      create: {
        name: "FlowSpace Demo",
        description: "Welcome to FlowSpace! Explore the demo space.",
        ownerId: testUser.id,
        templateId: officeTemplate.id,
        inviteCode: "demo-space-001",
        accessType: "PUBLIC",
        maxUsers: 20,
      },
    });
    console.log(`  Space: ${space.name} (invite: ${space.inviteCode})`);

    // Owner membership
    await prisma.spaceMember.upsert({
      where: {
        spaceId_userId: { spaceId: space.id, userId: testUser.id },
      },
      update: {},
      create: {
        spaceId: space.id,
        userId: testUser.id,
        displayName: testUser.name,
        role: "OWNER",
      },
    });
  }

  // 5. Asset Workflows
  const workflows = [
    {
      name: "Character Sprite Generator",
      description: "Generate 4-direction character sprite sheets",
      assetType: "CHARACTER" as const,
      template: { type: "character-sprite", version: "1.0" },
    },
    {
      name: "Tileset Generator",
      description: "Generate tile-based map textures",
      assetType: "TILESET" as const,
      template: { type: "tileset-grid", version: "1.0" },
    },
    {
      name: "Map Background Generator",
      description: "Generate map background images",
      assetType: "MAP" as const,
      template: { type: "map-background", version: "1.0" },
    },
  ];

  for (const w of workflows) {
    await prisma.assetWorkflow.upsert({
      where: { id: `seed-${w.assetType.toLowerCase()}` },
      update: { name: w.name, description: w.description },
      create: {
        id: `seed-${w.assetType.toLowerCase()}`,
        ...w,
      },
    });
    console.log(`  Workflow: ${w.name}`);
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
