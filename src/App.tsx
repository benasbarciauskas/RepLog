import { Routes, Route } from 'react-router-dom';

function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">RepLog</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Turn messy workout notes into a coach. On-device parsing, all-time bests,
        and a strength-imbalance analysis.
      </p>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}
