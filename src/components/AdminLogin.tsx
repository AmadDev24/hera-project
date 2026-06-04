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
      setErrorText('Firebase Authentication is offline or not configured in raw credentials secrets.');
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
        setInfoText('Account created and verified successfully!');
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
        errMsg = 'This email is already registered. Please login instead.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'Password is too weak. Must be at least 6 characters.';
      }
      setErrorText(`${errMsg} (Code: ${err.code || 'unknown'})`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulateMockLogin = async () => {
    if (!isFirebaseAvailable || !auth) {
      // Firebase not configured — use an instant bypass mock user
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
    setInfoText('Creating/Signing in with preset mock credentials...');

    const randomSuffix = Math.floor(Math.random() * 1000);
    const mockEmail = `mock.advisor.${randomSuffix}@hasil.gov.my`;
    const mockPassword = 'HasilMockPassword2026!';

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, mockEmail, mockPassword);
      setInfoText('Mock Advisor logged in successfully!');
      setTimeout(() => {
        onLoginSuccess(userCredential.user);
      }, 800);
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
        console.warn('Firebase error, falling back to instant bypass mode', err);
        const fallbackUser = {
          uid: 'uid_mock_bypass_advisor',
          email: 'advisor-audit@hasil.gov.my',
          displayName: 'Mock Officer Audit',
          photoURL: null,
          emailVerified: true
        };
        onLoginSuccess(fallbackUser);
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen w-screen bg-background text-foreground flex flex-col justify-between p-6 relative overflow-hidden dark" id="login-container">
      {/* Ambient glowing aura */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full filter blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-secondary/5 rounded-full filter blur-3xl -z-10 pointer-events-none" />

      {/* Top Banner Row */}
      <header className="max-w-7xl mx-auto w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-2 select-none">
          <Shield className="text-primary w-5 h-5 animate-pulse" />
          <span className="font-display font-semibold text-lg tracking-tight text-foreground">
            HERA Admin Console
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={isFirebaseAvailable ? 'default' : 'secondary'}
            className="text-[9px] px-2 py-0.5 rounded-full font-mono gap-1"
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${isFirebaseAvailable ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {isFirebaseAvailable ? 'Firebase Online' : 'Offline Mode'}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onNavigateToEmbed}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            id="go-to-chat-trigger"
          >
            <BookOpen size={13} />
            <span>Launch Chatbot</span>
            <ArrowRight size={12} />
          </Button>
        </div>
      </header>

      {/* Modern Card Block */}
      <main className="max-w-md w-full mx-auto my-auto py-10 z-10">
        <Card className="border border-border/60 bg-card/60 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          
          <CardHeader className="text-center pt-8 pb-4">
            <div className="mx-auto mb-3 inline-flex p-3 bg-primary/10 border border-primary/20 rounded-2xl text-primary animate-bounce">
              <Fingerprint size={24} />
            </div>
            <CardTitle className="text-xl font-display font-semibold text-foreground tracking-tight">
              {isRegisterMode ? 'Deploy New Admin Account' : 'Administrator Sign In'}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1.5">
              Log in to regulate consultation workflows, audit conversations, customize system prompts, and manage FAQ lists.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 px-8 pb-6">
            <form onSubmit={handleEmailAuth} className="space-y-4">
              
              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider block">
                  Office Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
                    <Mail size={14} />
                  </div>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="officer@hasil.gov.my"
                    className="pl-9 h-9"
                    id="login-email"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider block">
                  Security Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
                    <Lock size={14} />
                  </div>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 h-9"
                    id="login-password"
                    required
                  />
                </div>
              </div>

              {/* Feedback messages */}
              <AnimatePresence mode="wait">
                {errorText && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive leading-normal"
                  >
                    {errorText}
                  </motion.div>
                )}
                {infoText && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-xs text-primary font-medium leading-normal animate-pulse"
                  >
                    {infoText}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full text-xs font-semibold h-10 mt-2 gap-2"
                id="submit-auth-button"
              >
                {isRegisterMode ? <UserPlus size={14} /> : <Shield size={14} />}
                <span>{isLoading ? 'Securing Authorization...' : (isRegisterMode ? 'Complete Registration' : 'Log In Securely')}</span>
              </Button>
            </form>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setErrorText(null);
                  setInfoText(null);
                }}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                id="toggle-auth-mode"
              >
                {isRegisterMode ? 'Already have an officer account? Sign In' : 'Need a new credential account? Deploy Account'}
              </button>
            </div>
          </CardContent>

          {/* Quick Mock Bypass */}
          <CardFooter className="flex flex-col bg-muted/30 border-t border-border/40 px-8 py-5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block mb-2 text-center">
              Reviewer Bypass Authentication
            </span>
            <Button
              variant="outline"
              onClick={handleSimulateMockLogin}
              disabled={isLoading}
              className="w-full h-9 flex items-center justify-center gap-2 transition-all cursor-pointer bg-background"
              id="mock-login-trigger"
            >
              <Sparkles size={13} className="text-amber-500 animate-pulse" />
              <span>Generate & Auth Mock Admin</span>
            </Button>
            <p className="text-[10px] text-muted-foreground mt-2 text-center leading-normal">
              Creates and logs in with static credentials directly to review the live dashboard features instantly.
            </p>
          </CardFooter>

        </Card>
      </main>

      {/* Footer copyright */}
      <footer className="text-center z-10 max-w-md mx-auto w-full">
        <p className="text-[10px] text-muted-foreground/60">
          Corporate Security Gate &bull; HASiL LHDN Web Advisor Analytics &bull; 2026 UTC
        </p>
      </footer>
    </div>
  );
}
