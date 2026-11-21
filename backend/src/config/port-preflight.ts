import { createServer } from 'node:net';

/** Erro usado quando a porta escolhida já está ocupada antes do bootstrap. */
export class PortInUseError extends Error {
  constructor(readonly port: number) {
    super(portInUseMessage(port));
    this.name = 'PortInUseError';
  }
}

export function portInUseMessage(port: number): string {
  return (
    `A porta ${port} já está em uso antes da inicialização da API. ` +
    `Identifique o processo com: lsof -nP -iTCP:${port} -sTCP:LISTEN ` +
    `(macOS/Linux) ou netstat -ano | findstr :${port} (Windows). ` +
    'Encerre-o manualmente, se desejar, ou defina outra porta em PORT no backend/.env ' +
    'e ajuste VITE_PROXY_TARGET no frontend/.env. Nenhum processo foi encerrado automaticamente.'
  );
}

/**
 * Verifica a porta antes de criar o módulo Nest, abrir conexões ou aplicar
 * migrations. A verificação apenas tenta escutar e fecha imediatamente o socket;
 * ela não mata processos nem altera portas configuradas.
 */
export async function assertPortAvailable(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = createServer();

    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        reject(new PortInUseError(port));
        return;
      }
      reject(error);
    });

    server.listen({ port, host: '0.0.0.0', exclusive: true }, () => {
      server.close((closeError) => {
        if (closeError) reject(closeError);
        else resolve();
      });
    });
  });
}
