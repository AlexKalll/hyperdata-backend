import { generateKeyPairSync } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { signES256 } from './SantimPay.service';

describe('signES256', () => {
  it('produces a verifiable ES256 token', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
    });
    const token = signES256(
      { amount: 10 },
      privateKey.export({ type: 'pkcs8', format: 'pem' }),
    );

    expect(
      jwt.verify(token, publicKey.export({ type: 'spki', format: 'pem' }), {
        algorithms: ['ES256'],
      }),
    ).toMatchObject({ amount: 10 });
  });

  it('rejects a missing signing key', () => {
    expect(() => signES256({ amount: 10 }, '')).toThrow(
      'Santim Pay signing key is not configured',
    );
  });
});
