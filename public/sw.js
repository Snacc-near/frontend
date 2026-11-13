/*
 * Snacc service worker (UI-160): Web Push only. It shows a notification when a push arrives and focuses or opens
 * Snacc when the notification is clicked. No fetch handler, no cache: the app is not an offline app.
 *
 * Registered by the app only after the player turns on "Push to this device" (src/push/client.ts).
 * This is a classic-script copy of src/push/swLogic.ts (a worker needs a stable, un-hashed URL and the project has
 * no worker build step); test/ui-160-push.test.ts runs both against the same events and fails if they drift.
 */
"use strict";

var DEFAULT_URL = "/app";
var NOTIFICATION_ICON = "/brand/snacc-app-icon-192.png";
var GENERIC_TITLE = "Snacc";
var GENERIC_BODY = "Open Snacc to see what changed.";
var MAX_TITLE = 120;
var MAX_BODY = 300;
var MAX_URL = 300;

function safeUrl(raw, origin) {
  if (typeof raw !== "string" || raw === "" || raw.length > MAX_URL) return DEFAULT_URL;
  try {
    var u = new URL(raw, origin);
    if (u.origin !== origin) return DEFAULT_URL;
    return u.pathname + u.search + u.hash;
  } catch (e) {
    return DEFAULT_URL;
  }
}

function parsePushPayload(text, origin) {
  var o = {};
  try {
    var v = text ? JSON.parse(text) : null;
    if (v && typeof v === "object" && !Array.isArray(v)) o = v;
  } catch (e) {
    o = {};
  }
  function str(x, max) {
    return typeof x === "string" ? x.trim().slice(0, max) : "";
  }
  return {
    title: str(o.title, MAX_TITLE) || GENERIC_TITLE,
    body: str(o.body, MAX_BODY) || (str(o.title, MAX_TITLE) ? "" : GENERIC_BODY),
    url: safeUrl(o.url, origin),
    tag: str(o.tag, 80) || "snacc",
  };
}

function notificationOptions(p) {
  return { body: p.body, icon: NOTIFICATION_ICON, tag: p.tag, data: { url: p.url } };
}

function onPush(event, scope) {
  var text = null;
  try {
    text = event.data ? event.data.text() : null;
  } catch (e) {
    text = null;
  }
  var p = parsePushPayload(text, scope.location.origin);
  event.waitUntil(Promise.resolve(scope.registration.showNotification(p.title, notificationOptions(p))));
}

function sameOrigin(url, origin) {
  try {
    return new URL(url).origin === origin;
  } catch (e) {
    return false;
  }
}

function pickClient(clients, origin) {
  var ours = clients.filter(function (c) {
    return sameOrigin(c.url, origin);
  });
  return (
    ours.find(function (c) {
      return c.focused;
    }) ||
    ours.find(function (c) {
      return c.visibilityState === "visible";
    }) ||
    ours[0] ||
    null
  );
}

function focusOrOpen(scope, target) {
  var origin = scope.location.origin;
  var href = new URL(target, origin).href;
  return scope.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clients) {
    var client = pickClient(clients, origin);
    var open = function () {
      return Promise.resolve(scope.clients.openWindow(href)).then(function () {
        return "opened";
      });
    };
    if (!client) return open();
    return Promise.resolve()
      .then(function () {
        return client.focus ? client.focus() : undefined;
      })
      .then(function () {
        return client.navigate && client.url !== href ? client.navigate(href) : undefined;
      })
      .then(
        function () {
          return "focused";
        },
        function () {
          return open();
        },
      );
  });
}

function onNotificationClick(event, scope) {
  event.notification.close();
  var data = event.notification.data;
  var target = safeUrl(data && data.url, scope.location.origin);
  event.waitUntil(
    focusOrOpen(scope, target).catch(function () {
      return undefined;
    }),
  );
}

self.addEventListener("install", function () {
  self.skipWaiting();
});
self.addEventListener("activate", function (event) {
  event.waitUntil(Promise.resolve(self.clients.claim()));
});
self.addEventListener("push", function (event) {
  onPush(event, self);
});
self.addEventListener("notificationclick", function (event) {
  onNotificationClick(event, self);
});
