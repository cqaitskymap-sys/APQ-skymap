'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Eye, EyeOff, FlaskConical, Loader2, Shield, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/auth-context';
import { isFirebaseConfigured } from '@/lib/firebase-config';
import { isDemoAuthEnabled } from '@/lib/demo-auth-config';
import { DEMO_SUPER_ADMIN } from '@/lib/demo-auth';
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  showDefaultAdminHint,
} from '@/lib/default-admin-config';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();
  const firebaseReady = isFirebaseConfigured();
  const demoMode = isDemoAuthEnabled();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    const { error } = await signIn(data.email, data.password);
    if (error) {
      toast.error('Authentication failed', { description: error.message });
      setLoading(false);
    } else {
      toast.success('Welcome back!', { description: 'Redirecting to dashboard...' });
      router.push('/dashboard');
    }
  };

  const demoLogin = async () => {
    setLoading(true);
    const { error } = await signIn(DEMO_SUPER_ADMIN.email, DEMO_SUPER_ADMIN.password);
    if (error) {
      toast.error('Demo login failed', { description: error.message });
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptMC00djJoLTJ2LTJoMnptLTQgOHYyaC0ydi0yaDJ6bTAtNHYyaC0ydi0yaDJ6bTAtNHYyaC0ydi0yaDJ6bTQtOHYyaC0ydi0yaDJ6bTAtNHYyaC0ydi0yaDJ6bTQgMTJ2MmgtMnYtMmgyek00MCA0MHYyaC0ydi0yaDJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-40" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/30 mb-4">
            <FlaskConical className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">PharmaQMS</h1>
          <p className="text-slate-400 text-sm mt-1">Enterprise Quality Management System</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Badge variant="outline" className="border-blue-500/50 text-blue-400 text-xs">FDA 21 CFR Part 11</Badge>
            <Badge variant="outline" className="border-green-500/50 text-green-400 text-xs">WHO GMP</Badge>
          </div>
        </div>

        <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-xl shadow-2xl">
          <CardContent className="p-8">
            {firebaseReady && showDefaultAdminHint() && !demoMode && (
              <div className="mb-4 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs text-blue-100">
                <p className="font-medium text-blue-200 mb-1">Default Super Admin (full access)</p>
                <p>
                  Email: <code className="bg-blue-500/20 px-1 rounded">{DEFAULT_ADMIN_EMAIL}</code>
                  {' · '}
                  Password: <code className="bg-blue-500/20 px-1 rounded">{DEFAULT_ADMIN_PASSWORD}</code>
                </p>
                <p className="text-blue-300/80 mt-1">
                  Create this user in Firebase once: <code className="bg-blue-500/20 px-1 rounded">npm run setup:admin</code>
                </p>
              </div>
            )}

            {!firebaseReady && !demoMode && (
              <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Firebase is not configured. Add <code className="bg-amber-500/20 px-1 rounded">NEXT_PUBLIC_FIREBASE_*</code> environment variables to enable authentication.
              </div>
            )}

            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <Lock className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">Secure Login</h2>
                <p className="text-slate-400 text-xs">Authorized personnel only</p>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm font-medium">Email Address</Label>
                <Input
                  {...register('email')}
                  type="email"
                  placeholder="your.email@company.com"
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 h-11"
                  autoComplete="email"
                  disabled={!firebaseReady && !demoMode}
                />
                {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300 text-sm font-medium">Password</Label>
                  <Link href="/auth/forgot-password" className="text-blue-400 text-xs hover:text-blue-300 transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 h-11 pr-10"
                    autoComplete="current-password"
                    disabled={!firebaseReady && !demoMode}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
              </div>

              <Button
                type="submit"
                disabled={loading || (!firebaseReady && !demoMode)}
                className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/25 transition-all duration-200"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Authenticating...</>
                ) : (
                  <><Shield className="h-4 w-4 mr-2" /> Sign In Securely</>
                )}
              </Button>
            </form>

            {demoMode && (
              <div className="mt-6 pt-5 border-t border-slate-700">
                <p className="text-slate-400 text-xs text-center mb-3">Local Demo (Super Admin)</p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                  onClick={demoLogin}
                  disabled={loading}
                >
                  Login as Super Admin (Demo)
                </Button>
                <p className="text-slate-500 text-[11px] text-center mt-2">
                  Email: <code className="text-slate-400">{DEMO_SUPER_ADMIN.email}</code>
                  {' · '}
                  Password: <code className="text-slate-400">{DEMO_SUPER_ADMIN.password}</code>
                </p>
              </div>
            )}

            <p className="text-center text-slate-500 text-xs mt-5">
              Don&apos;t have an account? Contact your system administrator.
            </p>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-4 mt-6 text-xs text-slate-600">
          <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> 256-bit SSL</span>
          <span>•</span>
          <span>21 CFR Part 11 Compliant</span>
          <span>•</span>
          <span>Audit Logged</span>
        </div>
      </div>
    </div>
  );
}
