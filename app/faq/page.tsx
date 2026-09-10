import { PublicPage } from '@/components/public/PublicPage';

export const metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about NextGen Miner.',
};

const faqs = [
  ['Is the platform free to join?', 'Account creation is free. Miner ownership, rewards and withdrawal eligibility are governed by the rules shown on the platform.'],
  ['How does the launch Entry GPU campaign work?', 'Eligible registration is allocated server-side after the required verification step and only while campaign slots remain. The database is the source of truth.'],
  ['How are rewards calculated?', 'Rewards depend on configured platform mining economics, available reward resources and applicable controls. Client-side displays are not final financial credits.'],
  ['Can I upgrade a miner?', 'Eligible owned miners can progress through available levels when the required Diamond balance and server-side upgrade rules are satisfied.'],
  ['What currency does the platform use?', 'The platform uses Diamond (💎) for its internal miner and reward economy. Conversion and economic values are controlled by backend configuration.'],
  ['Are rewards guaranteed?', 'No. Virtual mining rewards are not guaranteed income, profit or investment returns.'],
  ['How do withdrawals work?', 'Eligible withdrawals are submitted through the wallet system and are subject to the current minimum, qualifying top-up rules, review and supported payout availability.'],
  ['What should I do if I find a security issue?', 'Use the official security/support channel listed on Contact. Never send passwords, recovery codes, private keys or other secrets.'],
];

export default function FAQPage() {
  return (
    <PublicPage
      eyebrow="FREQUENTLY ASKED QUESTIONS"
      title="Answers before you join."
      description="The important basics are documented publicly so users do not have to guess how the platform works."
    >
      <section className="public-card public-hero">
        <div className="public-faq">
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </PublicPage>
  );
}
