# Setting up Sign in with Google

DoAll's **Continue with Google** needs a Google Cloud project with OAuth clients, two settings on the server and one setting for the app build. This guide sets them up for the hosted server (`https://doall-api-m1yy.onrender.com`) and the Play Store app (`io.github.gauravtiwari31.doallapp`). It takes about 20 minutes, plus the first Play upload for the last fingerprint.

Until it's done, everything else works as before: the app hides the Google button, and the server answers `501` to Google sign-in requests.

| What | Secret? | Where it goes |
|---|---|---|
| **Web client ID** (`…apps.googleusercontent.com`) | No, it's built into the app | Render: `GOOGLE_CLIENT_ID`. GitHub: repository *variable* `DOALL_GOOGLE_WEB_CLIENT_ID` |
| **Web client secret** (`GOCSPX-…`) | **Yes** | Render: `GOOGLE_CLIENT_SECRET`, and nowhere else |
| **Android clients**: package name + SHA-1 fingerprint | No | Only in Google Cloud |

Never put the client secret in the app, the repository, a GitHub variable, an issue or a chat. Only the server needs it, for the web account deletion page.

---

## How it works

1. The app opens Google's account chooser through Android's **Credential Manager** ([`GoogleSignInModule.kt`](../mobile/android/app/src/main/java/com/doall/googlesignin/GoogleSignInModule.kt)). Google only answers if the app's package name and signing certificate match an **Android client** in the project.
2. Google returns an **ID token** issued to the **Web client ID**. The app sends it to `POST /api/auth/google`.
3. The server checks the token with Google's public keys: signature, expiry, and that it was issued to `GOOGLE_CLIENT_ID` ([`google-identity.service.ts`](../backend/src/auth/google-identity.service.ts)). Then it signs the person in, creating the account the first time, and returns DoAll's own tokens, the same as a password login.
4. If an email-and-password account already uses that Google address, the app asks for its password once and connects the two. That way nobody can take over an account just by having a Google account with its email address.

Deleting an account that has no password: in the app, the person chooses their Google account again. On the web page, **Signed up with Google?** sends them through Google's sign-in, which is what the client secret is for.

---

## 1. Create the project and the consent screen

