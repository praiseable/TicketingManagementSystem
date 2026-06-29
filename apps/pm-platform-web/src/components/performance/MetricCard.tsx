import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
export function MetricCard({ title, value, suffix = '' }: { title: string; value: number; suffix?: string }) { const mv = useMotionValue(0); const spring = useSpring(mv, { stiffness: 80, damping: 20 }); const display = useTransform(spring, (latest) => `${Math.round(latest).toLocaleString()}${suffix}`); useEffect(() => mv.set(value), [value]); return <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><motion.div className="text-3xl font-bold">{display}</motion.div></CardContent></Card>; }
