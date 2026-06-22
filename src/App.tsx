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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PageTransition>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <div className="min-h-dvh bg-background">
      <Sidebar />
      <MobileTopBar />

      {/* Content column: offset for the sidebar on desktop, padded for the
          bottom tab bar on mobile. Capped width for comfortable line lengths. */}
      <div className="md:pl-60">
        <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6 md:pb-10 md:pt-10">
          <Suspense fallback={<RouteFallback />}>
            <AnimatedRoutes />
          </Suspense>
        </main>
      </div>

      <BottomNav />
      <Onboarding />
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
