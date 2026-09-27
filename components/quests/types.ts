export type Quest = {
  id: number;
  quest_key: string;
  title: string;
  description: string;
  target_count: number | string;
  reward_diamond: number | string;
  progress: number | string;
  claimed_at?: string | null;
  period_key?: string;
};
