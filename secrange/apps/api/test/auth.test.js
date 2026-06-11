import test from 'node:test';
import assert from 'node:assert';
import { newRefreshToken, hashToken } from '../src/lib/tokens.js';

test('refresh token hash is stable and one-way', () => {
  const { raw, hash } = newRefreshToken();
  assert.equal(hashToken(raw), hash);
  assert.notEqual(raw, hash);
  assert.equal(hash.length, 64);
});
test('two refresh tokens are unique', () => {
  assert.notEqual(newRefreshToken().raw, newRefreshToken().raw);
});
