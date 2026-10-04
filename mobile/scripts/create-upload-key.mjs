#!/usr/bin/env node
/**
 * Creates the private upload key that signs DoAll releases for Google Play.
 *
 *   npm run play:upload-key                 # keystore + properties in ~/.android-keys
 *   npm run play:upload-key -- --github     # ...and store them as GitHub Actions secrets
 *
 * Options:
 *   --out <path>    keystore path (default ~/.android-keys/doall-upload.jks)
 *   --name <dname>  certificate owner (default "CN=DoAll, O=Gaurav Tiwari")
 *   --github        set the ANDROID_UPLOAD_* repository secrets with the GitHub CLI
 *                   (reuses the key at --out if it already exists)
 *   --force         overwrite an existing keystore (you almost never want this)
 *   --help          show this help
 *
 * The keystore and a .properties file with its four DOALL_UPLOAD_* values are
 * written outside the repository. Passwords are random, never printed, and
 * handed to keytool and gh through the environment and stdin, not the
 * command line. Google Play App Signing re-signs what you upload, so a lost or
 * leaked upload key can be replaced from Play Console; still, back both files
 * up somewhere safe.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ALIAS = 'doall-upload';
const VALIDITY_DAYS = 10000; // ~27 years; Play needs validity past 2033
const PASSWORD_ENV = 'DOALL_UPLOAD_KEY_SECRET';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    out: join(homedir(), '.android-keys', 'doall-upload.jks'),
    name: 'CN=DoAll, O=Gaurav Tiwari',
    github: false,
    force: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (!next || next.startsWith('--')) fail(`${arg} needs a value`);
      return next;
    };
    if (arg === '--out') options.out = resolve(value());
    else if (arg === '--name') options.name = value();
    else if (arg === '--github') options.github = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--help' || arg === '-h') {
      const source = readFileSync(fileURLToPath(import.meta.url), 'utf8');
      const header = source.split('*/')[0].replace(/^#!.*\r?\n\/\*\*\r?\n?/, '');
      console.log(header.replace(/^ \* ?/gm, ''));
      process.exit(0);
    } else fail(`Unknown option ${arg} (try --help)`);
  }
  return options;
}

/** Runs a program without a shell, so paths with spaces need no quoting. */
function run(command, args, { input, env } = {}) {
  const result = spawnSync(command, args, {
    input,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    cwd: REPO_ROOT,
  });
  if (result.error) {
    fail(`Couldn't run ${command}: ${result.error.message}`);
  }
  return result;
}

function findKeytool() {
  const exe = process.platform === 'win32' ? 'keytool.exe' : 'keytool';
  const fromJavaHome = process.env.JAVA_HOME && join(process.env.JAVA_HOME, 'bin', exe);
  if (fromJavaHome && existsSync(fromJavaHome)) return fromJavaHome;
  const probe = spawnSync('keytool', ['-help'], { encoding: 'utf8' });
  if (!probe.error) return 'keytool';
  fail('keytool not found. Install JDK 17 and set JAVA_HOME (or put keytool on your PATH).');
}

const isInside = (child, parent) => {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith('..') && !path.startsWith(sep) && !/^[a-z]:/i.test(path));
};

/** Forward slashes work in Gradle on every OS and need no escaping in .properties files. */
const portable = path => path.split(sep).join('/');

