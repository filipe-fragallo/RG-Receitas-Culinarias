/** Detecta o runtime de Functions da Vercel sem depender de PORT ou NODE_ENV. */
export function isVercelRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL === '1';
}
