import { PublicPage } from '@/components/public/PublicPage';
import FAQExplorer, { type FAQItem } from '@/components/public/FAQExplorer';

export const metadata = {
  title: 'FAQ',
  description: 'Searchable answers about NextGen Miner accounts, miners, rewards, wallet, bonus, referrals, security and platform rules.',
};

const faqs: FAQItem[] = [
  { category: 'Account', question: 'Is it free to create an account?', answer: 'Yes. Account creation is free. Miner ownership, rewards and withdrawals are governed by the current platform rules.' },
  { category: 'Account', question: 'Why do I need to verify my email?', answer: 'Verification helps confirm account ownership and can be required for eligibility, security and campaign controls.' },
  { category: 'Account', question: 'Can I use more than one account?', answer: 'Use only accounts permitted by the current platform rules. Duplicate-account abuse or attempts to bypass controls are prohibited.' },
  { category: 'Account', question: 'What should I do if I cannot log in?', answer: 'Use the authentication recovery flow first. Do not send your password, recovery code or private credentials to support.' },
  { category: 'Bonus', question: 'How do I get the Entry GPU launch bonus?', answer: 'Register, complete the required verification and meet the campaign eligibility rules. The server checks campaign state, identity protection and remaining allocation before assignment.' },
  { category: 'Bonus', question: 'Can the launch bonus run out?', answer: 'Yes. The campaign has a finite allocation. The live database campaign state is the source of truth for remaining availability.' },
  { category: 'Bonus', question: 'Why did I not receive the bonus immediately?', answer: 'Eligibility and allocation are checked server-side. Verification status, campaign availability or account conditions can prevent an assignment.' },
  { category: 'Miners', question: 'What is a virtual miner?', answer: 'A virtual miner is a platform-managed digital asset record with a configured hashrate, price, level progression and status. It is not physical hardware.' },
  { category: 'Miners', question: 'Where can I see the miner catalog?', answer: 'Use the public Miner Catalog to browse enabled miners before signing in. Purchases and ownership actions remain behind authentication.' },
  { category: 'Miners', question: 'Can I upgrade my miner?', answer: 'Eligible owned miners can progress through available levels when the required Diamond balance and server-side upgrade rules are satisfied.' },
  { category: 'Miners', question: 'How many levels can a miner have?', answer: 'The active catalog and level configuration determine the available progression. The public catalog displays the currently enabled level range.' },
  { category: 'Rewards', question: 'Are mining rewards guaranteed?', answer: 'No. Rewards are not guaranteed income, profit or investment returns. Values depend on platform economics, available reward resources and current controls.' },
  { category: 'Rewards', question: 'How are rewards calculated?', answer: 'Reward calculations are controlled by server-side platform economics and applicable rules. Browser estimates are not final financial credits.' },
  { category: 'Rewards', question: 'What affects my hashrate?', answer: 'Owned active miners, their current levels and applicable platform conditions affect the hashrate represented by the account.' },
  { category: 'Wallet', question: 'What currency does NextGen Miner use?', answer: 'Diamond (💎) is the internal platform economy unit used for miner-related pricing and rewards.' },
  { category: 'Wallet', question: 'Why is a deposit pending?', answer: 'A submitted deposit remains pending until the platform review process determines whether it is approved or rejected. Submission alone does not finalize a credit.' },
  { category: 'Wallet', question: 'What happens when a deposit is approved?', answer: 'An approved deposit is credited according to the active server-side Diamond rate and review rules, with the transaction recorded in the platform ledger.' },
  { category: 'Wallet', question: 'What happens when a deposit is rejected?', answer: 'A rejected deposit is not credited through the review approval path. The final record and any user-specific status should be checked in the authenticated wallet history.' },
  { category: 'Wallet', question: 'How do withdrawals work?', answer: 'Eligible withdrawals are submitted through the authenticated wallet flow and are subject to the current minimum, qualifying top-up requirements, supported payout methods and review controls.' },
  { category: 'Referral', question: 'How does the referral program work?', answer: 'A registered user receives a server-owned referral code. New accounts can arrive through that code, and attribution and qualification are determined by server-side referral records.' },
  { category: 'Referral', question: 'Can two people receive credit for the same referral?', answer: 'A referred account is designed to be uniquely attributed to one referrer so duplicate attribution can be prevented.' },
  { category: 'Security', question: 'Should I send my password to support?', answer: 'Never. Support should not need your password, recovery codes, private keys or seed phrases.' },
  { category: 'Security', question: 'How do I report a security issue?', answer: 'Use an official Contact channel and provide reproducible, non-sensitive evidence. Never include credentials or wallet secrets.' },
  { category: 'Platform', question: 'Is the network telemetry real?', answer: 'The landing page uses the server-side landing telemetry function for aggregate platform figures such as active miners, total hashrate, enabled networks and enabled miner catalog entries.' },
  { category: 'Platform', question: 'Can platform rules change?', answer: 'Yes. Supported assets, campaigns, miners, economic parameters and operational rules may change for maintenance, security or business reasons, subject to applicable law.' },
  { category: 'Platform', question: 'What if a feature stops working?', answer: 'Check the current platform status and retry later. For account-specific or persistent issues, use the official Contact channel or the signed-in Support Center.' },
  { category: 'Legal', question: 'Are the virtual miners physical mining machines?', answer: 'No. The public documentation describes them as platform-managed virtual mining records unless a separate written agreement explicitly establishes physical hardware ownership.' },
  { category: 'Legal', question: 'Where can I read the Terms and Privacy Policy?', answer: 'Use the public Terms of Service and Privacy Policy pages. The Disclaimer is also available and should be read before participation.' },
  { category: 'Legal', question: 'Does the website provide investment advice?', answer: 'No. Platform information is not legal, tax, financial or investment advice. Users should obtain independent professional advice where appropriate.' },
];

export default function FAQPage() {
  return (
    <PublicPage
      eyebrow="FREQUENTLY ASKED QUESTIONS"
      title="Find your answer before you need to ask."
      description="Search by keyword or browse a topic. The FAQ is designed to answer the common questions a visitor or user can reasonably have about the platform."
    >
      <section className="public-card public-hero">
        <FAQExplorer items={faqs} />
      </section>
    </PublicPage>
  );
}
