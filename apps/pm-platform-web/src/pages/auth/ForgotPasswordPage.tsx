import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { authApi } from '@/api/auth.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const requestSchema = z.object({ email: z.string().email() });
const resetSchema = z.object({ password: z.string().min(8) });

export function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const resetToken = params.get('resetToken');
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestForm = useForm({ resolver: zodResolver(requestSchema), defaultValues: { email: '' } });
  const resetForm = useForm({ resolver: zodResolver(resetSchema), defaultValues: { password: '' } });

  return <Card><CardHeader><CardTitle>{resetToken ? 'Set new password' : 'Reset password'}</CardTitle></CardHeader><CardContent>{error && <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}{done ? <div className="space-y-3"><p className="text-sm text-muted-foreground">Password updated. You can sign in now.</p><Link to="/login" className="text-sm text-primary">Back to login</Link></div> : resetToken ? <form className="space-y-4" onSubmit={resetForm.handleSubmit(async (v) => { setLoading(true); setError(null); try { await authApi.resetPassword({ token: resetToken, password: v.password }); setDone(true); } catch (err) { setError(err instanceof Error ? err.message : 'Password reset failed'); } finally { setLoading(false); } })}><div><Label>New password</Label><Input type="password" {...resetForm.register('password')} autoComplete="new-password" /></div><Button className="w-full" disabled={loading}>{loading ? 'Saving…' : 'Save new password'}</Button></form> : sent ? <div className="space-y-3"><p className="text-sm text-muted-foreground">If the email exists, a reset link has been sent.</p><Link to="/login" className="text-sm text-primary">Back to login</Link></div> : <form className="space-y-4" onSubmit={requestForm.handleSubmit(async (v) => { setLoading(true); setError(null); try { await authApi.forgotPassword(v.email); setSent(true); } catch (err) { setError(err instanceof Error ? err.message : 'Reset request failed'); } finally { setLoading(false); } })}><div><Label>Email</Label><Input type="email" {...requestForm.register('email')} autoComplete="email" /></div><Button className="w-full" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</Button></form>}</CardContent></Card>;
}
