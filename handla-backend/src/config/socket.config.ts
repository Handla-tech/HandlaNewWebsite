import { registerAs } from '@nestjs/config';

export default registerAs('socket', () => ({
  corsOrigin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000',
  namespace: '/',
}));
