import 'dotenv/config';

process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ?? 'test-secret-key-for-unit-tests-32-chars';
