const crypto = require('crypto');
const axios = require('axios');
const uuid = require('uuid/v4');
const forge = require('node-forge');
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
const util = require('util');

axiosCookieJarSupport(axios);

class PCMastercard {
  constructor(logger, username, password) {
    this.logger = logger;

    this.logger.debug('Generating local keys');
    this.localKeys = {
      generic: {
        key: crypto.randomBytes(16).toString('hex'),
        iv: crypto.randomBytes(8).toString('hex'),
      },
      idm: {
        key: crypto.randomBytes(16).toString('hex'),
        iv: crypto.randomBytes(8).toString('hex'),
      },
      pin: {
        key: crypto.randomBytes(16).toString('hex'),
        iv: crypto.randomBytes(8).toString('hex'),
      },
    };
    this.logger.debug(`Generated local keys: ${JSON.stringify(this.localKeys)}`);

    // Initialize the axios instance
    this.cookieJar = new tough.CookieJar();
    this.http = axios.create({
      jar: this.cookieJar,
      baseURL: 'https://app.pcfinancial.ca/cardinal/v1',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.80 Safari/537.36',
        accept: 'application/json',
        'wrapped-encrypted-payload': true,
        groupid: 'pcf_securesite_web',
        'channel-timezone-name': 'America/New_York',
        "fingerprint": "localCountry#^##^#localLang#^#en#^#localVariant#^##^#userAgent#^#Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.80 Safari/537.36",
        'language': 'en',
        'uservice-channel-type': 'DESKTOP_WEB',
      },
      responseType: 'json',
      withCredentials: true,
    });

