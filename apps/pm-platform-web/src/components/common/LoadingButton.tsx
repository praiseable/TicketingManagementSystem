import { Button, type ButtonProps } from '@/components/ui/button';

export function LoadingButton({ loading, loadingText = 'Saving…', children, disabled, ...props }: ButtonProps & { loading?: boolean; loadingText?: string }) {
  return (
    <Button disabled={disabled || loading} aria-busy={loading ? 'true' : undefined} {...props}>
      {loading ? loadingText : children}
    </Button>
  );
}
