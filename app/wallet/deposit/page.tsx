import { AppShell } from '@/components/layout/AppShell';
import { DepositFlow } from '@/components/wallet/DepositFlow';

export default function WalletDepositPage() {
  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">WALLET CORE</div>
          <h1 className="page-title">Deposit</h1>
          <div className="muted">Submit a crypto deposit for Owner review and Diamond credit.</div>
        </div>
      </div>
      <section className="glass section wallet-section">
        <DepositFlow />
      </section>
    </AppShell>
  );
}
