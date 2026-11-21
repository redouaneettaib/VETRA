export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (!process.env.DATABASE_URL) return;
  try {
    const [{ db }, { ensureDcspDemoReportsNormalized }] = await Promise.all([
      import('@/lib/prisma'),
      import('@/lib/demo-dcsp'),
    ]);
    await ensureDcspDemoReportsNormalized(db);
  } catch (error) {
    console.warn(
      'VETRA instrumentation :',
      error instanceof Error ? error.message : error,
    );
  }
}
