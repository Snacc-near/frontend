/**
 * Public pages (UI-148), readable while logged out:
 * - `/p/<accountId>`: the player's profile (when one exists in the profile database), their Snaccs
 *   read straight from contract views, achievements and feed streak; follow/unfollow when signed in.
 * - `/snacc/<id>`: one Snacc's on-chain SVG, owner (linked to `/p/<owner>`), status and vitality,
 *   with an "Open in game" link.
 * The title and meta description are set client-side. Without the Supabase env the chain parts
 * still render and the profile parts say they are off.
 */
import { useEffect, useState } from "react";
import { parsePublicPath, type PublicTarget } from "../route.ts";
import { SessionProvider, useAccount } from "../account/session.tsx";
import { achievementsOf, playerXpOf, profileByAccount, setFollow, streakOf, followeesOf } from "../account/api.ts";
import { ACHIEVEMENTS, type AchievementRow, type ProfileRow, type StreakRow } from "../account/model.ts";
import type { PlayerXpRow } from "../account/quests.ts";
import { profilePath, profileUrl, snaccPath } from "../account/config.ts";
import { usePublicClient } from "../hud/PlayerBoards.tsx";
import { LevelBadge } from "../hud/XpWidgets.tsx";
import { fetchCollection, healthOf, parseVessel, type CollectionItem } from "../data/collection.ts";
import { CONTRACT_ID, explorerAccount, viewCall } from "../data/nearView.ts";
import { safeNftMediaSrc } from "../landing/lib/live.ts";
import type { StrainDetail } from "../data/types.ts";
import { VITALITY_MAX } from "../config/constants.ts";
import { CopyButton } from "../ui/controls.tsx";
import { Chip, Icon, Win } from "../ui/fd.tsx";
import { DISCLAIMER } from "../legal/content.ts";
import "../ui/fd.css";
import "../legal/legal.css";
import "../account/account.css";
import "./public.css";

/** Sets the document title and the meta description (client-side; crawlers see index.html). */
export function setPageMeta(title: string, description: string): void {
  document.title = title;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "description";
    document.head.appendChild(meta);
  }
  meta.content = description;
}

const pct = (units: number) => `${Math.round((Math.max(0, units) / VITALITY_MAX) * 100)}%`;

function Header() {
  return (
    <header className="lg-header">
      <div className="lg-header__inner">
        <a className="lg-brand" href="/" aria-label="Snacc, home">
          <img src="/brand/snacc-logo.webp" alt="Snacc" width={1200} height={403} decoding="async" />
        </a>
        <nav className="lg-nav" aria-label="Primary">
          <a className="lg-nav__link" href="/">
            Home
          </a>
          <a className="fd-btn fd-btn--primary fd-btn--sm" href="/app">
            Launch app
          </a>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="lg-foot">
      <nav className="lg-foot__nav" aria-label="Legal">
        <a href="/">Home</a>
        <a href="/app">Game</a>
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
      </nav>
      <p className="lg-foot__note">{DISCLAIMER}</p>
    </footer>
  );
}

// ------------------------------------------------------------------ /p/<account>

function FollowButton({ target }: { target: ProfileRow }) {
  const account = useAccount();
  const [on, setOn] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const me = account.status === "signed-in" ? account.userId : null;
  const client = account.client;
  useEffect(() => {
    if (!client || !me) return;
    let alive = true;
    void followeesOf(client, me).then((ids) => alive && setOn(ids.includes(target.user_id)));
    return () => {
      alive = false;
    };
  }, [client, me, target.user_id]);
  if (!account.enabled) return null;
  if (!me || !client) {
    return <p className="pub-note">Sign in to the profile from the game to follow this player.</p>;
  }
  if (me === target.user_id) return <p className="pub-note">This is your profile.</p>;
  const toggle = async () => {
    const next = !on;
    const err = await setFollow(client, me, target.user_id, next);
    if (err) setMsg(`Not saved: ${err}`);
    else {
      setOn(next);
      setMsg(null);
    }
  };
  return (
    <span className="pub-row">
      <button type="button" className={on ? "fd-btn fd-btn--sm" : "fd-btn fd-btn--primary fd-btn--sm"} onClick={() => void toggle()} disabled={on === null} data-testid="follow-toggle">
        {on ? "Unfollow" : "Follow"}
      </button>
      {msg ? <span className="pub-note pub-note--bad">{msg}</span> : null}
    </span>
  );
}

