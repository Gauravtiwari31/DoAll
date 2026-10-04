import { escapeHtml } from '../common/utils/escape-html';
import { CONFIRM_VALUE, DeleteAccountField, FormProblem } from './delete-account.form';
import {
  ACCOUNT_DELETE_PATH,
  APP_NAME,
  CONTACT_EMAIL,
  DEVELOPER_NAME,
  POLICY_EFFECTIVE_DATE,
  PRIVACY_PATH,
  SOURCE_CODE_URL,
} from './legal.constants';

/*
 * Server-rendered pages for the privacy policy and account deletion.
 *
 * Plain template strings keep this dependency-free. Text that comes from a
 * request (the email typed into the form) always goes through escapeHtml().
 * The pages run no JavaScript and load nothing else: styles are inline, which
 * Helmet's Content-Security-Policy allows, and the logo is inline SVG.
 */

const PRIVACY_URL = `/${PRIVACY_PATH}`;
const DELETE_URL = `/${ACCOUNT_DELETE_PATH}`;
const MAIL_LINK = `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`;

/** The app's "paper & ink" look: outlined cards with hard, un-blurred offset shadows. */
const STYLES = `
:root {
  color-scheme: light dark;
  --bg: #f2ede4;
  --surface: #fffcf6;
  --text: #121212;
  --muted: #5e594f;
  --line: #121212;
  --shadow: #121212;
  --accent: #ff5a1f;
  --lime: #d7f75b;
  --blush: #ffa9c9;
  --danger: #e5341b;
  --on-danger: #fffcf6;
  --error: #b42318;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121110;
    --surface: #1d1c1a;
    --text: #f2ede4;
    --muted: #aba597;
    --line: #f2ede4;
    --shadow: #ff5a1f;
    --danger: #ff6a50;
    --on-danger: #121212;
    --error: #ff8f7a;
  }
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 1rem/1.6 system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  overflow-wrap: break-word;
}
.wrap { max-width: 46rem; margin: 0 auto; padding: 20px 16px 32px; }
.brand { display: flex; align-items: center; gap: 10px; font-size: 1.6rem; font-weight: 800; letter-spacing: -0.03em; }
.brand em { font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 400; }
.card {
  margin: 20px 4px 24px 0;
  padding: 24px 20px;
  background: var(--surface);
  border: 2px solid var(--line);
  border-radius: 14px;
  box-shadow: 4px 4px 0 var(--shadow);
}
.eyebrow, .meta, .toc, footer { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace; }
.eyebrow { margin: 0; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
h1 { margin: 6px 0 10px; font-size: clamp(1.9rem, 7vw, 2.6rem); line-height: 1.1; letter-spacing: -0.03em; }
h2 { margin: 32px 0 10px; font-size: 1.3rem; line-height: 1.3; letter-spacing: -0.01em; }
h2::before {
  content: '';
  display: inline-block;
  width: 0.6em;
  height: 0.6em;
  margin-right: 0.5em;
  background: var(--accent);
  border: 2px solid var(--line);
  border-radius: 3px;
}
p, ul, ol, dl { margin: 0 0 12px; }
ul { padding-left: 1.25rem; }
li + li { margin-top: 6px; }
dt { margin-top: 14px; font-weight: 800; }
dd { margin: 2px 0 0; }
.meta { font-size: 0.85rem; color: var(--muted); }
.lead { font-size: 1.1rem; }
.small { font-size: 0.9rem; color: var(--muted); }
a { color: inherit; text-decoration-color: var(--accent); text-decoration-thickness: 2px; text-underline-offset: 3px; }
a:hover { text-decoration-color: currentColor; }
:focus-visible { outline: 3px solid var(--text); outline-offset: 3px; }
.sticker {
  margin: 20px 4px 20px 0;
  padding: 16px 18px;
  color: #121212;
  background: var(--lime);
  border: 2px solid var(--line);
  border-radius: 14px;
  box-shadow: 4px 4px 0 var(--shadow);
}
.sticker.warn { background: var(--blush); }
.sticker h2 { margin-top: 0; }
.sticker > :last-child { margin-bottom: 0; }
.sticker :focus-visible { outline-color: #121212; }
.toc ol { display: flex; flex-wrap: wrap; gap: 8px; padding: 0; list-style: none; }
.toc li + li { margin-top: 0; }
.toc a {
  display: inline-block;
  padding: 4px 12px;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  border: 2px solid var(--line);
  border-radius: 999px;
}
.toc a:hover { color: #121212; background: var(--lime); }
form { display: grid; gap: 20px; margin-top: 16px; }
label { display: block; margin-bottom: 6px; font-weight: 700; }
input[type='email'], input[type='password'] {
  display: block;
  width: 100%;
  min-height: 50px;
  padding: 10px 14px;
  font: inherit;
  color: var(--text);
  background: var(--bg);
  border: 2px solid var(--line);
  border-radius: 12px;
}
input[aria-invalid='true'] { border-color: var(--error); }
.check { display: flex; gap: 12px; align-items: flex-start; margin: 0; font-weight: 600; }
.check input { flex: none; width: 24px; height: 24px; margin: 1px 0 0; accent-color: var(--accent); }
.error { margin: 0 0 6px; font-weight: 700; color: var(--error); }
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 54px;
  padding: 12px 24px;
  font: inherit;
  font-size: 1.2rem;
  font-weight: 800;
  line-height: 1.2;
  text-decoration: none;
  color: #121212;
  background: var(--accent);
  border: 2px solid var(--line);
  border-radius: 14px;
  box-shadow: 4px 4px 0 var(--shadow);
  cursor: pointer;
}
.button:active { transform: translate(4px, 4px); box-shadow: none; }
.button.danger { color: var(--on-danger); background: var(--danger); }
footer { font-size: 0.8rem; color: var(--muted); text-align: center; }
footer nav { display: flex; flex-wrap: wrap; justify-content: center; gap: 0 18px; }
footer nav a { display: inline-block; padding: 4px 0; }
footer p { margin: 4px 0 0; }
@media (min-width: 600px) {
  .wrap { padding-top: 32px; }
  .card { padding: 32px 36px; }
  .button { width: auto; }
}
`;

