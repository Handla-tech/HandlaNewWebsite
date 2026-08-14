/*!
 * Handla Analytics — self-hosted, privacy-friendly tracker (<3kb).
 *
 * Usage (add once, ideally in the marketing site <head> or before </body>):
 *   <script defer src="/analytics.js"
 *           data-endpoint="https://api.example.com/api/analytics/collect"
 *           data-site="handla"></script>
 *
 * If data-endpoint is omitted it defaults to `${origin}/api/analytics/collect`.
 * The script auto-tracks pageviews (initial load + SPA route changes) and
 * exposes a global `handla('event', name, meta)` for custom events / CTAs.
 *
 * No cookies with PII: a single first-party anon id (rotating server-side hash
 * is what actually identifies a visitor; this cookie only stabilises the client
 * across a session for referrer/first-page context). Honours Do-Not-Track.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Respect Do-Not-Track.
  var dnt =
    navigator.doNotTrack === '1' ||
    window.doNotTrack === '1' ||
    navigator.msDoNotTrack === '1';
  if (dnt) {
    window.handla = function () {};
    return;
  }

  var script =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName('script');
      return s[s.length - 1];
    })();

  var ds = (script && script.dataset) || {};
  var ENDPOINT =
    ds.endpoint ||
    (window.location.origin + '/api/analytics/collect');
  var SITE = ds.site || 'handla';

  // ── Anon client id (first-party, 1y) — used only for session/referrer context.
  var COOKIE = 'ha_vid';
  function getCookie(name) {
    var m = document.cookie.match(
      new RegExp('(?:^|; )' + name + '=([^;]*)'),
    );
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 864e5);
    document.cookie =
      name +
      '=' +
      encodeURIComponent(value) +
      '; expires=' +
      d.toUTCString() +
      '; path=/; SameSite=Lax';
  }
  function uuid() {
    if (window.crypto && window.crypto.randomUUID) {
      try { return window.crypto.randomUUID(); } catch (e) {}
    }
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  var vid = getCookie(COOKIE);
  if (!vid) {
    vid = uuid();
    setCookie(COOKIE, vid, 365);
  }

  // ── Beacon sender (sendBeacon → fetch keepalive → GET pixel fallback).
  function send(payload) {
    payload.site = payload.site || SITE;
    payload.vid = vid;
    var body = JSON.stringify(payload);

    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(ENDPOINT, blob)) return;
      }
    } catch (e) {}

    try {
      if (window.fetch) {
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true,
          credentials: 'omit',
          mode: 'cors',
        }).catch(function () { pixel(payload); });
        return;
      }
    } catch (e) {}

    pixel(payload);
  }

  function pixel(payload) {
    try {
      var q = [];
      for (var k in payload) {
        if (Object.prototype.hasOwnProperty.call(payload, k) && payload[k] != null) {
          var v = payload[k];
          if (typeof v === 'object') v = JSON.stringify(v);
          q.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
        }
      }
      var img = new Image();
      img.src = ENDPOINT + '?' + q.join('&');
    } catch (e) {}
  }

  // ── Track a pageview.
  var lastPath = null;
  function pageview() {
    var path = window.location.pathname + window.location.search;
    if (path === lastPath) return; // de-dupe SPA re-renders
    lastPath = path;
    send({
      type: 'PAGEVIEW',
      url: window.location.href,
      referrer: document.referrer || '',
      title: document.title || '',
      language: navigator.language || '',
      screenWidth: window.screen && window.screen.width,
    });
  }

  // ── Public API: handla('event', name, meta) or handla('pageview').
  var queue = window.handla && window.handla.q ? window.handla.q : [];
  function handla() {
    var args = Array.prototype.slice.call(arguments);
    var cmd = args[0];
    if (cmd === 'event') {
      send({
        type: 'EVENT',
        eventName: String(args[1] || 'event').slice(0, 120),
        url: window.location.href,
        title: document.title || '',
        language: navigator.language || '',
        meta: args[2] && typeof args[2] === 'object' ? args[2] : undefined,
      });
    } else if (cmd === 'pageview') {
      lastPath = null;
      pageview();
    }
  }
  window.handla = handla;
  // Flush any calls queued before the script loaded.
  for (var i = 0; i < queue.length; i++) {
    try { handla.apply(null, queue[i]); } catch (e) {}
  }

  // ── SPA route-change detection (History API + popstate).
  function hook(type) {
    var orig = history[type];
    if (typeof orig !== 'function') return;
    history[type] = function () {
      var rv = orig.apply(this, arguments);
      // Defer so the framework updates document.title/URL first.
      setTimeout(pageview, 0);
      return rv;
    };
  }
  hook('pushState');
  hook('replaceState');
  window.addEventListener('popstate', function () { setTimeout(pageview, 0); });

  // Initial pageview once DOM is interactive.
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    pageview();
  } else {
    document.addEventListener('DOMContentLoaded', pageview);
  }
})();
