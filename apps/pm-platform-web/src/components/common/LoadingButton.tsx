import { Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
export function LoadingButton({ loading, loadingText, children, disabled, ...props }: ButtonProps & { loading?: boolean; loadingText?: string }) { return <Button disabled={disabled || loading} {...props}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? (loadingText ?? 'Working…') : children}</Button>; }
