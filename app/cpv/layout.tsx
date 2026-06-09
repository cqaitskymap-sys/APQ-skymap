import { CpvShell } from '@/components/cpv/cpv-shell';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CpvShell>{children}</CpvShell>;
}
