/**
 * 主进程日志记录器
 * 简单的日志输出，带时间戳和模块名
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
}

function formatTimestamp(): string {
  return new Date().toISOString()
}

function log(level: LogLevel, module: string, ...args: any[]): void {
  const timestamp = formatTimestamp()
  const prefix = `[${timestamp}] [${LOG_LEVELS[level]}] [${module}]`
  
  switch (level) {
    case 'debug':
      console.debug(prefix, ...args)
      break
    case 'info':
      console.info(prefix, ...args)
      break
    case 'warn':
      console.warn(prefix, ...args)
      break
    case 'error':
      console.error(prefix, ...args)
      break
  }
}

export const logger = {
  debug: (module: string, ...args: any[]) => log('debug', module, ...args),
  info: (module: string, ...args: any[]) => log('info', module, ...args),
  warn: (module: string, ...args: any[]) => log('warn', module, ...args),
  error: (module: string, ...args: any[]) => log('error', module, ...args),
}
