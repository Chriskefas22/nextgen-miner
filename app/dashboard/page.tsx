import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { HomeCommandCenter, HomeSnapshot } from '@/components/home/HomeCommandCenter';
import { createClient } from '@/lib/supabase/server';

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data, error } = await supabase.rpc('nextgen_farm_snapshot', { p_asset: 'USDT' });
  if (error || !data) {
    console.error('[HomeSnapshot]', error);
    redirect('/dashboard?error=farm_snapshot');
  }

  return <AppShell><HomeCommandCenter initialData={data as HomeSnapshot} /></AppShell>;
}
