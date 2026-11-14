/**
 * "Push to this device" (UI-161 phase B5): the toggle in the notification settings, its state lines, the privacy note,
 * and the messages the push client returns. `push/PushToggle.tsx` keeps `PUSH_TEXT` and `PUSH_PRIVACY` as the
 * English record (tests compare against them); the screen reads these keys.
 */
const push = {
  title: "Push to this device",
  turnOff: "turn off push to this device",
  turnOn: "turn on push to this device",
  state: {
    checking: "Checking this device…",
    off: "Off. Turn it on to get a notification on this device even when Snacc is closed. The browser asks for permission first.",
    on: "On for this device. Alerts about hungry Snaccs, lost Snaccs and announcements arrive even when Snacc is closed.",
    blocked: "The browser blocks notifications for this site. Allow them in the site settings, then come back here to turn push on.",
    unsupported: "This browser cannot receive push notifications.",
    needsInstall:
      "On iPhone and iPad, push works only for the installed app (iOS 16.4 or later): open the Share menu, choose Add to Home Screen, then open Snacc from the home screen and turn push on there.",
  },
  privacy:
    "What is sent: only the notification text, for example “Snacc #7 is starving”, encrypted end to end and delivered through your browser's push service (Google, Mozilla or Apple). Snacc keeps this device's push address with your profile, never a wallet key. Delivery is best effort and can lag by a minute. Turning it off or signing out removes this device.",
  messages: {
    generic: "Something went wrong. Try again.",
    serviceDown: "The browser could not reach its push service. Check the connection and try again.",
    notAllowed: "Notifications were not allowed, so push stays off.",
    noKey: "The server did not return a push key. Try again later.",
    offlineOff: "Turned off on this device. The server could not be reached, so it will drop this device on its own.",
    cannotTurnOff: "The browser could not turn push off. Try again.",
    signIn: "Sign in to the profile to use push notifications.",
  },
};

export default push;
