type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  path?: string | null;
  operationType?: string;
  userId?: string;
  extra?: Record<string, unknown>;
}

function format(level: LogLevel, message: string, ctx: LogContext = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...ctx,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else if (level === 'debug') console.debug(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => format('debug', msg, ctx),
  info: (msg: string, ctx?: LogContext) => format('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext) => format('warn', msg, ctx),
  error: (msg: string, ctx?: LogContext) => format('error', msg, ctx),
};