function main() {
  const options = parseArgs(process.argv.slice(2));
  const keystore = options.out;
  const propertiesFile = join(dirname(keystore), `${basename(keystore, extname(keystore))}.properties`);

  if (isInside(keystore, REPO_ROOT)) {
    fail(`Refusing to write the key inside the repository (${keystore}). Keep it out of git.`);
  }
  const keyExists = existsSync(keystore) && existsSync(propertiesFile);
  if (keyExists && options.github && !options.force) {
    console.log(`Using the existing upload key at ${keystore}`);
    storeGithubSecrets(keystore, readProperties(propertiesFile));
    return;
  }
  if (!options.force && (existsSync(keystore) || existsSync(propertiesFile))) {
    fail(
      `${existsSync(keystore) ? keystore : propertiesFile} already exists. ` +
        'Keep using that key: every update must be signed with the same upload key. ' +
        'Pass --force only if you really mean to replace it.',
    );
  }

  const keytool = findKeytool();
  const password = randomBytes(24).toString('base64url');
  const env = { [PASSWORD_ENV]: password };

  mkdirSync(dirname(keystore), { recursive: true });
  // PKCS12 (the JDK default) uses one password for the store and the key.
  const created = run(
    keytool,
    [
      '-genkeypair',
      '-storetype', 'PKCS12',
      '-keystore', keystore,
      '-alias', ALIAS,
      '-keyalg', 'RSA',
      '-keysize', '4096',
      '-validity', String(VALIDITY_DAYS),
      '-dname', options.name,
      '-storepass:env', PASSWORD_ENV,
      '-keypass:env', PASSWORD_ENV,
    ],
    { env },
  );
  if (created.status !== 0) {
    fail(`keytool failed:\n${created.stderr || created.stdout}`);
  }

  const listing = run(
    keytool,
    ['-list', '-v', '-keystore', keystore, '-alias', ALIAS, '-storepass:env', PASSWORD_ENV],
    { env },
  );
  const fingerprint = /SHA256:\s*([0-9A-F:]+)/i.exec(listing.stdout)?.[1] ?? '(unknown)';

  const values = {
    DOALL_UPLOAD_STORE_FILE: portable(keystore),
    DOALL_UPLOAD_STORE_PASSWORD: password,
    DOALL_UPLOAD_KEY_ALIAS: ALIAS,
    DOALL_UPLOAD_KEY_PASSWORD: password,
  };
  writeFileSync(
    propertiesFile,
    [
      '# DoAll upload key. Keep this file and the keystore private, and back both up.',
      '# Copy these lines into ~/.gradle/gradle.properties to sign release builds locally.',
      ...Object.entries(values).map(([key, value]) => `${key}=${value}`),
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  try {
    chmodSync(keystore, 0o600);
    chmodSync(propertiesFile, 0o600);
  } catch {
    // Windows ignores POSIX modes; the files sit in your user folder anyway.
  }

  console.log(`\n✔ Upload key created
  Keystore:    ${keystore}
  Properties:  ${propertiesFile}
  Alias:       ${ALIAS}
  SHA-256:     ${fingerprint}
`);

  if (options.github) {
    storeGithubSecrets(keystore, values);
  }

  console.log(`Next steps
  1. Back up both files above (a password manager or an encrypted drive).
     Every future update must be signed with this key.
  2. ${options.github ? 'CI can now build signed releases: Actions → Android build → Run workflow.' : 'For CI builds, run the same command with --github: it reuses this key and\n     stores it as GitHub Actions secrets.'}
  3. To sign release builds on this computer, copy the DOALL_UPLOAD_* lines from
     the properties file into ~/.gradle/gradle.properties.
  4. In Play Console, keep "Play App Signing" on: Google holds the app signing key
     and only checks uploads against this upload key, which can be reset there
     if it is ever lost.
`);
}

/** Reads the DOALL_UPLOAD_* values back from a properties file this script wrote. */
function readProperties(file) {
  const values = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z_]+)\s*=(.*)$/.exec(line);
    if (match) values[match[1]] = match[2].trim();
  }
  for (const key of ['DOALL_UPLOAD_STORE_PASSWORD', 'DOALL_UPLOAD_KEY_ALIAS', 'DOALL_UPLOAD_KEY_PASSWORD']) {
    if (!values[key]) fail(`${file} has no ${key}`);
  }
  return values;
}

function storeGithubSecrets(keystore, values) {
  const auth = run('gh', ['auth', 'status']);
  if (auth.status !== 0) {
    fail('The GitHub CLI is not signed in. Run `gh auth login`, then set the secrets with --github on a new key\n  or by hand (see docs/play-store/README.md). The key above was created and is ready to use.');
  }
  const repo = run('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
  const secrets = {
    ANDROID_UPLOAD_KEYSTORE_BASE64: readFileSync(keystore).toString('base64'),
    ANDROID_UPLOAD_STORE_PASSWORD: values.DOALL_UPLOAD_STORE_PASSWORD,
    ANDROID_UPLOAD_KEY_ALIAS: values.DOALL_UPLOAD_KEY_ALIAS,
    ANDROID_UPLOAD_KEY_PASSWORD: values.DOALL_UPLOAD_KEY_PASSWORD,
  };
  for (const [name, value] of Object.entries(secrets)) {
    // No --body: gh reads the value from stdin, keeping it off the command line.
    const result = run('gh', ['secret', 'set', name], { input: value });
    if (result.status !== 0) {
      fail(`gh secret set ${name} failed:\n${result.stderr}`);
    }
  }
  console.log(`✔ Stored ${Object.keys(secrets).join(', ')} as secrets of ${repo.stdout.trim() || 'this repository'}\n`);
}

main();
