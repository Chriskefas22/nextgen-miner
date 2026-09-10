import { PublicPage } from '@/components/public/PublicPage';

export const metadata = {
  title: 'Disclaimer',
  description: 'Risk and platform disclaimer for NextGen Miner.',
};

export default function DisclaimerPage() {
  return (
    <PublicPage
      eyebrow="LEGAL · DISCLAIMER"
      title="Important platform and risk information."
      description="Please understand the virtual nature of the service and the absence of guaranteed returns before participating."
    >
      <section className="public-card public-hero">
        <div className="public-note">
          NextGen Miner is a virtual mining and reward platform. Nothing on this website should
          be interpreted as a promise of investment performance, guaranteed profit or guaranteed income.
        </div>
        <h2>No guaranteed returns</h2>
        <p>
          Mining rewards can change according to platform economics, configured rates,
          available reward resources, campaign conditions and risk controls. Past results,
          displayed estimates or promotional examples do not guarantee future rewards.
        </p>
        <h2>Virtual platform</h2>
        <p>
          Miner hashrate, Diamond balances, progression and reward records are platform-managed
          digital states. They should not be represented as ownership of physical mining hardware
          unless a separate written agreement explicitly says otherwise.
        </p>
        <h2>User responsibility</h2>
        <p>
          Users are responsible for reviewing the current Terms, Privacy Policy, withdrawal rules,
          campaign conditions and applicable laws before participating. Users should not deposit
          funds they cannot afford to lose.
        </p>
        <h2>Availability and changes</h2>
        <p>
          Features, supported networks, reward resources, campaigns and platform rules may change,
          be suspended or become unavailable when necessary for security, maintenance or operational reasons.
        </p>
        <h2>Official information</h2>
        <p>
          This page is general platform information and is not legal, tax, financial or investment advice.
          Obtain independent professional advice where appropriate.
        </p>
      </section>
    </PublicPage>
  );
}