1. Open the [Google Cloud console](https://console.cloud.google.com/) and create a project, for example **DoAll**. (The project used for the Play service account works too.)
2. Open **Google Auth Platform** ([console.cloud.google.com/auth/overview](https://console.cloud.google.com/auth/overview)) and click **Get started**:
   - **App name:** `DoAll`
   - **User support email:** your address
   - **Audience:** **External**
   - **Contact information:** your address
   - Agree to the user data policy and **Create**.
3. **Branding:**
   - **Application privacy policy link:** `https://doall-api-m1yy.onrender.com/privacy`
   - **Authorized domains:** `doall-api-m1yy.onrender.com`. Because `onrender.com` is a public suffix, your service's own subdomain counts as the domain.
   - Leave the logo empty. Showing a logo or name on Google's screens needs [brand verification](https://developers.google.com/identity/verification/authentication-verification), which needs the domain verified in Google Search Console. It's optional and can come later.
4. **Audience → Publish app**, so the status is **In production**. While it says *Testing*, only the test users you list can sign in. DoAll asks only for the basic `openid`, `email` and `profile` scopes, which need no verification and have no user limit.
5. **Data Access:** add nothing. The basic scopes are all Sign in with Google uses.

## 2. Create the Web client (server)

**Clients → Create client:**

- **Application type:** Web application
- **Name:** `DoAll server`
- **Authorized redirect URIs:** `https://doall-api-m1yy.onrender.com/account/delete/google/callback`. It must match exactly: https, no trailing slash. For a server on your own computer, add `http://localhost:3000/account/delete/google/callback` as well.
- **Create**, then copy the **Client ID** and the **Client secret** right away. Google may only show the secret once; if it's lost, add a new secret to the client and delete the old one.

## 3. Create the Android clients (app)

Google only gives an app ID tokens if its package name and **SHA-1 signing fingerprint** match an Android client. Each signing key needs its own client (**Clients → Create client → Android**, package name `io.github.gauravtiwari31.doallapp`):

| Name | SHA-1 of | Needed for | Where to find it |
|---|---|---|---|
| `DoAll (Google Play)` | Google's **app signing key** | The app installed from Google Play, including testing tracks | Play Console → **Test and release → App integrity → Play app signing** → *App signing key certificate*. It exists after the first upload ([step 5 of the Play guide](play-store/README.md#internal-testing-the-first-upload-and-play-app-signing)). |
| `DoAll (upload key)` | Your **upload key** | The APK on GitHub releases, and your own release builds | `keytool -list -v -keystore ~/.android-keys/doall-upload.jks -alias doall-upload` |
| `DoAll (debug)` | The **debug key** in the repository | `npm run android` while developing | `keytool -list -v -keystore mobile/android/app/debug.keystore -alias androiddebugkey -storepass android` |

Without the first one, Google sign-in works in your own builds but **fails in the Play Store version**. Add it as soon as the first bundle is uploaded, before testers try the app.

## 4. Configure the server

On Render, open the `doall-api` service → **Environment → Add environment variable**:

| Key | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | The Web client ID |
| `GOOGLE_CLIENT_SECRET` | The Web client secret |

**Save, rebuild, and deploy**. Then check:

- https://doall-api-m1yy.onrender.com/account/delete shows a **Signed up with Google?** section.
- The server refuses to start, with a message in the logs, if `GOOGLE_CLIENT_ID` isn't a `….apps.googleusercontent.com` client ID.

For a server you run yourself, put the same two variables in `backend/.env`, or pass them to `docker compose`. Only `GOOGLE_CLIENT_ID` is needed for sign-in from the app; the secret only turns on the web deletion option.

## 5. Configure the app build

On GitHub, **Settings → Secrets and variables → Actions → Variables → New repository variable**:

- **Name:** `DOALL_GOOGLE_WEB_CLIENT_ID`
- **Value:** the Web client ID, the same as `GOOGLE_CLIENT_ID` on the server

It's a variable, not a secret, because it ends up inside the app anyway. The next **Android build** run writes it into `mobile/src/env.ts` ([`write-build-env.mjs`](../mobile/scripts/write-build-env.mjs)), and the welcome, login and sign-up screens show **Continue with Google**. A build made without it simply has no Google button.

For a local build, run `DOALL_API_URL=https://doall-api-m1yy.onrender.com DOALL_GOOGLE_WEB_CLIENT_ID=<web client ID> node scripts/write-build-env.mjs` in `mobile/` before building, and `git checkout src/env.ts` afterwards.

## 6. Try it

1. Install the new build, from the Play internal testing link or from the GitHub release.
2. Tap **Continue with Google**, choose an account: you land on the home screen, and **Profile** says *You sign in with Google*.
3. Log out and sign in with Google again: same account, same tasks.
4. With a throwaway Google account, try **Profile → Delete account** (it asks you to choose the Google account again) and the **Signed up with Google?** option on the web page.

---

## Troubleshooting

**There's no Continue with Google button.**
The build was made without `DOALL_GOOGLE_WEB_CLIENT_ID`. Check the variable, then look for the notice in the *Check release requirements* step of the Android build run.

**"Google sign-in didn't work. Please try again."**
Google refused the app, almost always because no Android client matches this build's package name and signing key (Google's code `[28444] Developer console is not set up correctly`, or `[10]`). The installed app's signature decides which SHA-1 counts: the Play version needs the *app signing key* client, the GitHub APK the *upload key* client. Connect the phone and run `adb logcat -s DoAllGoogleSignIn` to see Google's exact error. New or changed clients can take a few minutes to work.

**"Google couldn't confirm your account. Please try again."**
The server rejected the token. Usually `GOOGLE_CLIENT_ID` on Render and `DOALL_GOOGLE_WEB_CLIENT_ID` on GitHub are not the same Web client ID, or one of them is an Android client ID.

**"Google sign-in isn't set up on this server."**
`GOOGLE_CLIENT_ID` isn't set on the server the app is talking to. Servers that people run themselves need it too.

**"Your Google account's email address isn't verified"**
Google says the account's address isn't confirmed, so DoAll won't create or connect an account with it. Gmail addresses are always verified.

**On the web page: "Error 400: redirect_uri_mismatch"**
The Web client's redirect URI doesn't match `https://doall-api-m1yy.onrender.com/account/delete/google/callback` exactly. **Access blocked … has not completed the Google verification process** means the publishing status is still *Testing* (step 1.4).
