import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { authApi } from '@/api/auth.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth.store';

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: 'admin@acme.com', password: 'Test@1234' } });

  useEffect(() => {
    const token = params.get('verifyToken');
    if (!token) return;
    authApi.verifyEmail(token)
      .then(() => setNotice('Email verified. You can sign in now.'))
      .catch((err) => setError(err instanceof Error ? err.message : 'Email verification failed.'));
  }, [params]);

  return <Card><CardHeader><CardTitle>Login</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={form.handleSubmit(async (v) => { setLoading(true); setError(null); try { await login(v.email, v.password); navigate('/dashboard'); } catch (err) { setError(err instanceof Error ? err.message : 'Login failed'); } finally { setLoading(false); } })}>{notice && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</div>}{error && <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}<div><Label>Email</Label><Input {...form.register('email')} autoComplete="email" /></div><div><Label>Password</Label><Input type="password" {...form.register('password')} autoComplete="current-password" /></div><Button className="w-full" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button><div className="flex justify-between text-sm"><Link to="/register" className="text-primary">Create account</Link><Link to="/forgot-password" className="text-primary">Forgot password</Link></div></form></CardContent></Card>;
}
