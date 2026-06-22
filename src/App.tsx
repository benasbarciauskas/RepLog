import { Suspense } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { Toaster } from '@/components/ui/sonner';
import { Sidebar, BottomNav, MobileTopBar } from '@/components/AppNav';
import { PageTransition } from '@/components/PageTransition';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { useWorkouts } from '@/data/hooks';

import DashboardPage from '@/features/dashboard/DashboardPage';
import ImportPage from '@/features/import/ImportPage';
import ReviewPage from '@/features/review/ReviewPage';
import ExercisePage from '@/features/exercise/ExercisePage';
import CoachPage from '@/features/coach/CoachPage';

/**
 * Root route ('/'): the dashboard once there are workouts, otherwise send the
 * first-time user to Import. Onboarding renders on top for genuine first runs.
 */
function HomeRoute() {
  const workouts = useWorkouts();
  if (workouts.length === 0) return <Navigate to="/import" replace />;
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
          <Suspense fallback={null}>
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
