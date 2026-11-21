import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { createHash } from 'node:crypto';
import { Op } from 'sequelize';

import { AuthSession } from '../database/models/auth-session.model';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

/** Nunca persiste o JWT: apenas o hash do identificador único da sessão. */
export function hashSessionIdentifier(jti: string): string {
  return createHash('sha256').update(jti).digest('hex');
}

@Injectable()
export class AuthSessionsService {
  private lastCleanupAt = 0;

  constructor(@InjectModel(AuthSession) private readonly sessions: typeof AuthSession) {}

  async create(userId: number, jti: string, expiresAt: Date): Promise<string> {
    // A expiração da NOVA sessão não é o relógio da limpeza: usá-la aqui
    // removeria sessões de outros usuários que ainda estão válidas.
    await this.cleanupExpiredIfDue();

    const tokenIdentifierHash = hashSessionIdentifier(jti);
    await this.sessions.create({
      userId,
      tokenIdentifierHash,
      createdAt: new Date(),
      expiresAt,
      revokedAt: null,
    });

    return tokenIdentifierHash;
  }

  findValid(tokenIdentifierHash: string): Promise<AuthSession | null> {
    return this.sessions.findOne({
      where: {
        tokenIdentifierHash,
        revokedAt: { [Op.is]: null },
        expiresAt: { [Op.gt]: new Date() },
      },
    });
  }

  async revoke(tokenIdentifierHash: string): Promise<boolean> {
    const [affected] = await this.sessions.update(
      { revokedAt: new Date() },
      { where: { tokenIdentifierHash, revokedAt: { [Op.is]: null } } },
    );
    return affected > 0;
  }

  /**
   * Limpeza oportunista: uma vez por hora, no fluxo de login/cadastro.
   * Não cria timer nem worker adicional e remove somente sessões expiradas.
   */
  async cleanupExpiredIfDue(now = Date.now()): Promise<void> {
    if (now - this.lastCleanupAt < CLEANUP_INTERVAL_MS) return;

    // Só registra a execução após o sucesso. Se o banco falhar, a próxima
    // tentativa de login ainda poderá limpar as sessões realmente expiradas.
    await this.sessions.destroy({ where: { expiresAt: { [Op.lt]: new Date(now) } } });
    this.lastCleanupAt = now;
  }
}