function ProfileView({ accountId }: { accountId: string }) {
  const account = useAccount();
  const client = usePublicClient(true);
  const [profile, setProfile] = useState<ProfileRow | null | "loading">(account.enabled ? "loading" : null);
  const [badges, setBadges] = useState<AchievementRow[]>([]);
  const [streak, setStreak] = useState<StreakRow | null>(null);
  const [xp, setXp] = useState<PlayerXpRow | null>(null);
  const [items, setItems] = useState<CollectionItem[] | "loading" | string>("loading");

  useEffect(() => {
    const ac = new AbortController();
    void fetchCollection(accountId, ac.signal).then((r) => {
      if (!ac.signal.aborted) setItems(r.kind === "ok" ? r.data.items : r.message);
    });
    return () => ac.abort();
  }, [accountId]);

  useEffect(() => {
    if (!client) return;
    let alive = true;
    void profileByAccount(client, accountId)
      .then(async (p) => {
        if (!alive) return;
        setProfile(p);
        const [b, s, x] = await Promise.all([
          p ? achievementsOf(client, p.user_id).catch(() => []) : Promise.resolve([]),
          streakOf(client, p ? { userId: p.user_id } : { accountId }).catch(() => null),
          playerXpOf(client, { accountId }).catch(() => null),
        ]);
        if (!alive) return;
        setBadges(b);
        setStreak(s);
        setXp(x);
      })
      .catch(() => alive && setProfile(null));
    return () => {
      alive = false;
    };
  }, [client, accountId]);

  const name = profile && profile !== "loading" && profile.username ? profile.username : accountId;
  const count = Array.isArray(items) ? items.length : null;
  useEffect(() => {
    setPageMeta(
      `${name} · Snacc player profile`,
      `${name} on Snacc, the on-chain economic game on NEAR testnet${count !== null ? `: ${count} Snacc${count === 1 ? "" : "s"} on chain` : ""}.`,
    );
  }, [name, count]);

  const p = profile === "loading" ? null : profile;
  const avatar = p && Array.isArray(items) ? items.find((i) => i.strainId === p.avatar_strain_id) : undefined;
  const earned = ACHIEVEMENTS.filter((a) => badges.some((b) => b.code === a.code));

  return (
    <div className="lg-stack">
      <Win title={`p/${accountId}`} className="lg-doc">
        <div className="lg-stack" data-testid="public-profile">
          <div className="pub-head">
            {avatar?.mediaSrc ? (
              <img className="acct-avatar" src={avatar.mediaSrc} alt={`avatar: on-chain svg of strain ${avatar.strainId}`} />
            ) : (
              <span className="acct-avatar acct-avatar--none" role="img" aria-label="no avatar">
                no avatar
              </span>
            )}
            <div className="lg-stack pub-head__text">
              <h1 className="lg-title">{name}</h1>
              <p className="lg-meta">
                <a className="fd-a" href={explorerAccount(accountId)} target="_blank" rel="noopener noreferrer">
                  {accountId} <Icon name="ext" />
                </a>
              </p>
              {p?.bio ? <p className="pub-bio">{p.bio}</p> : null}
              <span className="pub-row">
                <CopyButton label="Copy profile link" text={profileUrl(accountId)} />
                {p ? <FollowButton target={p} /> : null}
              </span>
            </div>
          </div>

          {!account.enabled ? (
            <p className="pub-note">Player profiles are not switched on for this site. The Snaccs below come straight from the contract.</p>
          ) : profile === "loading" ? (
            <p className="pub-note">reading the profile…</p>
          ) : !p ? (
            <p className="pub-note">This account has no Snacc profile yet. The Snaccs below come straight from the contract.</p>
          ) : null}

          {account.enabled && p ? (
            <section className="lg-stack" aria-labelledby="pub-ach">
              <h2 id="pub-ach" className="lg-h2">
                Streak and achievements
              </h2>
              <p data-testid="public-level">
                <LevelBadge level={xp?.level ?? 1} /> <strong>{(xp?.total_xp ?? 0).toLocaleString("en-US")}</strong> XP (cosmetic, off-chain)
              </p>
              <p data-testid="public-streak">
                Feed streak: <strong>{streak?.current_streak_days ?? 0}</strong> day{(streak?.current_streak_days ?? 0) === 1 ? "" : "s"} in a row
              </p>
              {earned.length === 0 ? (
                <p className="pub-note">No achievements yet.</p>
              ) : (
                <ul className="acct-badges" data-testid="public-achievements">
                  {earned.map((a) => (
                    <li key={a.code} className="acct-badge" data-earned="">
                      <span className="acct-badge__name">{a.name}</span>
                      <span className="acct-badge__how">{a.how}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          <section className="lg-stack" aria-labelledby="pub-coll">
            <h2 id="pub-coll" className="lg-h2">
              Snaccs{count !== null ? ` · ${count}` : ""}
            </h2>
            {items === "loading" ? (
              <p className="pub-note">reading nft_tokens_for_owner and get_colony on {CONTRACT_ID}…</p>
            ) : typeof items === "string" ? (
              <p className="pub-note pub-note--bad">{items}</p>
            ) : items.length === 0 ? (
              <p className="pub-note">This account owns no Snaccs.</p>
            ) : (
              <ul className="pub-grid" data-testid="public-collection">
                {items.map((i) => (
                  <li key={i.strainId}>
                    <a className="pub-card" href={snaccPath(i.strainId)}>
                      {i.mediaSrc ? <img src={i.mediaSrc} alt={`on-chain svg of strain ${i.strainId}`} loading="lazy" /> : <span className="pub-card__none">no svg</span>}
                      <span className="pub-card__id">#{i.strainId}</span>
                      <span className="pub-card__meta">
                        {i.health} · {pct(i.effectiveVitality)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="pub-note">Read-only, from contract views on {CONTRACT_ID} (NEAR testnet).</p>
          </section>
        </div>
      </Win>
    </div>
  );
}

// ------------------------------------------------------------------ /snacc/<id>

interface SnaccData {
  owner: string | null;
  media: string | null;
  vessel: StrainDetail | null;
}

function SnaccView({ strainId }: { strainId: number }) {
  const [data, setData] = useState<SnaccData | "loading" | "missing">("loading");
  useEffect(() => {
    const ac = new AbortController();
    void Promise.all([
      viewCall<{ owner_id?: unknown; metadata?: { media?: unknown } } | null>("nft_token", { token_id: String(strainId) }, ac.signal),
      viewCall<unknown>("get_strain", { strain_id: strainId }, ac.signal),
    ]).then(([tok, raw]) => {
      if (ac.signal.aborted) return;
      const vessel = parseVessel(raw);
      const owner = typeof tok?.owner_id === "string" ? tok.owner_id : (vessel?.owner_id ?? null);
      const media = typeof tok?.metadata?.media === "string" ? safeNftMediaSrc(tok.metadata.media) : null;
      setData(!tok && !vessel ? "missing" : { owner, media, vessel });
    });
    return () => ac.abort();
  }, [strainId]);

  useEffect(() => {
    if (data === "loading") return;
    const status = data === "missing" ? "not found" : (data.vessel?.status ?? "unknown status");
    setPageMeta(
      `Snacc #${strainId} · Snacc`,
      data === "missing"
        ? `Snacc #${strainId} was not found on ${CONTRACT_ID} (NEAR testnet).`
        : `Snacc #${strainId} on NEAR testnet: ${status}${data.owner ? `, owned by ${data.owner}` : ""}.`,
    );
  }, [data, strainId]);

  const v = data !== "loading" && data !== "missing" ? data.vessel : null;
  return (
    <Win title={`snacc/${strainId}`} className="lg-doc">
      <div className="lg-stack" data-testid="public-snacc">
        <h1 className="lg-title">Snacc #{strainId}</h1>
        {data === "loading" ? (
          <p className="pub-note">reading nft_token and get_strain on {CONTRACT_ID}…</p>
        ) : data === "missing" ? (
          <p className="pub-note pub-note--bad">No Snacc #{strainId} on {CONTRACT_ID}, or the testnet RPC did not answer.</p>
        ) : (
          <div className="pub-head">
            {data.media ? (
              <img className="pub-svg" src={data.media} alt={`on-chain svg of strain ${strainId}`} />
            ) : (
              <span className="pub-svg acct-avatar--none" role="img" aria-label="no valid on-chain svg">
                no svg
              </span>
            )}
            <dl className="fd-kv pub-kv">
              <div className="fd-kv__row">
                <dt>owner</dt>
                <dd>{data.owner ? <a className="fd-a" href={profilePath(data.owner)}>{data.owner}</a> : "—"}</dd>
              </div>
              <div className="fd-kv__row">
                <dt>status</dt>
                <dd>
                  {v ? (
                    <>
                      {v.status} <Chip dot={healthOf(v.status, v.effective_vitality) === "healthy" ? "live" : "off"}>{healthOf(v.status, v.effective_vitality)}</Chip>
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="fd-kv__row">
                <dt>vitality</dt>
                <dd className="fd-kv__num">{v ? `${pct(v.effective_vitality)} effective · ${pct(v.vitality)} stored` : "—"}</dd>
              </div>
              <div className="fd-kv__row">
                <dt>generation</dt>
                <dd className="fd-kv__num">{v ? v.generation : "—"}</dd>
              </div>
            </dl>
          </div>
        )}
        <span className="pub-row">
          <a className="fd-btn fd-btn--primary fd-btn--sm" href={`/app?strain=${strainId}`} data-testid="open-in-game">
            Open in game
          </a>
          <CopyButton label="Copy link" text={`${window.location.origin}${snaccPath(strainId)}`} />
        </span>
        <p className="pub-note">Read-only, from contract views on {CONTRACT_ID} (NEAR testnet). $SNACC on testnet has no monetary value.</p>
      </div>
    </Win>
  );
}

export function PublicBody({ target }: { target: PublicTarget }) {
  return target.kind === "profile" ? <ProfileView accountId={target.accountId} /> : <SnaccView strainId={target.strainId} />;
}

export default function PublicPage() {
  const target = parsePublicPath(window.location.pathname);
  return (
    <SessionProvider>
      <div className="lg-page fd-ui">
        <Header />
        <main className="lg-main">{target ? <PublicBody target={target} /> : <p className="pub-note">Page not found.</p>}</main>
        <Footer />
      </div>
    </SessionProvider>
  );
}
