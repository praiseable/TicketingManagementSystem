import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth.store';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  orgName: z.string().optional()
});

export function RegisterPage() {
  const navigate = useNavigate();
  const registerUser = useAuthStore((s) => s.register);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { name: '', email: '', password: '', orgName: '' } });

  return <Card><CardHeader><CardTitle>Create account</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={form.handleSubmit(async (v) => { setLoading(true); setError(null); try { await registerUser(v); navigate('/dashboard'); } catch (err) { setError(err instanceof Error ? err.message : 'Registration failed'); } finally { setLoading(false); } })}>{error && <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}<div><Label>Name</Label><Input {...form.register('name')} autoComplete="name" /></div><div><Label>Email</Label><Input {...form.register('email')} autoComplete="email" /></div><div><Label>Password</Label><Input type="password" {...form.register('password')} autoComplete="new-password" /></div><div><Label>Organisation</Label><Input {...form.register('orgName')} /></div><Button className="w-full" disabled={loading}>{loading ? 'Creating account…' : 'Register'}</Button><Link to="/login" className="block text-center text-sm text-primary">Already have an account?</Link></form></CardContent></Card>;
}
