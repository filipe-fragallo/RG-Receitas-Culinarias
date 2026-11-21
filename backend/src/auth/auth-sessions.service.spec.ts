import { Op } from 'sequelize';

import { AuthSessionsService, hashSessionIdentifier } from './auth-sessions.service';

interface Row {
  userId: number;
  tokenIdentifierHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

interface FindOptions {
  where: {
    tokenIdentifierHash: string;
    revokedAt: unknown;
    expiresAt: Record<symbol, Date>;
  };
}

interface DestroyOptions {
  where: { expiresAt: Record<symbol, Date> };
}

interface SessionsModelMock {
  rows: Row[];
  create: jest.Mock<Promise<{ id: number }>, [Row]>;
  findOne: jest.Mock<Promise<unknown>, [FindOptions]>;
  update: jest.Mock<Promise<[number]>, [unknown, unknown]>;
  destroy: jest.Mock<Promise<number>, [DestroyOptions]>;
}

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
const ONE_HOUR = 60 * 60 * 1000;

function createModel(): SessionsModelMock {
  const rows: Row[] = [];

  const model: SessionsModelMock = {
    rows,
    create: jest.fn<Promise<{ id: number }>, [Row]>().mockImplementation((attributes) => {
      rows.push({ ...attributes });
      return Promise.resolve({ id: rows.length });
    }),
    findOne: jest.fn<Promise<unknown>, [FindOptions]>().mockResolvedValue(null),
    update: jest.fn<Promise<[number]>, [unknown, unknown]>().mockResolvedValue([1]),
    destroy: jest.fn<Promise<number>, [DestroyOptions]>().mockImplementation(({ where }) => {
      const cutoff = where.expiresAt[Op.lt];
      let removed = 0;

      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (rows[index].expiresAt < cutoff) {
          rows.splice(index, 1);
          removed += 1;
        }
      }

      return Promise.resolve(removed);
    }),
  };

  return model;
}

function addRow(model: SessionsModelMock, userId: number, jti: string, expiresAt: Date): Row {
  const row: Row = {
    userId,
    tokenIdentifierHash: hashSessionIdentifier(jti),
    createdAt: new Date(NOW - ONE_HOUR),
    expiresAt,
    revokedAt: null,
  };
  model.rows.push(row);
  return row;
}

describe('AuthSessionsService', () => {
  let model: SessionsModelMock;
  let service: AuthSessionsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    model = createModel();
    service = new AuthSessionsService(model as never);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores only the SHA-256 hash of the session identifier', async () => {
    const expiresAt = new Date(NOW + ONE_HOUR);
    const hash = await service.create(7, 'jti-secreto', expiresAt);

    expect(hash).toBe(hashSessionIdentifier('jti-secreto'));
    expect(hash).not.toContain('jti-secreto');
    expect(model.create).toHaveBeenCalledWith({
      userId: 7,
      tokenIdentifierHash: hash,
      createdAt: new Date(NOW),
      expiresAt,
      revokedAt: null,
    });
  });

  it('looks up only non-revoked, non-expired sessions by hash', async () => {
    await service.findValid('hash');

    const where = model.findOne.mock.calls[0][0].where;
    expect(where.tokenIdentifierHash).toBe('hash');
    expect(where.revokedAt).toEqual({ [Op.is]: null });
    expect(where.expiresAt[Op.gt]).toBeInstanceOf(Date);
  });

  it('revokes a single session and reports when it was already revoked', async () => {
    await expect(service.revoke('hash')).resolves.toBe(true);
    expect(model.update).toHaveBeenCalledWith(
      { revokedAt: expect.any(Date) as Date },
      { where: { tokenIdentifierHash: 'hash', revokedAt: { [Op.is]: null } } },
    );

    model.update.mockResolvedValueOnce([0]);
    await expect(service.revoke('hash')).resolves.toBe(false);
  });

  it('uses the current time, not the new session expiry, as the cleanup cutoff', async () => {
    addRow(model, 1, 'sessao-expirada', new Date(NOW - 1_000));
    const stillValid = addRow(model, 2, 'sessao-valida', new Date(NOW + ONE_HOUR));

    await service.create(3, 'nova-sessao', new Date(NOW + 2 * ONE_HOUR));

    expect(model.destroy.mock.calls[0][0].where.expiresAt[Op.lt]).toEqual(new Date(NOW));
    expect(model.rows.map((row) => row.userId)).toEqual([2, 3]);
    expect(model.rows).toContainEqual(stillValid);
  });

  it('does not invalidate active sessions of another user on a new login', async () => {
    const firstUser = addRow(model, 10, 'usuario-a', new Date(NOW + 30 * 60 * 1000));
    const secondUser = addRow(model, 11, 'usuario-b', new Date(NOW + 90 * 60 * 1000));
    addRow(model, 12, 'usuario-c-expirado', new Date(NOW - 1));

    await service.create(13, 'usuario-d', new Date(NOW + 4 * ONE_HOUR));

    expect(model.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: 10, tokenIdentifierHash: firstUser.tokenIdentifierHash }),
        expect.objectContaining({
          userId: 11,
          tokenIdentifierHash: secondUser.tokenIdentifierHash,
        }),
      ]),
    );
    expect(model.rows.some((row) => row.userId === 12)).toBe(false);
  });

  it('does not delete prematurely valid sessions after an API restart', async () => {
    const survivor = addRow(model, 20, 'sobrevivente', new Date(NOW + 45 * 60 * 1000));

    // Um restart zera o controle em memória; a limpeza volt a rodar, mas com o
    // relógio atual — não com a expiração da sessão recém-criada.
    const restartedService = new AuthSessionsService(model as never);
    await restartedService.create(21, 'nova-apos-restart', new Date(NOW + 9 * ONE_HOUR));

    expect(model.destroy).toHaveBeenCalledTimes(1);
    expect(model.rows).toContainEqual(survivor);
  });

  it('cleans expired sessions at most once per hour', async () => {
    await service.cleanupExpiredIfDue(NOW);
    await service.cleanupExpiredIfDue(NOW + 1_000);

    expect(model.destroy).toHaveBeenCalledTimes(1);
    expect(model.destroy.mock.calls[0][0].where.expiresAt[Op.lt]).toEqual(new Date(NOW));

    await service.cleanupExpiredIfDue(NOW + 3_600_001);
    expect(model.destroy).toHaveBeenCalledTimes(2);
  });

  it('allows an immediate retry when the cleanup fails', async () => {
    model.destroy.mockRejectedValueOnce(new Error('falha no banco'));

    await expect(service.cleanupExpiredIfDue()).rejects.toThrow('falha no banco');
    await expect(service.cleanupExpiredIfDue()).resolves.toBeUndefined();

    expect(model.destroy).toHaveBeenCalledTimes(2);
  });
});
