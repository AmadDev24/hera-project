import React, { useState } from 'react';
import { Mail, Lock, Shield, UserPlus, Sparkles, ArrowRight, BookOpen, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, isFirebaseAvailable } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface AdminLoginProps {
  onLoginSuccess: (user: any) => void;
  onNavigateToEmbed: () => void;
}

export default function AdminLogin({ onLoginSuccess, onNavigateToEmbed }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [infoText, setInfoText] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFirebaseAvailable || !auth) {
      setErrorText('Firebase Authentication is offline or not configured.');
      return;
    }
    if (!email || !password) {
      setErrorText('Please enter both email and password.');
      return;
    }

    setErrorText(null);
    setInfoText(null);
    setIsLoading(true);

    try {
      if (isRegisterMode) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        onLoginSuccess(userCredential.user);
        setInfoText('Account created successfully!');
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        onLoginSuccess(userCredential.user);
      }
    } catch (err: any) {
      console.error('Email Auth Error:', err);
      let errMsg = err.message || 'Authentication failed.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errMsg = 'Invalid email address or incorrect password.';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'This email is already registered. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'Password too weak — minimum 6 characters required.';
      }
      setErrorText(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulateMockLogin = async () => {
    if (!isFirebaseAvailable || !auth) {
      const fallbackUser = {
        uid: 'uid_mock_bypass_advisor',
        email: 'advisor-audit@hasil.gov.my',
        displayName: 'Mock Officer Audit',
        photoURL: null,
        emailVerified: true,
      };
      onLoginSuccess(fallbackUser);
      return;
    }

    setIsLoading(true);
    setErrorText(null);
    setInfoText('Generating mock credentials…');

    const randomSuffix = Math.floor(Math.random() * 1000);
    const mockEmail = `mock.advisor.${randomSuffix}@hasil.gov.my`;
    const mockPassword = 'HasilMockPassword2026!';

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, mockEmail, mockPassword);
      setInfoText('Mock admin logged in!');
      setTimeout(() => onLoginSuccess(userCredential.user), 600);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use' || err.code === 'auth/email-already-exists') {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, mockEmail, mockPassword);
          onLoginSuccess(userCredential.user);
        } catch (innerErr: any) {
          setErrorText(`Unable to authenticate mock: ${innerErr.message}`);
          setIsLoading(false);
        }
      } else {
        console.warn('Firebase error, falling back to instant bypass', err);
        const fallbackUser = {
          uid: 'uid_mock_bypass_advisor',
          email: 'advisor-audit@hasil.gov.my',
          displayName: 'Mock Officer Audit',
          photoURL: null,
          emailVerified: true,
        };
        onLoginSuccess(fallbackUser);
        setIsLoading(false);
      }
    }
  };

  return (
    // dark class ensures the login page always shows in dark mode regardless of system preference
    <div className="dark min-h-screen w-screen bg-background text-foreground flex flex-col justify-between p-5 relative overflow-hidden" id="login-container">

      {/* Ambient background glow */}
      <div className="pointer-events-none -z-10 absolute inset-0">
        <div className="absolute top-0 left-1/4 w-[480px] h-[480px] rounded-full bg-primary/8 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[360px] h-[360px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      {/* Top nav bar */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-2 select-none">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-foreground">
            HERA Admin Console
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={isFirebaseAvailable ? 'default' : 'secondary'}
            className="text-[10px] px-2 py-0.5 rounded-full font-mono gap-1.5 h-5"
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${isFirebaseAvailable ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {isFirebaseAvailable ? 'Firebase Online' : 'Offline Mode'}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onNavigateToEmbed}
            className="text-xs text-muted-foreground hover:text-foreground h-7 px-2.5 gap-1.5"
            id="go-to-chat-trigger"
          >
            <BookOpen size={12} />
            Launch Chatbot
            <ArrowRight size={11} />
          </Button>
        </div>
      </header>

      {/* Login card */}
      <main className="max-w-sm w-full mx-auto my-auto z-10">
        <Card className="border border-border/50 bg-card/60 backdrop-blur-xl shadow-2xl">

          <CardHeader className="text-center pt-7 pb-3">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/15 text-primary">
              <Fingerprint size={22} />
            </div>
            <CardTitle className="text-lg font-semibold text-foreground tracking-tight">
              {isRegisterMode ? 'Create Admin Account' : 'Sign In'}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Access the HERA admin console to manage conversations, FAQs, leads, and system settings.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-5 space-y-4">
            <form onSubmit={handleEmailAuth} className="space-y-3">

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground block">
                  Email address
                </label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="officer@hasil.gov.my"
                    className="pl-8 h-9 text-sm"
                    id="login-email"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground block">
                  Password
                </label>
                <div className="relative">
                  <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-8 h-9 text-sm"
                    id="login-password"
                    required
                  />
                </div>
              </div>

              {/* Feedback messages */}
              <AnimatePresence mode="wait">
                {errorText && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2.5 text-xs text-destructive leading-relaxed"
                  >
                    {errorText}
                  </motion.div>
                )}
                {infoText && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="rounded-lg border border-primary/20 bg-primary/8 px-3 py-2.5 text-xs text-primary leading-relaxed"
                  >
                    {infoText}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-9 text-sm font-medium gap-2 mt-1"
                id="submit-auth-button"
              >
                {isRegisterMode ? <UserPlus size={14} /> : <Shield size={14} />}
                {isLoading
                  ? 'Authenticating…'
                  : isRegisterMode
                    ? 'Create Account'
                    : 'Sign In'
                }
              </Button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setErrorText(null);
                  setInfoText(null);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                id="toggle-auth-mode"
              >
                {isRegisterMode
                  ? 'Already have an account? Sign in'
                  : 'Need an account? Register'
                }
              </button>
            </div>
          </CardContent>

          {/* Quick mock bypass */}
          <CardFooter className="flex flex-col gap-2 bg-muted/20 border-t border-border/40 px-6 py-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest text-center">
              Quick Access
            </p>
            <Button
              variant="outline"
              onClick={handleSimulateMockLogin}
              disabled={isLoading}
              className="w-full h-8 text-xs gap-2 bg-transparent"
              id="mock-login-trigger"
            >
              <Sparkles size={12} className="text-amber-400" />
              Generate Mock Admin Access
            </Button>
            <p className="text-[10px] text-muted-foreground/70 text-center leading-relaxed">
              Creates a temporary mock account for reviewing dashboard features.
            </p>
          </CardFooter>

        </Card>
      </main>

      {/* Footer */}
      <footer className="text-center z-10">
        <p className="text-[10px] text-muted-foreground/50">
          HERA Admin Console &bull; LHDN Tax Advisor &bull; 2026
        </p>
      </footer>
    </div>
  );
}