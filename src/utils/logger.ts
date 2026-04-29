import pino from 'pino';

const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
const isDev = !isTest && process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: isTest ? 'silent' : (process.env.LOG_LEVEL || 'info'),
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.token',
    ],
    censor: '[REDACTED]',
  },
});
