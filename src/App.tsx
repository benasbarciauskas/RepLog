import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { Toaster } from '@/components/ui/sonner';
import { Sidebar, BottomNav, MobileTopBar } from '@/components/AppNav';
import { PageTransition } from '@/components/PageTransition';
import { RouteFallback } from '@/components/RouteFallback';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { useWorkoutCount } from '@/data/hooks';

// Routes are code-split: each page (and its heavy deps — recharts, chrono,
// fuse, tesseract) loads only when that route is first visited, keeping the
// initial bundle small. The Suspense fallback below covers the chunk fetch.
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const ImportPage = lazy(() => import('@/features/import/ImportPage'));
const ReviewPage = lazy(() => import('@/features/review/ReviewPage'));
const ExercisePage = lazy(() => import('@/features/exercise/ExercisePage'));
const CoachPage = lazy(() => import('@/features/coach/CoachPage'));
const LoggerPage = lazy(() => import('@/features/logger/LoggerPage'));
const RoutinesPage = lazy(() => import('@/features/routines/RoutinesPage'));
const HistoryPage = lazy(() => import('@/features/history/HistoryPage'));

/**
 * Root route ('/'): the dashboard once there are workouts, otherwise send the
 * first-time user to Import. Onboarding renders on top for genuine first runs.
 */
function HomeRoute() {
  // `count` is undefined until the live query resolves. Only redirect once we
  // KNOW the count is zero — otherwise the dashboard flash-redirects to Import
  // on every fresh load before IndexedDB answers (the live query's initial
  // value would read as "empty").
  const count = useWorkoutCount();
  if (count === undefined) return <RouteFallback />;
  if (count === 0) return <Navigate to="/import" replace />;
  return <DashboardPage />;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <PageTransition key={location.pathname}>
        <Routes location={location}>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/exercise/:id" element={<ExercisePage />} />
          <Route path="/coach" element={<CoachPage />} />
          <Route path="/log" element={<LoggerPage />} />
          <Route path="/routines" element={<RoutinesPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PageTransition>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <div className="min-h-dvh bg-background">
      <MobileTopBar />

      {/* The whole shell (sidebar + content) is capped and centered, so on wide
          screens it sits in the middle of the viewport with even margins — the
          sidebar travels with the content instead of pinning to the far edge. */}
      <div className="mx-auto flex w-full max-w-[1400px]">
        <Sidebar />
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6 md:pb-10 md:pt-10">
            <Suspense fallback={<RouteFallback />}>
              <AnimatedRoutes />
            </Suspense>
          </div>
        </main>
      </div>

      <BottomNav />
      <Onboarding />
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
