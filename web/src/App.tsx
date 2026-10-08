import { useEffect, useState } from 'react';
import { session, type Session } from './api';
import { useToast } from './components/Toasts';
import { useSecret } from './hooks/useSecret';
import { Landing } from './pages/Landing';
import { TasksApp } from './pages/TasksApp';

export function App() {
  const [current, setCurrent] = useState<Session | null>(session.get);
  const toast = useToast();
  const { unlocked, tapLogo } = useSecret(() =>
    toast({
      message: session.get()
        ? 'Secret unlocked: Focus mode. Find it at the top.'
        : 'Secret unlocked: Focus mode. Sign in to use it.',
      tone: 'success',
    }),
  );

  useEffect(() => session.subscribe(setCurrent), []);

  return current ? (
    // A different account gets a fresh task list.
    <TasksApp key={current.user.id} user={current.user} focusUnlocked={unlocked} onLogoTap={tapLogo} />
  ) : (
    <Landing onLogoTap={tapLogo} />
  );
}
