module.exports = function parseUserAgent(ua = "") {
  let browser = /chrome/i.test(ua) ? "Chrome"
    : /firefox/i.test(ua) ? "Firefox"
    : /safari/i.test(ua) ? "Safari"
    : "Unknown";

  let os = /windows/i.test(ua) ? "Windows"
    : /mac/i.test(ua) ? "MacOS"
    : /linux/i.test(ua) ? "Linux"
    : /android/i.test(ua) ? "Android"
    : /ios|iphone|ipad/i.test(ua) ? "iOS"
    : "Unknown";

  let device_type = /mobile/i.test(ua)
    ? "Mobile"
    : /tablet/i.test(ua)
    ? "Tablet"
    : "Desktop";

  return { browser, os, device_type };
};
