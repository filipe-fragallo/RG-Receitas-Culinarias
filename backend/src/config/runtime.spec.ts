import { isVercelRuntime } from './runtime';

describe('isVercelRuntime', () => {
  it('identifica apenas VERCEL=1 como runtime de Functions', () => {
    expect(isVercelRuntime({ VERCEL: '1' })).toBe(true);
    expect(isVercelRuntime({ VERCEL: '0' })).toBe(false);
    expect(isVercelRuntime({})).toBe(false);
  });
});
