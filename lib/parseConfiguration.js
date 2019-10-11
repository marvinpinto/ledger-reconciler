/* global Buffer */

const util = require('util');
const readYaml = util.promisify(require('read-yaml'));
const gpgDecrypt = util.promisify(require('gpg').decrypt);

// Recursive function to decrypt any string keys that are prefixed with
// 'ENCRYPTED'
const decryptSecureKeys = async obj => {
  for (let key in obj) {
    if (typeof obj[key] === 'object') {
      await decryptSecureKeys(obj[key]);
      continue;
    }

    // Ignore any non-string keys
    if (typeof obj[key] !== 'string') {
      continue;
    }

    const encryptedStr = obj[key].match(/^ENCRYPTED:(.+)/i);
    if (encryptedStr && encryptedStr[1]) {
      const rawBuffer = Buffer.from(encryptedStr[1], 'base64');
      const encr = rawBuffer.toString('ascii');
      const decr = await gpgDecrypt(encr);
      obj[key] = decr.toString('ascii').trim(); // eslint-disable-line require-atomic-updates
    }
  }
};

const parseConfiguration = async filename => {
  const encrypted = await readYaml(filename);

  // Need a "deep clone" here as a regular Object.assign will only copy the
  // reference value
  let decrypted = JSON.parse(JSON.stringify(encrypted));
  await decryptSecureKeys(decrypted);

  return {encrypted, decrypted};
};

module.exports = parseConfiguration;
