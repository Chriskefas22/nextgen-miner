create policy "nextgen_telegram_links_deny_client_access"
on public.nextgen_telegram_links
for all
to anon, authenticated
using (false)
with check (false);

create policy "nextgen_telegram_reactions_deny_client_access"
on public.nextgen_telegram_reactions
for all
to anon, authenticated
using (false)
with check (false);
