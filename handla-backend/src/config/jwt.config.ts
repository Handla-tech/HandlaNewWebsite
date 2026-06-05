import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'dev_secret_change_in_prod',
  expiresIn: parseInt(process.env.JWT_EXPIRATION || '900', 10),
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_in_prod',
  refreshExpiresIn: parseInt(process.env.JWT_REFRESH_EXPIRATION || '604800', 10),
}));
