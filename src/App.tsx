import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from './lib/store';
import { seedIfEmpty } from './lib/seed';
import Login from './pages/Login';
import Layout from './components/Layout';
import Today from './pages/Today';
import Week from './pages/Week';
import Inbox from './pages/Inbox';
import Search from './pages/Search';
import Boards from './pages/Boards';
import BoardPage from './pages/BoardPage';

export default function App() {
  const authed = useStore((s) => s.authed);
  const loaded = useStore((s) => s.loaded);
  const lastSync = useStore((s) => s.lastSync);

  useEffect(() => { useStore.getState().boot(); }, []);
  // Seed only after a confirmed server load, never from an empty cache.
  useEffect(() => { if (lastSync) seedIfEmpty(); }, [lastSync]);

  if (authed === null || (authed && !loaded)) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-[var(--accent)]" />
      </div>
    );
  }
  if (!authed) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Today />} />
        <Route path="week" element={<Week />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="search" element={<Search />} />
        <Route path="boards" element={<Boards />} />
        <Route path="b/:id" element={<BoardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
