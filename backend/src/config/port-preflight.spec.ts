import { createServer, Server } from 'node:net';

import { assertPortAvailable, PortInUseError, portInUseMessage } from './port-preflight';

async function occupyPort(): Promise<{ port: number; server: Server }> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen({ port: 0, host: '0.0.0.0' }, resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('porta de teste indisponível');
  return { port: address.port, server };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

describe('verificação prévia de porta', () => {
  it('aceita uma porta livre e a libera em seguida', async () => {
    const { port, server } = await occupyPort();
    await closeServer(server);

    await expect(assertPortAvailable(port)).resolves.toBeUndefined();
  });

  it('recusa uma porta ocupada com orientação e sem encerrar o processo', async () => {
    const { port, server } = await occupyPort();

    try {
      await expect(assertPortAvailable(port)).rejects.toBeInstanceOf(PortInUseError);
      await expect(assertPortAvailable(port)).rejects.toThrow(portInUseMessage(port));
      expect(server.listening).toBe(true);
    } finally {
      await closeServer(server);
    }
  });
});
