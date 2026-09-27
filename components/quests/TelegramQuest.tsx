"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Send, ShieldCheck } from "lucide-react";

import type { Quest } from "@/components/quests/types";

type Props = {
  quest: Quest;
  busy: boolean;
  onClaim: (quest: Quest) => Promise<void>;
  onRefresh: () => Promise<void>;
};

type TelegramAuthUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date?: number;
  hash?: string;
};

type VerifyState = {
  connected: boolean;
  joined: boolean;
  liked: boolean;
  verified: boolean;
  message: string;
};

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthUser) => void;
  }
}

export default function TelegramQuest({
  quest,
  busy,
  onClaim,
  onRefresh,
}: Props) {
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [state, setState] = useState<VerifyState>({
    connected: false,
    joined: false,
    liked: false,
    verified: false,
    message: "",
  });

  const channelUrl =
    process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL ||
    "https://t.me/nextgenminerapp";
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "";
  const postUrl =
    process.env.NEXT_PUBLIC_TELEGRAM_QUEST_POST_URL || channelUrl;

  const verify = useCallback(async () => {
    setVerifying(true);
    setState((current) => ({ ...current, message: "Checking Telegram status…" }));

    try {
      const response = await fetch("/api/telegram/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        joined?: boolean;
        liked?: boolean;
        verified?: boolean;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Telegram verification failed.");
      }

      setState({
        connected: true,
        joined: data.joined === true,
        liked: data.liked === true,
        verified: data.verified === true,
        message: data.verified
          ? "Telegram quest verified. You can claim your 💎 reward."
          : "Join the channel and react 👍 to the featured post, then verify again.",
      });

      await onRefresh();
    } catch (error) {
      setState((current) => ({
        ...current,
        message:
          error instanceof Error
            ? error.message
            : "Telegram verification failed.",
      }));
    } finally {
      setVerifying(false);
    }
  }, [onRefresh]);

  const handleAuth = useCallback(
    async (telegramUser: TelegramAuthUser) => {
      setState((current) => ({
        ...current,
        message: "Connecting Telegram account…",
      }));

      try {
        const response = await fetch("/api/telegram/auth", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(telegramUser),
        });

        const data = (await response.json()) as {
          ok?: boolean;
          error?: string;
        };

        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Telegram connection failed.");
        }

        setState((current) => ({
          ...current,
          connected: true,
          message: "Telegram connected. Checking join + reaction…",
        }));

        await verify();
      } catch (error) {
        setState((current) => ({
          ...current,
          message:
            error instanceof Error
              ? error.message
              : "Telegram connection failed.",
        }));
      }
    },
    [verify],
  );

  useEffect(() => {
    window.onTelegramAuth = handleAuth;

    if (!botUsername || !widgetRef.current) {
      return () => {
        delete window.onTelegramAuth;
      };
    }

    const container = widgetRef.current;
    container.replaceChildren();

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "medium");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    container.appendChild(script);

    return () => {
      container.replaceChildren();
      if (window.onTelegramAuth === handleAuth) {
        delete window.onTelegramAuth;
      }
    };
  }, [botUsername, handleAuth]);

  const claimReady = state.verified && Number(quest.progress) >= Number(quest.target_count);
  const progressText = claimReady ? "1 / 1" : "0 / 1";

  const checks = useMemo(
    () => [
      { label: "Join @nextgenminerapp", done: state.joined },
      { label: "React 👍 on the featured post", done: state.liked },
    ],
    [state.joined, state.liked],
  );

  return (
    <section className="glass section" style={{ gridColumn: "1 / -1" }}>
      <div className="section-head">
        <div>
          <div className="eyebrow">TELEGRAM COMMUNITY QUEST</div>
          <h2>{quest.title}</h2>
          <div className="muted">{quest.description}</div>
        </div>
        <b>💎 {Number(quest.reward_diamond || 0)}</b>
      </div>

      <div className="telegram-quest-grid">
        <div className="telegram-quest-steps">
          <a
            className="btn btn-ghost"
            href={channelUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            <Send size={16} />
            Open Telegram Channel
            <ExternalLink size={14} />
          </a>

          <a
            className="btn btn-ghost"
            href={postUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            <ShieldCheck size={16} />
            Open Featured Post
            <ExternalLink size={14} />
          </a>

          <div className="telegram-check-list">
            {checks.map((item) => (
              <div className={`telegram-check ${item.done ? "done" : ""}`} key={item.label}>
                <span>{item.done ? "✓" : "○"}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="muted" style={{ marginBottom: 8 }}>
            Connect the Telegram account you used for the channel quest.
          </div>
          <div ref={widgetRef} />
          {!botUsername ? (
            <div className="notice" style={{ marginTop: 10 }}>
              Telegram login is not configured yet. The channel link still works, but verification requires the Telegram bot username.
            </div>
          ) : null}

          <button
            type="button"
            className="btn btn-success"
            style={{ marginTop: 10 }}
            disabled={verifying || !state.connected}
            onClick={() => void verify()}
          >
            {verifying ? "VERIFYING…" : "VERIFY JOIN + LIKE"}
          </button>

          <div className="muted" style={{ marginTop: 10, fontSize: 11 }}>
            Progress {progressText}
          </div>
          {state.message ? (
            <div className="notice" style={{ marginTop: 8 }}>
              {state.message}
            </div>
          ) : null}

          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 10 }}
            disabled={busy || Boolean(quest.claimed_at) || !claimReady}
            onClick={() => void onClaim(quest)}
          >
            {quest.claimed_at
              ? "CLAIMED ✓"
              : claimReady
                ? `CLAIM ${Number(quest.reward_diamond || 0)} 💎`
                : "COMPLETE QUEST FIRST"}
          </button>
        </div>
      </div>
    </section>
  );
}
