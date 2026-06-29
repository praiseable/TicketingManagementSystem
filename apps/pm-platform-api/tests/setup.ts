process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-test-access-secret-test-access-secret-test-access-secret-0001';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-test-refresh-secret-test-refresh-secret-test-refresh-secret-0002';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://pmuser:pmpassword@localhost:6432/pmplatform?pgbouncer=true';
