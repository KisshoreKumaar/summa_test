import { Alert } from '@/components/ui/alert';

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <Alert tone="error">{message}</Alert>;
}
