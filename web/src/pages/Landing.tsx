import { AdBreak } from '../components/Ads';
import { AuthCard } from '../components/AuthCard';
import { Footer } from '../components/Footer';
import { Icon, type IconName } from '../components/Icon';
import { Logo } from '../components/Logo';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'sync',
    title: 'One list, everywhere',
    text: 'Sign in with the same email or Google account as the app, and your tasks are here. Tick one off on the laptop and it is done on your phone too.',
  },
  {
    icon: 'repeat',
    title: 'Tasks that repeat',
    text: 'Every day, every other Monday, the 31st of each month: DoAll keeps the time you picked, even across daylight saving changes.',
  },
  {
    icon: 'target',
    title: 'Knows what is next',
    text: 'Smart order weighs priority, how close the deadline is and when you planned it, so the task at the top is the one to do now.',
  },
  {
    icon: 'bell',
    title: 'Reminders on your phone',
    text: 'Set a reminder here and the Android app rings at the right time, even offline and with the screen off.',
  },
  {
    icon: 'offline',
    title: 'Keeps working offline',
    text: 'Changes are saved in your browser first and sent when the connection is back. Nothing is lost on a bad network.',
  },
  {
    icon: 'download',
    title: 'Your data, your call',
    text: 'Export every task as a file whenever you like, and delete your account and all of its tasks at any time.',
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Do I need a new account for the website?',
    a: 'No. It is the same account as the DoAll app. Sign in with the email address and password you use there, or with Google, and your tasks appear.',
  },
  {
    q: 'How do my tasks get from the phone to the website?',
    a: 'Both keep a copy of your tasks and send changes to the DoAll server, which passes them on. If the same task was changed in two places, the most recent change wins.',
  },
  {
    q: 'Why does the site ask me to confirm my email?',
    a: 'To back up your changes, the server needs to know the address is yours. Open the link in the email we sent when you signed up. Until then the site still shows your tasks, and keeps your edits until you confirm.',
  },
  {
    q: 'Can I use it without an internet connection?',
    a: 'Yes, once you have signed in. Changes are kept in this browser and sent when you are back online. For reminders that ring, use the Android app.',
  },
  {
    q: 'Is it free?',
    a: 'Yes. The website shows a few ads to cover the server. The Android app has none.',
  },
];

export function Landing({ onLogoTap }: { onLogoTap: () => void }) {
  return (
    <>
      <header className="topbar">
        <Logo onTap={onLogoTap} />
        <a className="btn btn-ghost btn-small" href="#sign-in">
          Sign in
        </a>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">To-do list · phone and web</p>
            <h1>
              Do it all.
              <br />
              <em>From anywhere.</em>
            </h1>
            <p className="lead">
              DoAll is a to-do list that keeps up with you. Plan on your laptop, tick things off on
              your phone: the same tasks, kept in step through your account.
            </p>
            <ul className="hero-points">
              <li>
                <Icon name="check" size={16} /> Same account as the Android app
              </li>
              <li>
                <Icon name="check" size={16} /> Repeating tasks and smart order
              </li>
              <li>
                <Icon name="check" size={16} /> Free, works offline once signed in
              </li>
            </ul>
          </div>
          <AuthCard />
        </section>

        <section className="section" aria-labelledby="features-title">
          <h2 id="features-title" className="section-title">
            What it does
          </h2>
          <div className="features">
            {FEATURES.map(feature => (
              <article key={feature.title} className="card feature">
                <span className="feature-icon">
                  <Icon name={feature.icon} size={22} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section">
          <AdBreak />
        </section>

        <section className="section" aria-labelledby="how-title">
          <h2 id="how-title" className="section-title">
            How syncing works
          </h2>
          <ol className="steps">
            <li className="card">
              <strong>Sign in</strong>
              <span>Use your DoAll email and password, or Google. New here? Create an account in seconds.</span>
            </li>
            <li className="card">
              <strong>Confirm your email</strong>
              <span>Open the link we email you, so the server can safely keep a copy of your tasks.</span>
            </li>
            <li className="card">
              <strong>Use it anywhere</strong>
              <span>Every change goes to your account in the background and shows up on your other devices.</span>
            </li>
          </ol>
        </section>

        <section className="section" aria-labelledby="faq-title">
          <h2 id="faq-title" className="section-title">
            Questions
          </h2>
          <div className="faq">
            {FAQ.map(item => (
              <details key={item.q} className="card">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
