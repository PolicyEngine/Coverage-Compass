'use client';

import Script from 'next/script';
import { GA_MEASUREMENT_ID, TOOL_NAME } from '@/lib/gtag';

export default function GoogleAnalytics() {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
            tool_name: '${TOOL_NAME}',
          });
        `}
      </Script>
      <Script id="gtag-engagement" strategy="afterInteractive">
        {`
          (function() {
            var TOOL_NAME = '${TOOL_NAME}';
            var scrollMarks = { 25: false, 50: false, 75: false, 100: false };
            window.addEventListener('scroll', function() {
              var h = document.documentElement;
              var pct = Math.round((h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100);
              [25, 50, 75, 100].forEach(function(m) {
                if (pct >= m && !scrollMarks[m]) {
                  scrollMarks[m] = true;
                  window.gtag('event', 'scroll_depth', { percent: m, tool_name: TOOL_NAME });
                }
              });
            });
            var timeMarks = [30, 60, 120, 300];
            var start = Date.now();
            (function tick() {
              var sec = Math.floor((Date.now() - start) / 1000);
              for (var i = 0; i < timeMarks.length; i++) {
                if (sec >= timeMarks[i]) {
                  window.gtag('event', 'time_on_tool', { seconds: timeMarks[i], tool_name: TOOL_NAME });
                  timeMarks.splice(i, 1);
                  i--;
                }
              }
              if (timeMarks.length > 0) setTimeout(tick, 5000);
            })();
            document.addEventListener('click', function(e) {
              var link = e.target.closest('a[href]');
              if (!link) return;
              try {
                var url = new URL(link.href);
                if (url.hostname !== window.location.hostname) {
                  window.gtag('event', 'outbound_click', {
                    url: link.href,
                    target_hostname: url.hostname,
                    tool_name: TOOL_NAME,
                  });
                }
              } catch(err) {}
            });
          })();
        `}
      </Script>
    </>
  );
}