    this.http.interceptors.request.use(request => this.axiosRequestInterceptor(request));
    // this.http.interceptors.response.use(response => this.axiosResponseInterceptor(response));
  }

  axiosRequestInterceptor(config) {
    // Dynamic HTTP headers
    config.headers['x-nonce'] = uuid();
    config.headers['uservice-traceability-id'] = uuid();
    config.headers['uservice-correlation-id'] = uuid();
    config.headers['uservice-api-version'] = 1;
    config.headers['uservice-message-id'] = uuid();
    return config;
  }

  // axiosResponseInterceptor(response) {
  //   this.logger.debug("RAW AXIOS RESPONSE: " + JSON.stringify(response));
  //   return response;
  // }

  sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
  }

  async login(username, password) {
    let data;

    // Is the user enrolled in the new system?
    data = await this.httpRequest({
      method: 'post',
      url: '/customer/check-migration',
      headers: {
        'SESSION_INPUT_ALL': this.encryptUsingScheme1('generic', this.localKeys.generic.key + this.localKeys.generic.iv),
      },
      data: {
        encryptedData: this.encryptUsingScheme3('generic', JSON.stringify({username: username})),
      },
    });
    if (data.sendToEnrollment) {
      throw new Error('Please log in to the PC Mastercard web interface and go through the enrollment procedure.');
    }
    this.logger.debug('Enrollment check complete, user may procede');

    data = await this.httpRequest({
      method: 'post',
      url: '/login',
      headers: {
        'REQUEST_INPUT_PASSWORD': this.encryptUsingScheme1('idm', this.localKeys.idm.key + this.localKeys.idm.iv),
      },
      data: {
        authentication: {
          client_id: this.pcClientInfo.clientId,
          client_secret: this.pcClientInfo.clientSecret,
          scope: this.pcClientInfo.scope,
          nonce: new Date().getTime().toString(),
          // nonce: crypto.randomBytes(8).toString('hex'),
          username: username,
          password: this.encryptUsingScheme2('idm', password),
        },
        "deviceFingerprint": {
          "SessionData": {
            "clientApplication": "pcf_securesite_web"
          },
          "UserData": {
            "groupId": "pcf_securesite_web"
          },
          "CookieList": {
            "CookieData": {
              "fingerPrint": `localCountry#^##^#localLang#^#en#^#localVariant#^##^#userAgent#^#Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.80 Safari/537.36#^${uuid()}`,
              "cookieType": 1,
              "cookie": ""
            }
          }
        }
      },
    });

    console.log(JSON.stringify(data));
    await this.sleep(1000);

    // allow 401 request


  }

  async initializeClient() {
    let data;
    this.publicKeys = await this.retrievePublicKeys();

    // Initial client info request
    data = await this.httpRequest({
      method: 'get',
      url: '/configuration/client-info/app-type/cardinal-secure-site',
      headers: {
        'x-nonce': uuid(),
        'SESSION_INPUT_ALL': this.encryptUsingScheme1('generic', this.localKeys.generic.key + this.localKeys.generic.iv),
      },
    });

    await this.sleep(1000);

    // Save the provided IDs
    this.pcClientInfo = this.decryptResponse('generic', data.encryptedData);
    this.logger.debug(`Client Info: ${JSON.stringify(this.pcClientInfo)}`);
  }

  decryptResponse(keyType, payload) {
    const key = this.localKeys[keyType].key;
    const iv = this.localKeys[keyType].iv;
    let decipher = forge.cipher.createDecipher('AES-CBC', key);
    decipher.start({iv: iv});
    decipher.update(forge.util.createBuffer(forge.util.decode64(payload)));
    const success = decipher.finish();
    if (!success) {
      throw new Error(`Unable to decrypt payload "${payload}" using key "${key}" and iv "${iv}"`);
    }
    return JSON.parse(decipher.output.toString());
  }

  encryptUsingScheme1(publicKeyType, payload) {
    // encrypt data with a public key using RSAES PKCS#1 v1.5
    if (!publicKeyType || !payload) {
      throw new Error('Invalid input arguments');
    }

    const publicKey = this.publicKeys[publicKeyType];
    this.logger.debug(`Will encrypt payload ${payload} using key type ${publicKeyType} (scheme 1)`);
    const originalPublicKey = forge.util.decode64(publicKey);
    const sanitizedPublicKey = originalPublicKey.replace(/-+BEGIN.*-+/, '-----BEGIN PUBLIC KEY-----').replace(/-+END.*-+/, '-----END PUBLIC KEY-----');
    const forgeKey = forge.pki.publicKeyFromPem(sanitizedPublicKey);
    const encryptedValue = forgeKey.encrypt(forge.util.encodeUtf8(payload), 'RSAES-PKCS1-V1_5');
    return forge.util.encode64(encryptedValue);
  }

  encryptUsingScheme2(publicKeyType, payload) {
    // encrypt data with a public key using RSAES-OAEP/SHA-256/MGF1-SHA-1
    // compatible with Java's RSA/ECB/OAEPWithSHA-256AndMGF1Padding
    if (!publicKeyType || !payload) {
      throw new Error('Invalid input arguments');
    }

    const publicKey = this.publicKeys[publicKeyType];
    this.logger.debug(`Will encrypt payload ${payload} using key type ${publicKeyType} (scheme 2)`);
    const originalPublicKey = forge.util.decode64(publicKey);
    const sanitizedPublicKey = originalPublicKey.replace(/-+BEGIN.*-+/, '-----BEGIN PUBLIC KEY-----').replace(/-+END.*-+/, '-----END PUBLIC KEY-----');

    const forgeKey = forge.pki.publicKeyFromPem(sanitizedPublicKey);
    const encryptedValue = forgeKey.encrypt(forge.util.encodeUtf8(payload), 'RSA-OAEP', {
      md: forge.md.sha256.create(),
      mgf1: {
        md: forge.md.sha256.create(),
      },
    });
    return forge.util.encode64(encryptedValue);
  }

  encryptUsingScheme3(keyType, payload) {
    // encrypt data using CBC mode
    if (!keyType || !payload) {
      throw new Error('Invalid input arguments');
    }

    this.logger.debug(`Will encrypt payload ${payload} using key type ${keyType} (scheme 3)`);
    const key = this.localKeys[keyType].key;
    const iv = this.localKeys[keyType].iv;
    let cipher = forge.cipher.createCipher('AES-CBC', key);
    cipher.start({iv: iv});
    cipher.update(forge.util.createBuffer(payload, 'utf8'));
    const success = cipher.finish();
    if (!success) {
      throw new Error(`Unable to encrypt payload "${payload}" using key "${key}" and iv "${iv}"`);
    }
    return forge.util.encode64(cipher.output.getBytes())
  }

  async retrievePublicKeys() {
    let data;
    let keys = {};

    this.logger.debug('Retrieving PC Mastercard public keys');

    data = await this.httpRequest({
      method: 'get',
      url: '/auth/getKey/CHS_IDM_KEY',
      headers: {
        'x-nonce': uuid(),
      },
    });
    keys.idm = data.publicKeyFileContents;

    await this.sleep(1000);

    data = await this.httpRequest({
      method: 'get',
      url: '/auth/getKey/CHS_PIN_KEY',
      headers: {
        'x-nonce': uuid(),
      },
    });
    keys.pin = data.publicKeyFileContents;

    await this.sleep(1000);

    data = await this.httpRequest({
      method: 'get',
      url: '/auth/getKey/CHS_GENERIC_KEY',
      headers: {
        'x-nonce': uuid(),
      },
    });
    keys.generic = data.publicKeyFileContents;

    await this.sleep(1000);

    this.logger.debug(`Retrieved public keys: ${JSON.stringify(Object.keys(keys))}`);
    return keys;
  }


  async httpRequest(args) {
    try {
      const response = await this.http.request(args);
      return response.data;
    } catch (error) {
      if (error.response) {
        // request was made successfully, server responded with a non 2xx or 3xx
        this.logger.error(`${error.response.status} - ${JSON.stringify(error.response.data)}`);
        this.logger.debug(`RESP HEADERS - ${JSON.stringify(error.response.headers)}`);
        this.logger.debug(`AXIOS CONFIG - ${JSON.stringify(error.response.config)}`);
        throw error;
      } else if (error.request) {
        // request made but not response received
        this.logger.error(error.request);
        throw error;
      } else {
        // error setting up the request
        this.logger.error(error.message || error.toString());
        throw error;
      }
    }
  }

}

module.exports = PCMastercard;
