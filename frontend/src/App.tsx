import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, useAuth } from './auth/AuthProvider';
import { AppShell } from './components/layout/AppShell';
import { PageSkeleton } from './components/ui';
import { useMe } from './api/hooks';
import { useLang } from './i18n/I18nProvider';

const LandingPage = lazy(() => import('./pages/Landing/LandingPage'));
const AuthPage = lazy(() => import('./pages/Auth/AuthPage'));
const OnboardingPage = lazy(() => import('./pages/Onboarding/OnboardingPage'));
const DashboardPage = lazy(() => import('./pages/Dashboard/DashboardPage'));
const CreditsPage = lazy(() => import('./pages/Credits/CreditsPage'));
const CheckPage = lazy(() => import('./pages/Check/CheckPage'));
const ResultPage = lazy(() => import('./pages/Result/ResultPage'));
const ScenariosPage = lazy(() => import('./pages/Scenarios/ScenariosPage'));
const PlanPage = lazy(() => import('./pages/Plan/PlanPage'));
const DssPage = lazy(() => import('./pages/Dss/DssPage'));
const AiPage = lazy(() => import('./pages/AI/AiPage'));
const NotificationsPage = lazy(() => import('./pages/Notifications/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/Profile/ProfilePage'));
const NotFoundPage = lazy(() => import('./pages/NotFound/NotFoundPage'));
const LegalPage = lazy(() => import('./pages/Legal/LegalPage'));

/** Applies the language saved on the account once the user is known. */
function SyncAccountLanguage() {
  const { isAuthenticated } = useAuth();
  const { data: me } = useMe(isAuthenticated);
  const { setLang } = useLang();
  useEffect(() => {
    if (me?.language) setLang(me.language);
    // Only when the account (not the language) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);
  return null;
}

function Fallback() {
  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <PageSkeleton />
    </div>
  );
}

export function App() {
  return (
    <>
      <SyncAccountLanguage />
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/terms" element={<LegalPage kind="terms" />} />
          <Route path="/privacy" element={<LegalPage kind="privacy" />} />
          <Route path="/help" element={<LegalPage kind="help" />} />
          <Route
            path="/onboarding"
            element={
              <RequireAuth>
                <OnboardingPage />
              </RequireAuth>
            }
          />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/dashboard" element={<Suspense fallback={<Fallback />}><DashboardPage /></Suspense>} />
            <Route path="/credits" element={<Suspense fallback={<Fallback />}><CreditsPage /></Suspense>} />
            <Route path="/check" element={<Suspense fallback={<Fallback />}><CheckPage /></Suspense>} />
            <Route path="/result/:id" element={<Suspense fallback={<Fallback />}><ResultPage /></Suspense>} />
            <Route path="/scenarios" element={<Suspense fallback={<Fallback />}><ScenariosPage /></Suspense>} />
            <Route path="/plan" element={<Suspense fallback={<Fallback />}><PlanPage /></Suspense>} />
            <Route path="/dss" element={<Suspense fallback={<Fallback />}><DssPage /></Suspense>} />
            <Route path="/ai" element={<Suspense fallback={<Fallback />}><AiPage /></Suspense>} />
            <Route path="/notifications" element={<Suspense fallback={<Fallback />}><NotificationsPage /></Suspense>} />
            <Route path="/profile" element={<Suspense fallback={<Fallback />}><ProfilePage /></Suspense>} />
          </Route>
          <Route path="/app" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}
