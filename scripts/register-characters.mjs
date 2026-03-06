import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config();

const prisma = new PrismaClient();

const USER_ID = 'cmltb99mb0000tds0j1mb2ms8';

const characters = [
  { id: 'c02-sprite-96x128', name: 'Chibi C02 - Maid', file: '/assets/generated/c02_spritesheet_96x128.png' },
  { id: 'chibi_c03', name: 'Chibi C03 - Goggle Boy', file: '/assets/generated/c03_spritesheet_96x128.png' },
  { id: 'chibi_c04', name: 'Chibi C04 - Glasses Girl', file: '/assets/generated/c04_spritesheet_96x128.png' },
  { id: 'chibi_c05', name: 'Chibi C05 - White Hair Boy', file: '/assets/generated/c05_spritesheet_96x128.png' },
  { id: 'chibi_c07', name: 'Chibi C07 - Ribbon Girl', file: '/assets/generated/c07_spritesheet_96x128.png' },
];

async function main() {
  // Check existing
  const existing = await prisma.generatedAsset.findMany({
    where: { type: 'CHARACTER' },
    select: { id: true, name: true, filePath: true },
  });
  console.log(`Existing CHARACTER assets: ${existing.length}`);
  existing.forEach(a => console.log(`  ${a.id} | ${a.name} | ${a.filePath}`));

  // Upsert characters
  for (const char of characters) {
    const result = await prisma.generatedAsset.upsert({
      where: { id: char.id },
      create: {
        id: char.id,
        userId: USER_ID,
        type: 'CHARACTER',
        name: char.name,
        prompt: 'chibi character spritesheet',
        workflow: 'v5_chibi_pipeline',
        filePath: char.file,
        metadata: { frameWidth: 96, frameHeight: 128 },
        status: 'COMPLETED',
      },
      update: {
        name: char.name,
        filePath: char.file,
        metadata: { frameWidth: 96, frameHeight: 128 },
        status: 'COMPLETED',
      },
    });
    console.log(`Registered: ${result.id} | ${result.name} | ${result.status}`);
  }

  // Verify
  const all = await prisma.generatedAsset.findMany({
    where: { type: 'CHARACTER', status: 'COMPLETED' },
    select: { id: true, name: true, filePath: true },
  });
  console.log(`\nTotal CHARACTER assets: ${all.length}`);
  all.forEach(a => console.log(`  ${a.id} | ${a.name}`));

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
