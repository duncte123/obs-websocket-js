import SHA256 from 'sha.js/sha256';

export default function (salt = '', challenge = '', msg: string) {
  const hash = new SHA256()
    .update(msg)
    .update(salt)
    .digest('base64');

  return new SHA256()
    .update(hash)
    .update(challenge)
    .digest('base64');
}
