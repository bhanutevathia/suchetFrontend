import React, { lazy, Suspense, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
  useLocation,
} from 'react-router-dom'
import App from './pages/App.jsx'
import './index.css'

// Lazy pages
const Dashboard   = lazy(() => import('./pages/Dashboard.jsx'))
const Explore     = lazy(() => import('./pages/Explore.jsx'))
const Factors     = lazy(() => import('./pages/Factors.jsx'))
const Performance = lazy(() => import('./pages/Performance.jsx'))
const Treatment   = lazy(() => import('./pages/Treatment.jsx'))

/** Simple loading splash for route-based code splitting */
function Splash() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="animate-pulse rounded-2xl border bg-white dark:bg-slate-800 px-6 py-4 shadow-sm">
        <div className="h-4 w-52 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
        <div className="h-4 w-72 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
    </div>
  )
}

/** Scroll to top & set document title on route change */
function RouteEffects() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    const map = {
      '/': 'Dashboard',
      '/explore': 'Conditions',
      '/factors': 'Factors',
      '/performance': 'Performance',
      '/treatment': 'Treatment',
    }
    const label = map[pathname] || 'ADHD Insights'
    document.title = `${label} • ADHD Insights`
  }, [pathname])
  return null
}

/** Wrap App to run route effects within router context */
function AppShell() {
  return (
    <>
      <RouteEffects />
      <App />
    </>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<Splash />}>
            <Dashboard />
          </Suspense>
        ),
      },
      {
        path: 'explore',
        element: (
          <Suspense fallback={<Splash />}>
            <Explore />
          </Suspense>
        ),
      },
      {
        path: 'factors',
        element: (
          <Suspense fallback={<Splash />}>
            <Factors />
          </Suspense>
        ),
      },
      {
        path: 'performance',
        element: (
          <Suspense fallback={<Splash />}>
            <Performance />
          </Suspense>
        ),
      },
      {
        path: 'treatment',
        element: (
          <Suspense fallback={<Splash />}>
            <Treatment />
          </Suspense>
        ),
      },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
