import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import AdminDashboard from './components/AdminDashboard';
import AdminLogin from './components/AdminLogin';
import EmbedChat from './components/EmbedChat';
import ErrorBoundary from './components/ErrorBoundary';
import { auth, isFirebaseAvailable } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

export default function App() {
  const [currentView, setCurrentView] = useState<'admin' | 'embed'>('admin');
  
  // Firebase authentication state
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // 1. Unified popstate and hash change router to maintain static-friendly URLs
  useEffect(() => {
    const checkRoute = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const search = window.location.search;

      if (
        path === '/embed' ||
        hash === '#/embed' ||
        hash === '#embed' ||
        search.includes('view=embed') ||
        search.includes('embed=true')
      ) {
        setCurrentView('embed');
      } else {
        setCurrentView('admin');
      }
    };

    checkRoute();
    window.addEventListener('popstate', checkRoute);
    window.addEventListener('hashchange', checkRoute);

    return () => {
      window.removeEventListener('popstate', checkRoute);
      window.removeEventListener('hashchange', checkRoute);
    };
  }, []);

  // 2. Track global Firebase authentication changes
  useEffect(() => {
    if (!isFirebaseAvailable || !auth) {
      setIsAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLoginSuccess = (authenticatedUser: any) => {
    setUser(authenticatedUser);
  };

  const handleLogout = async () => {
    if (isFirebaseAvailable && auth) {
      await signOut(auth);
    }
    setUser(null);
  };

  const navigateToEmbed = () => {
    window.location.hash = '#/embed';
  };

  const navigateToAdmin = () => {
    try {
      // If running inside an iframe, try to navigate the top window to the admin route
      if (window.top && window.top !== window) {
        // Prefer setting the full href to avoid nested-hash issues
        window.top.location.href = `${window.location.origin}/#`;
        return;
      }
    } catch (e) {
      // Accessing window.top may throw on cross-origin frames — fall back to local navigation
    }

    // Default: navigate within the current window
    window.location.hash = '';
  };

  // Skeleton loader during auth verification
  if (isAuthLoading) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center font-sans gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-3 w-32 bg-muted rounded animate-pulse" />
            <div className="h-2 w-20 bg-muted/60 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-muted-foreground font-mono">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      <AnimatePresence mode="wait">
        
        {/* VIEW TYPE A: EMBED CHAT VIEW */}
        {currentView === 'embed' && (
          <motion.div
            key="embed-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full w-full relative"
          > 
            <EmbedChat />
          </motion.div>
        )}

        {/* VIEW TYPE B: CENTRAL CONSOLE PORTAL */}
        {currentView === 'admin' && (
          <motion.div
            key="admin-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full w-full"
          >
            {user ? (
              // Case: Logged In -> Show Administration Console
              <AdminDashboard
                currentUser={user}
                onLogout={handleLogout}
                onNavigateToEmbed={navigateToEmbed}
              />
            ) : (
              // Case: Not Logged In -> Secure Admin Login Portal
              <AdminLogin
                onLoginSuccess={handleLoginSuccess}
                onNavigateToEmbed={navigateToEmbed}
              />
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}
