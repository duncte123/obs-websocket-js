import { sha256 as SHA256 } from 'sha.js';

export default function(salt: string, challenge: string, msg: string): string {
  const hash = new SHA256()
    .update(msg)
    .update(salt)
    .digest('base64');

  return new SHA256()
    .update(hash)
    .update(challenge)
    .digest('base64');
}
