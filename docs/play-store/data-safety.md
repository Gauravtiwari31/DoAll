# Data safety form: DoAll's answers

Exact answers for the **Data safety** form in Play Console (**Policy and programs → App content → Data safety → Start**), for DoAll 1.2.0 (`io.github.gauravtiwari31.doall`) talking to the hosted server.

The answers, the [privacy policy](https://doall-api-m1yy.onrender.com/privacy) and the app must describe the same thing. When the app starts handling data differently (a new SDK, a new field, a new provider), update all three together. The [publishing guide](README.md) says where this form fits in.

Google's rules quoted below come from [Provide information for Google Play's Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469) and [Understanding Google Play's app account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111).

---

## What DoAll handles

| Data | Where it lives | How long |
|---|---|---|
| Name and email address | DoAll server (MongoDB Atlas) | Until the account is deleted |
| Password | Server keeps only a bcrypt hash; the password itself is never stored or readable | Until the account is deleted |
| Tasks: title, notes, scheduled date-time, deadline, priority, category, tags, completion status and time, created and updated times | DoAll server | Until the task or the account is deleted |
| Sessions: SHA-256 hashes of refresh tokens with creation and expiry times, at most 5 devices | DoAll server | Until logout, expiry or account deletion |
| IP address of each request | Server memory, briefly, for rate limiting (not stored by DoAll); may appear in the hosting provider's request logs | — |
| Session tokens, cached name and email, theme and sort preferences, a custom server address | The phone only: app-private storage, excluded from Android cloud backup and device-to-device transfer | Until logout or uninstall |

**Not collected:** location, contacts, photos or files, calendar, messages, device or advertising identifiers, analytics, crash reports, payment information, health data. The app contains no ads and no analytics or tracking SDKs.

**Service providers** that process data on DoAll's behalf: **Render** (API hosting, Singapore region) and **MongoDB Atlas** (database hosting). Nothing is sold or given to anyone for their own purposes.

**Deletion:** in the app (**Profile → Delete account**) or on the web at <https://doall-api-m1yy.onrender.com/account/delete>. Either one removes the account, every task and every session immediately and permanently.

---

## Definitions that decide the answers

- **Collected** means "transmitting data from your app off a user's device". Data that never leaves the phone is not collected, so the on-device items in the last row above don't go in the form.
- **Shared** means transferring user data to a third party. "Transferring user data to a 'service provider' that processes it on behalf of the developer does not need to be disclosed as 'sharing'." Render and MongoDB Atlas are service providers, so DoAll shares nothing.
- **Processed ephemerally** means the data "is only stored in memory and retained for no longer than necessary to service the specific request in real time". Ephemeral data still goes in the form but isn't shown on the listing. Everything DoAll declares is stored, so every answer is **No**.
- **Optional** collection is only allowed when every user can use the app without providing that data. Nothing DoAll declares is optional.
- **IP addresses** are disclosed "based on their particular usage", for example as location when they are used to work out location.

---

## Step 1: Data collection and security

| Question | Answer | Why |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | The account and the tasks are stored on the DoAll server. |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | The hosted API is only used over HTTPS. A server that someone runs themselves is theirs, not DoAll's, so data sent there isn't collected by DoAll. |
| Which of the following methods of account creation does your app support? | **Username and password** | Email address plus password. No Google, social or one-time-code sign-in. |
| Link users can use to request that their account and associated data is deleted | `https://doall-api-m1yy.onrender.com/account/delete` | Public page that names DoAll, explains what is deleted and lets people delete the account with their email and password, without reinstalling the app. |
| Do you provide a way for users to request that some or all of their data is deleted, without requiring them to delete their account? | **Yes** | Any task can be deleted in the app (swipe left, or the trash button on a task), and **Profile → Clear completed** deletes all finished tasks. A separate link isn't needed for this, because it happens in the app; if Play Console refuses to save without one, answer **No** instead. |

---

## Step 2: Data types

Select exactly these five:

| Category | Data type | What it is in DoAll |
|---|---|---|
| Personal info | **Name** | The display name entered at sign-up |
| Personal info | **Email address** | The sign-in email |
| Personal info | **User IDs** | The account ID the server assigns. The app sends it inside the access token with every request, and every task stores its owner's ID. |
| Personal info | **Other info** | The password. Google has no separate type for credentials, and this is the closest fit. |
| App activity | **Other user-generated content** | Tasks: titles, notes, dates, priority, category, tags and completion status |

Leave everything else unselected:

| Not selected | Why |
|---|---|
| Location (approximate and precise) | No location permission, and IP addresses are never used to work out where someone is. |
| Device or other IDs | DoAll reads no device, advertising or Firebase identifiers. The account ID is already declared under User IDs. |
| App activity: App interactions, In-app search history, Installed apps, Other actions | No analytics. Search and filters run on the phone, and completing a task is part of the task record declared above. |
| App info and performance: Crash logs, Diagnostics, Other app performance data | No crash reporting or diagnostics SDK. |
| Calendar | Tasks have dates, but DoAll never reads the phone's calendar. |
| Health and fitness | "Health" is just one of the six task categories a person can pick; DoAll asks for no medical or fitness data. |
| Financial info, Messages, Photos and videos, Audio files, Files and docs, Contacts, Web browsing | Not accessed at all. |
| IP addresses (no data type of their own) | Used only to count requests for rate limiting, held briefly in memory and not stored by DoAll. They are never turned into location or a device identifier, which is what would need declaring. |

---

## Step 3: Data usage and handling

Play Console asks four questions for each selected type. Give these answers:

| Data type | Collected or shared | Processed ephemerally? | Required or optional | Why is this data collected? |
|---|---|---|---|---|
| Name | **Collected** only | **No** | **Required** | **App functionality**, **Account management** |
| Email address | **Collected** only | **No** | **Required** | **App functionality**, **Account management** |
| User IDs | **Collected** only | **No** | **Required** | **App functionality**, **Account management** |
| Other info (password) | **Collected** only | **No** | **Required** | **App functionality**, **Account management** |
| Other user-generated content (tasks) | **Collected** only | **No** | **Required** | **App functionality** |

Notes on the answers that aren't obvious:

- **Collected only, never shared.** Render and MongoDB Atlas store and serve the data on DoAll's instructions, which makes them service providers, not third parties.
- **Password processed ephemerally: No.** The password itself is only used in memory, but a hash derived from it is stored for as long as the account exists.
- **Tasks are required.** There is no offline or local-only mode: the to-do list itself is the data stored on the server.
- **Purposes.** Google defines App functionality as features of the app, including authenticating the user, and Account management as creating, signing in to and verifying an account. Nothing is used for analytics, developer communications, advertising, personalization or fraud prevention, so none of those are ticked. DoAll sends no emails, so Developer communications doesn't apply either.

---

## Step 4: Preview

Before saving, the preview of the listing's Data safety section should show:

- **No data shared with third parties**
- **Data collected:** Personal info and App activity
- **Data is encrypted in transit**
- **You can request that data be deleted**

---

## When these answers must change

- **Adding an SDK** such as crash reporting, analytics or push notifications usually adds data types (crash logs, diagnostics, device or other IDs). Check the SDK's own Data safety guidance before releasing.
- **Adding sign-in with Google or another provider** changes the account creation answer.
- **Letting people share tasks with each other** changes the content rating answers (users would interact) and possibly the purposes.
- **Moving to another host or database** doesn't change the form as long as the new company is a service provider, but the privacy policy names the providers and must be updated.
- **Self-hosted servers** are out of scope: data sent to a server someone runs for themselves never reaches DoAll.