/** The app's logo mark: a ticked box with a hard shadow and a lime dot. */
const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="30 28 50 50" width="40" height="40" aria-hidden="true" focusable="false">' +
  '<path d="M46 37h20a9 9 0 0 1 9 9v20a9 9 0 0 1-9 9H46a9 9 0 0 1-9-9V46a9 9 0 0 1 9-9z" fill="#121212"/>' +
  '<path d="M42 33h20a9 9 0 0 1 9 9v20a9 9 0 0 1-9 9H42a9 9 0 0 1-9-9V42a9 9 0 0 1 9-9z" fill="#fffcf6" stroke="#121212" stroke-width="3.5"/>' +
  '<path d="M42.5 52.5l7 6.5L62 45" fill="none" stroke="#121212" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<circle cx="70.5" cy="33.5" r="5.5" fill="#d7f75b" stroke="#121212" stroke-width="3"/>' +
  '</svg>';

/** Inline favicon, so browsers don't request /favicon.ico from the API. */
const FAVICON = `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`;

interface PageOptions {
  title: string;
  description: string;
  body: string;
}

function page({ title, description, body }: PageOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${title} · ${APP_NAME}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="icon" href="${escapeHtml(FAVICON)}">
<style>${STYLES}</style>
</head>
<body>
<div class="wrap">
<header class="brand">${LOGO_SVG}<span>Do<em>All</em></span></header>
<main>
${body}
</main>
<footer>
<nav aria-label="${APP_NAME} pages">
<a href="${PRIVACY_URL}">Privacy policy</a>
<a href="${DELETE_URL}">Delete your account</a>
<a href="mailto:${CONTACT_EMAIL}">Contact</a>
</nav>
<p>${APP_NAME} by ${DEVELOPER_NAME}</p>
</footer>
</div>
</body>
</html>
`;
}

export function privacyPolicyPage(): string {
  return page({
    title: 'Privacy policy',
    description: `How ${APP_NAME} collects, uses, stores and deletes your information.`,
    body: `<article class="card">
<p class="eyebrow">Privacy policy</p>
<h1>${APP_NAME} privacy policy</h1>
<p class="meta">Effective ${POLICY_EFFECTIVE_DATE}</p>
<p class="lead">${APP_NAME} is a to-do app for Android made by ${DEVELOPER_NAME}, an independent developer. This policy explains in plain language what information ${APP_NAME} collects when you use the app with its hosted server, why, where it is kept, and how you can delete it.</p>

<section class="sticker">
<h2>The short version</h2>
<ul>
<li>${APP_NAME} stores your name, your email address, a scrambled (hashed) form of your password, and the tasks you create. That's all.</li>
<li>It is used only to run the app. There are no ads, no analytics and no tracking, and your data is never sold.</li>
<li>Your data travels over encrypted HTTPS connections and is stored with two hosting providers, Render and MongoDB Atlas.</li>
<li>You can delete your account and all of your tasks at any time, in the app or on the web. Deletion is immediate and permanent.</li>
</ul>
</section>

<nav class="toc" aria-label="On this page">
<ol>
<li><a href="#collect">What we collect</a></li>
<li><a href="#use">How we use it</a></li>
<li><a href="#storage">Where it's stored</a></li>
<li><a href="#device">On your phone</a></li>
<li><a href="#retention">How long we keep it</a></li>
<li><a href="#deletion">Deleting your account</a></li>
<li><a href="#security">Security</a></li>
<li><a href="#children">Children</a></li>
<li><a href="#self-hosting">Your own server</a></li>
<li><a href="#changes">Changes</a></li>
<li><a href="#contact">Contact</a></li>
</ol>
</nav>

<section id="collect">
<h2>What we collect</h2>
<p>When you create an account and use ${APP_NAME}, its server stores:</p>
<dl>
<dt>Account information</dt>
<dd>Your name (shown in the app's greeting), your email address (used to sign in) and your password. The password is stored only as a bcrypt hash: a one-way, scrambled version that can check a password but can't be turned back into it, so nobody, including the developer, can read it.</dd>
<dt>Your tasks</dt>
<dd>What you enter for each task: its title, notes, scheduled date and time, deadline, priority, category and tags, whether it's done and when you finished it, and when it was created and last changed.</dd>
<dt>Sign-in sessions</dt>
<dd>For each device you're signed in on (up to 5), a SHA-256 hash of that device's sign-in token, with the time it was created and the time it expires. This keeps you signed in without storing the token itself.</dd>
<dt>Technical information</dt>
<dd>The IP address of each request is used, in memory only, to limit repeated sign-in attempts. ${APP_NAME} doesn't store it, but it may appear in the hosting provider's request logs.</dd>
</dl>
<p><strong>What we don't collect:</strong> your location, contacts, photos or files, calendar, messages, device or advertising identifiers, usage analytics, crash reports, payment information or health data. The app contains no advertising, analytics or tracking code, and these web pages use no cookies.</p>
</section>

<section id="use">
<h2>How we use it</h2>
<p>Only to provide ${APP_NAME}'s features and manage your account:</p>
<ul>
<li>creating your account and signing you in;</li>
<li>keeping you signed in on your devices, and ending a device's session when you log out on it;</li>
<li>storing your tasks so they're there on every device you sign in on, and working out your stats and the smart sort order;</li>
<li>protecting accounts, for example by limiting repeated sign-in attempts.</li>
</ul>
<p>We don't use your information for advertising, profiling or marketing, and ${APP_NAME} doesn't send you emails. Your data is never sold, and never shared with anyone for their own purposes.</p>
</section>

<section id="storage">
<h2>Where it's stored and who processes it</h2>
<p>The hosted ${APP_NAME} service relies on two service providers. They process your data only on ${APP_NAME}'s behalf, to run the service:</p>
<ul>
<li><strong>Render</strong> hosts the ${APP_NAME} server (the API the app talks to) in its Singapore region.</li>
<li><strong>MongoDB Atlas</strong> hosts the database where your account and tasks are stored.</li>
</ul>
<p>This means your information may be stored and processed outside the country where you live. Apart from these providers, ${APP_NAME} doesn't share your information with anyone, unless the law requires it.</p>
</section>

<section id="device">
<h2>On your phone</h2>
<p>The app keeps a few things in its private storage on your phone: your sign-in tokens, a copy of your name and email address, your preferences (theme and sort order) and, if you set one, a custom server address. Other apps can't read this storage, and it is excluded from Android cloud backups and device-to-device transfers. Logging out removes your tokens and profile from the phone; uninstalling the app removes everything.</p>
</section>

<section id="retention">
<h2>How long we keep it</h2>
<p>Your account and tasks are kept for as long as you have an account. When you delete a task in the app, it is deleted from the server straight away. A device's session is removed when you log out on that device, and an unused session expires after 30 days.</p>
<p>When you delete your account, everything described above is deleted immediately and permanently.</p>
</section>

<section id="deletion">
<h2>Deleting your account</h2>
<p>You can delete your account whenever you like, in either of two ways:</p>
<ul>
<li><strong>In the app:</strong> go to <strong>Profile → Delete account</strong> and confirm with your password.</li>
<li><strong>On the web:</strong> use the <a href="${DELETE_URL}">account deletion page</a>, which works even if you no longer have the app.</li>
</ul>
<p>Either way, your account, all of your tasks and every sign-in session are deleted immediately and permanently. This can't be undone.</p>
<p>If you can't use either option, for example because you've forgotten your password, email ${MAIL_LINK} from the address you signed up with and we'll delete the account for you. You can also email us to ask for a copy of your data.</p>
</section>

<section id="security">
<h2>Security</h2>
<ul>
<li>The app and the ${APP_NAME} server talk over HTTPS, so your data is encrypted in transit.</li>
<li>Passwords are stored only as bcrypt hashes, and sign-in tokens only as SHA-256 hashes.</li>
<li>Sign-in tokens are short-lived and replaced each time they're used. If an old token is ever reused, every session on the account is signed out as a precaution.</li>
<li>Repeated sign-in attempts are rate limited, and each account can only ever see its own tasks.</li>
</ul>
<p>No way of storing or sending data is completely secure, but these measures are designed to keep your information safe.</p>
</section>

<section id="children">
<h2>Children</h2>
<p>${APP_NAME} is not directed at children under 13, and we don't knowingly collect information from them. If you believe a child under 13 has created an account, email ${MAIL_LINK} and we'll delete it.</p>
</section>

<section id="self-hosting">
<h2>Using your own server</h2>
<p>${APP_NAME} is open source, and the app can connect to a server you run yourself (the server button on the welcome screen). If you do, your account and tasks are stored on that server instead. The developer has no access to it and this policy doesn't cover it: whoever runs that server is responsible for your data.</p>
</section>

<section id="changes">
<h2>Changes to this policy</h2>
<p>If this policy changes, the new version will be posted on this page with a new effective date. Significant changes will also be mentioned in the app's release notes.</p>
</section>

<section id="contact">
<h2>Contact</h2>
<p>Questions or requests about your privacy or your data? Email ${DEVELOPER_NAME} at ${MAIL_LINK}.</p>
<p>The source code of the app and the server is public on <a href="${SOURCE_CODE_URL}">GitHub</a>.</p>
</section>
</article>`,
  });
}

export interface DeleteAccountPageState {
  /** What the user typed, shown again after a mistake. Never the password. */
  email?: string;
  problems?: FormProblem[];
}

export function deleteAccountPage({
  email = '',
  problems = [],
}: DeleteAccountPageState = {}): string {
  const problemFor = (field: DeleteAccountField) => problems.find((p) => p.field === field);
  const fieldError = (field: DeleteAccountField) => {
    const problem = problemFor(field);
    return problem ? `<p class="error" id="${field}-error">${escapeHtml(problem.message)}</p>` : '';
  };
  const invalid = (field: DeleteAccountField) =>
    problemFor(field) ? ` aria-invalid="true" aria-describedby="${field}-error"` : '';

  const summary =
    problems.length > 0
      ? `<div class="sticker warn" role="alert">
<p><strong>We couldn't delete your account</strong></p>
<ul>
${problems
  .map(({ field, message }) =>
    field
      ? `<li><a href="#${field}">${escapeHtml(message)}</a></li>`
      : `<li>${escapeHtml(message)}</li>`,
  )
  .join('\n')}
</ul>
</div>`
      : '';

  return page({
    title: 'Delete your account',
    description: `Permanently delete your ${APP_NAME} account and all of your tasks.`,
    body: `<section class="card">
<p class="eyebrow">Account deletion</p>
<h1>Delete your ${APP_NAME} account</h1>
<p class="lead"><strong>${APP_NAME}</strong> is a to-do app for Android by <strong>${DEVELOPER_NAME}</strong>. On this page you can permanently delete your ${APP_NAME} account and everything stored with it, even if you no longer have the app.</p>

<h2>What gets deleted</h2>
<ul>
<li>Your account: your name, email address and password hash.</li>
<li>All of your tasks, including their notes, dates, deadlines, priorities, categories, tags and completion history.</li>
<li>Every sign-in session, so all of your devices are signed out.</li>
</ul>
<div class="sticker warn">
<p><strong>Deletion is immediate and permanent.</strong> Everything listed above is erased the moment you confirm. It can't be undone, and deleted data can't be recovered. To use ${APP_NAME} again, you would sign up for a new account.</p>
</div>
<p class="small">The only other trace is the hosting provider's routine request logs, which can include IP addresses and are kept for a limited time under the provider's own retention rules. See the <a href="${PRIVACY_URL}">privacy policy</a> for details.</p>

<h2>Prefer the app?</h2>
<p>In ${APP_NAME}, go to <strong>Profile → Delete account</strong> and confirm with your password. Profile is the button with your initial at the top right of the home screen.</p>
</section>

<section class="card">
<h2>Delete on the web</h2>
<p>Enter the email address and password you use to sign in to ${APP_NAME}.</p>
${summary}
<form method="post" action="${DELETE_URL}">
<div>
<label for="email">Email address</label>
${fieldError('email')}
<input id="email" name="email" type="email" autocomplete="email" required value="${escapeHtml(email)}"${invalid('email')}>
</div>
<div>
<label for="password">Password</label>
${fieldError('password')}
<input id="password" name="password" type="password" autocomplete="current-password" required${invalid('password')}>
</div>
<div>
${fieldError('confirm')}
<label class="check"><input id="confirm" name="confirm" type="checkbox" value="${CONFIRM_VALUE}" required${invalid('confirm')}><span>I understand that this permanently deletes my ${APP_NAME} account and all of my tasks, and that it can't be undone.</span></label>
</div>
<div><button class="button danger" type="submit">Delete my account</button></div>
</form>
<p class="small">Forgot your password? Email ${MAIL_LINK} from the address you signed up with and we'll delete the account for you.</p>
</section>`,
  });
}

export function accountDeletedPage(email: string): string {
  return page({
    title: 'Account deleted',
    description: `Your ${APP_NAME} account has been deleted.`,
    body: `<section class="card">
<p class="eyebrow">Account deleted</p>
<h1>Your account has been deleted</h1>
<div class="sticker" role="status">
<p>The ${APP_NAME} account for <strong>${escapeHtml(email)}</strong> has been permanently deleted, together with all of its tasks and sign-in sessions.</p>
</div>
<p>Any device that was signed in to this account can no longer sync and will be signed out. Uninstalling the app removes what's left on your phone, such as your theme and sort preferences.</p>
<p>Thanks for trying ${APP_NAME}.</p>
</section>`,
  });
}

const ERROR_TEXT: Record<number, { title: string; message: string }> = {
  400: {
    title: 'Please check your request',
    message: "Something in that request wasn't right. Go back to the page and try again.",
  },
  429: {
    title: 'Too many attempts',
    message:
      "You've made too many requests in a short time. To keep accounts safe, please wait a minute and then try again.",
  },
};

const SERVER_ERROR = {
  title: 'Something went wrong',
  message: `Sorry, that didn't work because of a problem on our side. Please try again in a few minutes. If it keeps happening, email ${MAIL_LINK}.`,
};

const OTHER_ERROR = {
  title: "That didn't work",
  message: 'Please go back to the page and try again.',
};

/** Shown for any error on the public pages; `retryPath` is the page to go back to. */
export function errorPage(status: number, retryPath: string): string {
  const { title, message } = ERROR_TEXT[status] ?? (status >= 500 ? SERVER_ERROR : OTHER_ERROR);
  return page({
    title,
    description: title,
    body: `<section class="card">
<p class="eyebrow">Error ${status}</p>
<h1>${title}</h1>
<p>${message}</p>
<p><a class="button" href="${escapeHtml(retryPath)}">Try again</a></p>
</section>`,
  });
}
