'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, FlaskConical, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { isFirebaseConfigured } from '@/lib/firebase';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const firebaseReady = isFirebaseConfigured();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (!firebaseReady) {
      toast.error('Firebase not configured', {
        description: 'Password reset requires Firebase authentication to be configured.',
      });
      return;
    }

    setLoading(true);
    try {
      const { resetPassword } = await import('@/lib/auth');
      await resetPassword(data.email);
      setSent(true);
      toast.success('Reset email sent', {
        description: 'Check your inbox for password reset instructions.',
      });
    } catch (error) {
      toast.error('Could not send reset email', {
        description: (error as Error).message || 'Please try again later.',
      });
    } finally {
      setLoading(false);
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
          <p className="text-slate-400 text-sm mt-1">Reset your password</p>
        </div>

        <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-xl shadow-2xl">
          <CardContent className="p-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <KeyRound className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">Forgot Password</h2>
                <p className="text-slate-400 text-xs">
                  {sent ? 'Check your email for next steps' : 'Enter your email to receive a reset link'}
                </p>
              </div>
            </div>

            {!firebaseReady && (
              <p className="text-amber-300/90 text-xs mb-5 bg-amber-950/40 border border-amber-800/50 rounded-lg px-3 py-2">
                Firebase is not configured. Contact your system administrator to enable password reset.
              </p>
            )}

            {sent ? (
              <div className="space-y-4">
                <p className="text-slate-300 text-sm">
                  If an account exists for that email, you will receive a password reset link shortly.
                </p>
                <Button asChild className="w-full bg-blue-600 hover:bg-blue-500">
                  <Link href="/auth/login">Back to login</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm font-medium">Email Address</Label>
                  <Input
                    {...register('email')}
                    type="email"
                    placeholder="your.email@company.com"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 h-11"
                    autoComplete="email"
                    disabled={!firebaseReady}
                  />
                  {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
                </div>

                <Button
                  type="submit"
                  disabled={loading || !firebaseReady}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
              </form>
            )}

            <p className="text-center mt-6">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1 text-blue-400 text-sm hover:text-blue-300 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
