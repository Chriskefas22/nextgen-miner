# NextGenMiner Telegram Quest Setup

## What was added

- Telegram channel link: https://t.me/nextgenminerapp
- One-time quest: `Telegram Community`
- Reward: `250 💎`
- Requirement: join `@nextgenminerapp` and react `👍` to one configured featured channel post.
- Reward credit uses the existing server-side quest + Diamond ledger and can only be claimed once per user.

## Vercel environment variables

Add these variables to the NextGen Miner Vercel project:

```text
NEXT_PUBLIC_TELEGRAM_CHANNEL_URL=https://t.me/nextgenminerapp
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=<your_bot_username_without_@>
TELEGRAM_BOT_TOKEN=<bot_token_from_BotFather>
TELEGRAM_WEBHOOK_SECRET=<long_random_secret>
TELEGRAM_QUEST_MESSAGE_ID=<channel_post_message_id>
TELEGRAM_QUEST_REACTION_EMOJI=👍
NEXT_PUBLIC_TELEGRAM_QUEST_POST_URL=https://t.me/nextgenminerapp/<channel_post_message_id>
```

`SUPABASE_SERVICE_ROLE_KEY` must already exist for the server-only Supabase client used by webhook/auth routes.

## Telegram bot configuration

1. Create or use a Telegram bot with BotFather.
2. Add the bot as an administrator of `@nextgenminerapp`. This is required so the bot can reliably check a member with `getChatMember` and receive the channel reaction updates used by this quest.
3. Configure the Telegram Login Widget domain for the production site in BotFather.
4. Publish the channel post that users should react to, and put its numeric message id in `TELEGRAM_QUEST_MESSAGE_ID`.
5. Set the webhook to the production endpoint:

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url":"https://<your-production-domain>/api/telegram/webhook",
    "secret_token":"'"$TELEGRAM_WEBHOOK_SECRET"'",
    "allowed_updates":["message_reaction"]
  }'
```

After this, a user flow is:

`Open Telegram → Join channel → React 👍 → Connect Telegram account → Verify → Claim 250 💎`

## Important

The quest intentionally does not trust a frontend button as proof of completion. The server records the Telegram account, checks channel membership through Telegram, and uses the reaction webhook state before marking the quest complete.
