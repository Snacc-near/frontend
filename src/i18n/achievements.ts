/**
 * Achievement and account-form texts in the reader's language (UI-161). `ACHIEVEMENTS` and the
 * `usernameProblem` / `bioProblem` helpers in `account/model.ts` keep their English text for tests and
 * other callers; the profile window reads these.
 */
import type { Translate } from "./catalog.ts";
import { en } from "./messages/en/index.ts";

type AchievementCode = keyof typeof en.social.achievements;

/** `name` or `how` of an achievement; an unknown code keeps the text the database or the model gave. */
export function achievementText(t: Translate, code: string, field: "name" | "how", fallback: string): string {
  return code in en.social.achievements ? t(`social.achievements.${code as AchievementCode}.${field}`) : fallback;
}

const USERNAME_PROBLEMS: Readonly<Record<string, "usernameEmpty" | "usernameShort" | "usernameLong" | "usernameChars">> = {
  "Pick a username.": "usernameEmpty",
  "At least 3 characters.": "usernameShort",
  "At most 20 characters.": "usernameLong",
  "Use only lowercase letters, digits and _.": "usernameChars",
};

/** The translated form of a `usernameProblem` result; anything unknown is shown as it came. */
export function usernameProblemText(t: Translate, problem: string | null): string | null {
  if (problem === null) return null;
  const key = USERNAME_PROBLEMS[problem];
  return key ? t(`social.profile.${key}`) : problem;
}
