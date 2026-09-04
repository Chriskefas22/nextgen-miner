import { redirect } from 'next/navigation';
import OwnerControlCenter from '@/components/owner/OwnerControlCenter';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function OwnerPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: isOwner, error } = await supabase.rpc(
    'nextgen_is_owner'
  );

  if (error || isOwner !== true) {
    redirect('/dashboard');
  }

  return <OwnerControlCenter />;
}
