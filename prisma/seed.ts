import 'dotenv/config';
import { createHmac, randomBytes, randomInt } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Демо-данные для локальной разработки: npx prisma db seed.
 * Токены управления печатаются в консоль.
 */
const pepper = process.env.TOKEN_PEPPER ?? 'dev-token-pepper-not-for-production';
const hash = (token: string) => createHmac('sha256', pepper).update(token).digest('hex');

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const code = () =>
  `AVA-${Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')}`;

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL не задан');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  const demos = [
    {
      title: 'Вечерний футбол на Динамо',
      format: 'FIVE_A_SIDE' as const,
      skillLevel: 'ANY' as const,
      startsAt: hoursFromNow(30),
      venueName: 'Манеж «Динамо»',
      address: 'Ленинградский пр-т, 36',
      latitude: 55.7912,
      longitude: 37.559,
      maxPlayers: 10,
      minPlayers: 6,
      pricePerPitch: 600_000,
      players: 7,
    },
    {
      title: 'Утренний матч в Лужниках',
      format: 'SEVEN_A_SIDE' as const,
      skillLevel: 'INTERMEDIATE' as const,
      startsAt: hoursFromNow(52),
      venueName: 'Лужники, поле №4',
      address: 'ул. Лужники, 24',
      latitude: 55.7158,
      longitude: 37.5537,
      maxPlayers: 14,
      minPlayers: 10,
      pricePerPitch: 1_200_000,
      players: 12,
    },
    {
      title: 'Дворовый футбол — все свои',
      format: 'FIVE_A_SIDE' as const,
      skillLevel: 'BEGINNER' as const,
      startsAt: hoursFromNow(6),
      venueName: 'Коробка во дворе',
      address: 'ул. Профсоюзная, 42',
      latitude: 55.6785,
      longitude: 37.5636,
      maxPlayers: 10,
      minPlayers: 4,
      pricePerPitch: 0,
      players: 10, // полный состав + лист ожидания
    },
  ];

  const positions = ['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD', 'ANY'] as const;
  const names = [
    'Александр',
    'Дмитрий',
    'Сергей',
    'Андрей',
    'Иван',
    'Максим',
    'Никита',
    'Егор',
    'Павел',
    'Олег',
    'Тимур',
    'Виктор',
    'Роман',
    'Кирилл',
  ];

  for (const demo of demos) {
    const hostToken = randomBytes(32).toString('base64url');
    const { players, ...gameData } = demo;

    const game = await prisma.game.create({
      data: {
        ...gameData,
        code: code(),
        description: 'Демо-игра из seed-скрипта. Раздевалки есть, мяч найдётся.',
        durationMinutes: 90,
        timezone: 'Europe/Moscow',
        currency: 'RUB',
        cancelDeadline: new Date(demo.startsAt.getTime() - 6 * 3_600_000),
        city: 'Москва',
        hostName: 'Организатор',
        hostTokenHash: hash(hostToken),
        createdIpHash: hash('seed'),
        status: 'OPEN',
      },
    });

    let waitlistOrder = 0;
    for (let i = 0; i < players; i += 1) {
      const isMain = i < demo.maxPlayers;
      if (!isMain) waitlistOrder += 1;
      await prisma.participant.create({
        data: {
          gameId: game.id,
          name: names[i % names.length]!,
          nickname: `${names[i % names.length]}_${i + 1}`,
          position: positions[i % positions.length]!,
          skillLevel: i % 3 === 0 ? 'ADVANCED' : i % 3 === 1 ? 'INTERMEDIATE' : 'BEGINNER',
          attendance: i % 4 === 3 ? 'MAYBE' : 'CONFIRMED',
          role: isMain ? 'MAIN' : 'WAITLIST',
          waitlistOrder: isMain ? null : waitlistOrder,
          tokenHash: hash(`seed-player-${game.id}-${i}`),
        },
      });
    }
    if (players >= demo.maxPlayers) {
      await prisma.game.update({ where: { id: game.id }, data: { status: 'FULL' } });
    }

    console.log(`${game.code}  «${game.title}»  host-токен: ${hostToken}`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
