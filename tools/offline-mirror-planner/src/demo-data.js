/* GENERATED - do not edit; run npm run build:demo
 * Source: demo/site/** and demo/sample-destinations.json
 * Builder: scripts/build-demo-data.js (--check verifies this file is current)
 * Content is synthetic. Decoy files are included on purpose so the planner
 * can show that it excludes them. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.OMP = root.OMP || {};
    root.OMP.demoData = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
    siteLabel: 'lantern-field-notes',
    description: 'Lantern Field Notes: a small synthetic static site (invented content, example.* domains only) with decoy files the planner must exclude, plus sample user-declared destinations.',
    files: [
      { path: '.DS_Store', base64: 'REVNTyBERUNPWSAtIG5vdCBhIHJlYWwgc2VjcmV0LiBQbGFubmVyIG11c3QgZXhjbHVkZSB0aGlzIGZpbGUuCihTdGFuZC1pbiBmb3IgbWFjT1MgZm9sZGVyIG1ldGFkYXRhLiBQbGFpbiB0ZXh0LCBub3QgYSByZWFsIC5EU19TdG9yZS4pCg==' },
      { path: '.env', base64: 'IyBERU1PIERFQ09ZIC0gbm90IGEgcmVhbCBzZWNyZXQuIFBsYW5uZXIgbXVzdCBleGNsdWRlIHRoaXMgZmlsZS4KREVNT19GQUtFX1ZBTFVFPW5vdC1hLXJlYWwtc2VjcmV0Cg==' },
      { path: '.well-known/security.txt', base64: 'IyBTeW50aGV0aWMgZGVtbyBmaWxlIGZvciB0aGUgT2ZmbGluZSBNaXJyb3IgUGxhbm5lci4KQ29udGFjdDogbWFpbHRvOnNlY3VyaXR5QGV4YW1wbGUub3JnCkV4cGlyZXM6IDIwMjctMDYtMzBUMjM6NTk6NTlaClByZWZlcnJlZC1MYW5ndWFnZXM6IGVuCkNhbm9uaWNhbDogaHR0cHM6Ly9ub3Rlcy5leGFtcGxlLm9yZy8ud2VsbC1rbm93bi9zZWN1cml0eS50eHQK' },
      { path: '404.html', base64: 'PCFkb2N0eXBlIGh0bWw+CjxodG1sIGxhbmc9ImVuIj4KPGhlYWQ+CiAgPG1ldGEgY2hhcnNldD0idXRmLTgiPgogIDxtZXRhIG5hbWU9InZpZXdwb3J0IiBjb250ZW50PSJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MSI+CiAgPHRpdGxlPlBhZ2Ugbm90IGZvdW5kIC0gTGFudGVybiBGaWVsZCBOb3RlczwvdGl0bGU+CiAgPGxpbmsgcmVsPSJzdHlsZXNoZWV0IiBocmVmPSIvYXNzZXRzL2Nzcy9zaXRlLmNzcyI+CjwvaGVhZD4KPGJvZHk+CiAgPG1haW4gY2xhc3M9Im5vdC1mb3VuZCI+CiAgICA8aDE+VGhpcyBwYWdlIHdhbmRlcmVkIG9mZjwvaDE+CiAgICA8cD5UaGUgbGFudGVybiBsaWdodCBkb2VzIG5vdCByZWFjaCB0aGlzIGZhci4gVGhlIHBhZ2UgeW91IGFza2VkIGZvciBpcyBub3QgaW4gdGhlIG5vdGVib29rLjwvcD4KICAgIDxwPjxhIGhyZWY9Ii8iPkJhY2sgdG8gdGhlIGZyb250IHBhZ2U8L2E+PC9wPgogIDwvbWFpbj4KPC9ib2R5Pgo8L2h0bWw+Cg==' },
      { path: 'about/index.html', base64: 'PCFkb2N0eXBlIGh0bWw+CjxodG1sIGxhbmc9ImVuIj4KPGhlYWQ+CiAgPG1ldGEgY2hhcnNldD0idXRmLTgiPgogIDxtZXRhIG5hbWU9InZpZXdwb3J0IiBjb250ZW50PSJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MSI+CiAgPHRpdGxlPkFib3V0IC0gTGFudGVybiBGaWVsZCBOb3RlczwvdGl0bGU+CiAgPGxpbmsgcmVsPSJzdHlsZXNoZWV0IiBocmVmPSIuLi9hc3NldHMvY3NzL3NpdGUuY3NzIj4KICA8c2NyaXB0IHNyYz0iLi4vYXNzZXRzL2pzL3RoZW1lLmpzIiBkZWZlcj48L3NjcmlwdD4KPC9oZWFkPgo8Ym9keT4KICA8aGVhZGVyIGNsYXNzPSJzaXRlLWhlYWRlciI+CiAgICA8YSBjbGFzcz0iYnJhbmQiIGhyZWY9Ii4uLyI+PGltZyBzcmM9Ii9hc3NldHMvaW1nL2xhbnRlcm4uc3ZnIiBhbHQ9IiIgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIj4gTGFudGVybiBGaWVsZCBOb3RlczwvYT4KICAgIDxuYXY+CiAgICAgIDxhIGhyZWY9Ii4uL25vdGVzLyI+Tm90ZXM8L2E+CiAgICAgIDxhIGhyZWY9Ii4vIj5BYm91dDwvYT4KICAgICAgPGJ1dHRvbiB0eXBlPSJidXR0b24iIGNsYXNzPSJ0aGVtZS10b2dnbGUiIGRhdGEtdGhlbWUtdG9nZ2xlPlRvZ2dsZSB0aGVtZTwvYnV0dG9uPgogICAgPC9uYXY+CiAgPC9oZWFkZXI+CgogIDxtYWluPgogICAgPGgxPkFib3V0IHRoZSBub3RlYm9vazwvaDE+CiAgICA8cD4KICAgICAgTGFudGVybiBGaWVsZCBOb3RlcyBpcyBhIGZpY3Rpb25hbCBjb21tdW5pdHkgbm90ZWJvb2suIFRoZSB3YWxrZXJzLCB0aGUKICAgICAgbWVhZG93IGFuZCB0aGUgcml2ZXIgaW4gdGhlc2UgcGFnZXMgZG8gbm90IGV4aXN0LiBUaGUgc2l0ZSB3YXMgd3JpdHRlbgogICAgICB0byBnaXZlIHRoZSBPZmZsaW5lIE1pcnJvciBQbGFubmVyIHNvbWV0aGluZyByZWFsaXN0aWMgdG8gaW52ZW50b3J5OgogICAgICBuZXN0ZWQgZm9sZGVycywgYSBzdHlsZXNoZWV0LCBhIHNjcmlwdCwgaW1hZ2VzLCBhIHRleHQgZG93bmxvYWQgYW5kIGEKICAgICAgZmV3IGZpbGVzIHRoYXQgc2hvdWxkIG5ldmVyIGJlIG1pcnJvcmVkLgogICAgPC9wPgogICAgPGgyPkhvdXNlIHJ1bGVzPC9oMj4KICAgIDx1bD4KICAgICAgPGxpPk5vIG5hbWVzLiBFbnRyaWVzIGFyZSBzaWduZWQgd2l0aCBhIGxhbnRlcm4gY29sb3VyLCBpZiBhdCBhbGwuPC9saT4KICAgICAgPGxpPk5vIGV4YWN0IGxvY2F0aW9ucy4gIk5lYXIgdGhlIG9sZCBmZW5jZSIgaXMgcGxlbnR5LjwvbGk+CiAgICAgIDxsaT5TaG9ydCBpcyBiZXR0ZXIgdGhhbiBjb21wbGV0ZS48L2xpPgogICAgPC91bD4KICAgIDxwPlF1ZXN0aW9ucyBhYm91dCB0aGlzIGRlbW8gZ28gdG8gPGEgaHJlZj0ibWFpbHRvOm5vdGVzQGV4YW1wbGUub3JnIj5ub3Rlc0BleGFtcGxlLm9yZzwvYT4uPC9wPgogIDwvbWFpbj4KCiAgPGZvb3RlciBjbGFzcz0ic2l0ZS1mb290ZXIiPgogICAgPHA+PGEgaHJlZj0iLi4vIj5Gcm9udCBwYWdlPC9hPjwvcD4KICA8L2Zvb3Rlcj4KPC9ib2R5Pgo8L2h0bWw+Cg==' },
      { path: 'assets/css/site.css', base64: 'LyogTGFudGVybiBGaWVsZCBOb3RlcyAtIHN5bnRoZXRpYyBkZW1vIHN0eWxlc2hlZXQgKi8KOnJvb3QgewogIC0tYmc6ICNmYmY4ZjE7CiAgLS1mZzogIzIzMjAxYTsKICAtLW11dGVkOiAjNmI2NDU3OwogIC0tYWNjZW50OiAjYjU2NTFkOwogIC0tcnVsZTogI2U0ZGNjYjsKfQoKOnJvb3RbZGF0YS10aGVtZT0iZGFyayJdIHsKICAtLWJnOiAjMTYxNDBmOwogIC0tZmc6ICNlZmU5ZGM7CiAgLS1tdXRlZDogI2E5OWY4YzsKICAtLWFjY2VudDogI2YwYTA1MDsKICAtLXJ1bGU6ICMzYTM1MmI7Cn0KCiogeyBib3gtc2l6aW5nOiBib3JkZXItYm94OyB9Cgpib2R5IHsKICBtYXJnaW46IDA7CiAgYmFja2dyb3VuZDogdmFyKC0tYmcpOwogIGNvbG9yOiB2YXIoLS1mZyk7CiAgZm9udDogMTdweC8xLjYgR2VvcmdpYSwgIlRpbWVzIE5ldyBSb21hbiIsIHNlcmlmOwp9CgphIHsgY29sb3I6IHZhcigtLWFjY2VudCk7IH0KCi5zaXRlLWhlYWRlciwKLnNpdGUtZm9vdGVyLAptYWluIHsKICBtYXgtd2lkdGg6IDQycmVtOwogIG1hcmdpbjogMCBhdXRvOwogIHBhZGRpbmc6IDFyZW07Cn0KCi5zaXRlLWhlYWRlciB7CiAgZGlzcGxheTogZmxleDsKICBmbGV4LXdyYXA6IHdyYXA7CiAgZ2FwOiAxcmVtOwogIGFsaWduLWl0ZW1zOiBjZW50ZXI7CiAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuOwogIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS1ydWxlKTsKfQoKLmJyYW5kIHsKICBkaXNwbGF5OiBpbmxpbmUtZmxleDsKICBnYXA6IDAuNXJlbTsKICBhbGlnbi1pdGVtczogY2VudGVyOwogIGZvbnQtd2VpZ2h0OiBib2xkOwogIHRleHQtZGVjb3JhdGlvbjogbm9uZTsKfQoKbmF2IHsgZGlzcGxheTogZmxleDsgZ2FwOiAxcmVtOyBhbGlnbi1pdGVtczogY2VudGVyOyB9CgoudGhlbWUtdG9nZ2xlIHsKICBmb250OiBpbmhlcml0OwogIGZvbnQtc2l6ZTogMC44NXJlbTsKICBiYWNrZ3JvdW5kOiBub25lOwogIGNvbG9yOiB2YXIoLS1mZyk7CiAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tcnVsZSk7CiAgYm9yZGVyLXJhZGl1czogNHB4OwogIHBhZGRpbmc6IDAuMnJlbSAwLjZyZW07CiAgY3Vyc29yOiBwb2ludGVyOwp9CgouaW50cm8gewogIHBhZGRpbmctbGVmdDogM3JlbTsKICAvKiBSb290LXJlbGF0aXZlIHJlZmVyZW5jZSBvbiBwdXJwb3NlOiBicmVha3MgdW5kZXIgYSBub24tcm9vdCBiYXNlIHBhdGguICovCiAgYmFja2dyb3VuZDogdXJsKC9hc3NldHMvaW1nL2xhbnRlcm4uc3ZnKSBuby1yZXBlYXQgbGVmdCAwLjRyZW0gLyAyLjJyZW07Cn0KCi5lbnRyeS1saXN0IHsgbGlzdC1zdHlsZTogbm9uZTsgcGFkZGluZzogMDsgfQouZW50cnktbGlzdCBsaSB7IHBhZGRpbmc6IDAuNXJlbSAwOyBib3JkZXItYm90dG9tOiAxcHggZGFzaGVkIHZhcigtLXJ1bGUpOyB9CgoubWV0YSB7IGRpc3BsYXk6IGJsb2NrOyBjb2xvcjogdmFyKC0tbXV0ZWQpOyBmb250LXNpemU6IDAuOXJlbTsgfQoKZmlndXJlIHsgbWFyZ2luOiAxLjVyZW0gMDsgfQpmaWdjYXB0aW9uIHsgY29sb3I6IHZhcigtLW11dGVkKTsgZm9udC1zaXplOiAwLjg1cmVtOyB9Cgouc2l0ZS1mb290ZXIgewogIGJvcmRlci10b3A6IDFweCBzb2xpZCB2YXIoLS1ydWxlKTsKICBjb2xvcjogdmFyKC0tbXV0ZWQpOwogIGZvbnQtc2l6ZTogMC45cmVtOwp9Cgoubm90LWZvdW5kIHsgdGV4dC1hbGlnbjogY2VudGVyOyBwYWRkaW5nLXRvcDogNHJlbTsgfQo=' },
      { path: 'assets/fonts/README.txt', base64: 'TGFudGVybiBGaWVsZCBOb3RlcyAtIGZvbnRzIGZvbGRlciAoc3ludGhldGljIGRlbW8pCgpObyBmb250IGZpbGVzIGFyZSBzaGlwcGVkIHdpdGggdGhpcyBkZW1vIHNpdGUuIFRoZSBzdHlsZXNoZWV0IHVzZXMgdGhlCnJlYWRlcidzIGluc3RhbGxlZCBzZXJpZiBmb250cyAoR2VvcmdpYSwgdGhlbiAiVGltZXMgTmV3IFJvbWFuIiwgdGhlbiB0aGUKYnJvd3NlciBkZWZhdWx0IHNlcmlmKS4KCklmIHlvdSBhZGQgd2ViIGZvbnRzIGhlcmUgbGF0ZXIsIGxpc3QgZWFjaCBmaWxlIGFuZCBpdHMgbGljZW5jZSBpbiB0aGlzClJFQURNRSBzbyBvcGVyYXRvcnMga25vdyB3aGF0IHRoZXkgYXJlIG1pcnJvcmluZy4K' },
      { path: 'assets/img/lantern.svg', base64: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiIgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByb2xlPSJpbWciIGFyaWEtbGFiZWw9IkxhbnRlcm4iPgogIDx0aXRsZT5MYW50ZXJuPC90aXRsZT4KICA8cGF0aCBkPSJNMTIgNGg4TTE2IDR2MyIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNmI0YTFmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxyZWN0IHg9IjkiIHk9IjciIHdpZHRoPSIxNCIgaGVpZ2h0PSI0IiByeD0iMSIgZmlsbD0iIzZiNGExZiIvPgogIDxyZWN0IHg9IjEwIiB5PSIxMSIgd2lkdGg9IjEyIiBoZWlnaHQ9IjE0IiByeD0iMiIgZmlsbD0iI2Y2Yzc2YiIgc3Ryb2tlPSIjNmI0YTFmIiBzdHJva2Utd2lkdGg9IjIiLz4KICA8cGF0aCBkPSJNMTYgMTVjLTIgMi41LTIgNSAwIDYuNWMyLTEuNSAyLTQgMC02LjV6IiBmaWxsPSIjZTA3ODJhIi8+CiAgPHJlY3QgeD0iOSIgeT0iMjUiIHdpZHRoPSIxNCIgaGVpZ2h0PSIzIiByeD0iMSIgZmlsbD0iIzZiNGExZiIvPgo8L3N2Zz4K' },
      { path: 'assets/img/pixel.png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4djz7PwAIBwMowsvirwAAAABJRU5ErkJggg==' },
      { path: 'assets/js/theme.js', base64: 'LyogTGFudGVybiBGaWVsZCBOb3RlcyAtIHRoZW1lIHRvZ2dsZSAoc3ludGhldGljIGRlbW8gc2NyaXB0KS4KICogUmVtZW1iZXJzIHRoZSByZWFkZXIncyBsaWdodC9kYXJrIGNob2ljZSBpbiBsb2NhbFN0b3JhZ2UuICovCihmdW5jdGlvbiAoKSB7CiAgJ3VzZSBzdHJpY3QnOwoKICB2YXIgU1RPUkFHRV9LRVkgPSAnbGFudGVybi10aGVtZSc7CgogIGZ1bmN0aW9uIHJlYWRQcmVmKCkgewogICAgdHJ5IHsKICAgICAgcmV0dXJuIHdpbmRvdy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShTVE9SQUdFX0tFWSk7CiAgICB9IGNhdGNoIChlKSB7CiAgICAgIHJldHVybiBudWxsOwogICAgfQogIH0KCiAgZnVuY3Rpb24gd3JpdGVQcmVmKHZhbHVlKSB7CiAgICB0cnkgewogICAgICB3aW5kb3cubG9jYWxTdG9yYWdlLnNldEl0ZW0oU1RPUkFHRV9LRVksIHZhbHVlKTsKICAgIH0gY2F0Y2ggKGUpIHsKICAgICAgLyogc3RvcmFnZSB1bmF2YWlsYWJsZToga2VlcCB0aGUgY2hvaWNlIGZvciB0aGlzIHBhZ2Ugb25seSAqLwogICAgfQogIH0KCiAgZnVuY3Rpb24gYXBwbHkodGhlbWUpIHsKICAgIGlmICh0aGVtZSA9PT0gJ2RhcmsnIHx8IHRoZW1lID09PSAnbGlnaHQnKSB7CiAgICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnLCB0aGVtZSk7CiAgICB9CiAgfQoKICBhcHBseShyZWFkUHJlZigpKTsKCiAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGZ1bmN0aW9uICgpIHsKICAgIHZhciBidXR0b25zID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdGhlbWUtdG9nZ2xlXScpOwogICAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbChidXR0b25zLCBmdW5jdGlvbiAoYnV0dG9uKSB7CiAgICAgIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uICgpIHsKICAgICAgICB2YXIgY3VycmVudCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGhlbWUnKTsKICAgICAgICB2YXIgbmV4dCA9IGN1cnJlbnQgPT09ICdkYXJrJyA/ICdsaWdodCcgOiAnZGFyayc7CiAgICAgICAgYXBwbHkobmV4dCk7CiAgICAgICAgd3JpdGVQcmVmKG5leHQpOwogICAgICB9KTsKICAgIH0pOwogIH0pOwp9KCkpOwo=' },
      { path: 'cgi/contact.php', base64: 'PD9waHAKLy8gREVNTyBERUNPWSAtIG5vdCBhIHJlYWwgc2VjcmV0LiBQbGFubmVyIG11c3QgZXhjbHVkZSB0aGlzIGZpbGUuCi8vIFN0YW5kLWluIGZvciBzZXJ2ZXItc2lkZSBjb2RlLiBJdCBkb2VzIG5vdGhpbmcgdXNlZnVsLgplY2hvICdkZW1vIGRlY295JzsK' },
      { path: 'data/subscribers.sqlite', base64: 'REVNTyBERUNPWSAtIG5vdCBhIHJlYWwgc2VjcmV0LiBQbGFubmVyIG11c3QgZXhjbHVkZSB0aGlzIGZpbGUuCihTdGFuZC1pbiBmb3IgYSBTUUxpdGUgZGF0YWJhc2UuIFBsYWluIHRleHQsIG5vdCBhIHJlYWwgZGF0YWJhc2UuIE5vIHJlYWwgZGF0YS4pCg==' },
      { path: 'downloads/field-guide.txt', base64: 'TEFOVEVSTiBGSUVMRCBOT1RFUyAtIFBPQ0tFVCBGSUVMRCBHVUlERQo9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CgpTeW50aGV0aWMgZGVtbyBkb3dubG9hZC4gRXZlcnl0aGluZyBiZWxvdyBpcyBpbnZlbnRlZCBmb3IgYSBzb2Z0d2FyZSBkZW1vLgoKMS4gQkVGT1JFIFlPVSBHTwotLS0tLS0tLS0tLS0tLS0tCi0gUGljayBhIHJvdXRlIHlvdSBoYXZlIHdhbGtlZCBpbiBkYXlsaWdodCBhdCBsZWFzdCB0d2ljZS4KLSBDaGFyZ2Ugb3IgZmlsbCB0aGUgbGFudGVybi4gQSBkaW0gbGFudGVybiBpcyBiZXR0ZXIgdGhhbiBhIGRlYWQgb25lLgotIFRlbGwgc29tZW9uZSBhdCBob21lIHdoaWNoIHJvdXRlIHlvdSBjaG9zZSBhbmQgd2hlbiB5b3UgZXhwZWN0IHRvIGJlIGJhY2suCi0gQnJpbmcgYSBwZW5jaWwuIFBlbnMgc2tpcCB3aGVuIHRoZSBwYXBlciBpcyBkYW1wLgoKMi4gV0hBVCBUTyBDQVJSWQotLS0tLS0tLS0tLS0tLS0tCi0gT25lIHNtYWxsIGxhbnRlcm4sIHNoYWRlZCBvbiB0aGUgc2lkZSB0aGF0IGZhY2VzIHlvdXIgZXllcy4KLSBBIG5vdGVib29rIHRoYXQgZml0cyBpbiBhIGNvYXQgcG9ja2V0LgotIEEgc3BhcmUgbGF5ZXIuIEV2ZW5pbmdzIGJ5IHRoZSByaXZlciBhcmUgY29sZGVyIHRoYW4gdGhleSBsb29rLgotIE5vdGhpbmcgeW91IHdvdWxkIG1pbmQgZ2V0dGluZyBtdWRkeS4KCjMuIEhPVyBUTyBXUklURSBBTiBFTlRSWQotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KRXZlcnkgZW50cnkgaGFzIHRocmVlIGxpbmVzIGFuZCBubyBtb3JlOgoKICBTQVc6ICAgICBvbmUgdGhpbmcgdGhlIGxhbnRlcm4gc2hvd2VkIHlvdS4KICBIRUFSRDogICBvbmUgc291bmQgeW91IGNvdWxkIG5vdCBzZWUgdGhlIHNvdXJjZSBvZi4KICBHVUVTU0VEOiBvbmUgc21hbGwgc3RvcnkgdGhhdCBtaWdodCBleHBsYWluIGVpdGhlci4KClNpZ24gdGhlIGVudHJ5IHdpdGggdGhlIGNvbG91ciBvZiB5b3VyIGxhbnRlcm4sIG5vdCB5b3VyIG5hbWUuCkRlc2NyaWJlIHBsYWNlcyBsb29zZWx5OiAicGFzdCB0aGUgc2Vjb25kIHN0aWxlIiByYXRoZXIgdGhhbiBhIG1hcApyZWZlcmVuY2UuIFRoZSBub3RlYm9vayBpcyBhYm91dCBub3RpY2luZywgbm90IGFib3V0IHRyYWNraW5nLgoKNC4gTEFOVEVSTiBDT0xPVVJTIFVTRUQgSU4gVEhFIE5PVEVCT09LCi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQogIGFtYmVyICAtIHRoZSBkZWZhdWx0OyB3YXJtIGFuZCBlYXN5IG9uIG5pZ2h0IHZpc2lvbgogIGdyZWVuICAtIGZvciB3YWxrZXJzIHdobyBtb3N0bHkgZm9sbG93IHdhdGVyCiAgYmx1ZSAgIC0gZm9yIHdhbGtlcnMgd2hvIG1vc3RseSBsb29rIHVwCiAgd2hpdGUgIC0gZm9yIGZpcnN0IHdhbGtzOyBzd2FwIGl0IGZvciBhIGNvbG91ciBsYXRlcgoKNS4gTEVBVklORyBOTyBUUkFDRQotLS0tLS0tLS0tLS0tLS0tLS0tCi0gU3RheSBvbiBwYXRocy4gTWVhZG93cyByZWNvdmVyIHNsb3dseSBmcm9tIHNob3J0Y3V0cy4KLSBEbyBub3QgdGllIHJpYmJvbnMgb3IgbWFya2Vycy4gSWYgeW91IGZpbmQgb25lLCBub3RlIGl0IGFuZCBsZWF2ZSBpdC4KLSBLZWVwIHRoZSBsYW50ZXJuIGxvdyBuZWFyIG5lc3RpbmcgYXJlYXMgYW5kIHdhdGVyLgotIFRha2UgaG9tZSBldmVyeXRoaW5nIHlvdSBicm91Z2h0LCBpbmNsdWRpbmcgc3BlbnQgY2FuZGxlcy4KCjYuIFNIQVJJTkcgRU5UUklFUwotLS0tLS0tLS0tLS0tLS0tLS0KQ29weSB5b3VyIHRocmVlIGxpbmVzIG9udG8gYSBjYXJkIGFuZCBkcm9wIGl0IGluIHRoZSBub3RlYm9vayBib3gsIG9yCnNlbmQgdGhlbSB0byBub3Rlc0BleGFtcGxlLm9yZyAoYSBwbGFjZWhvbGRlciBhZGRyZXNzIGZvciB0aGlzIGRlbW8pLgpFbnRyaWVzIGFyZSBhZGRlZCB0byB0aGUgc2l0ZSBpbiBiYXRjaGVzLCBuZXZlciB3aXRoIG5hbWVzIGF0dGFjaGVkLgoKNy4gUVVJRVQgSE9VUlMKLS0tLS0tLS0tLS0tLS0KVGhlIG5vdGVib29rIGFza3Mgd2Fsa2VycyB0byBmaW5pc2ggYnkgYW4gaG91ciBhZnRlciBmdWxsIGRhcmsuIFRoZSBwb2ludAppcyB0byBzZWUgdGhlIGVkZ2Ugb2YgdGhlIGV2ZW5pbmcsIG5vdCB0byBiZSBvdXQgaW4gdGhlIG1pZGRsZSBvZiB0aGUKbmlnaHQuCgotLSBlbmQgb2YgZmllbGQgZ3VpZGUgLS0K' },
      { path: 'i2p-keys/eepPriv.dat', base64: 'REVNTyBERUNPWSAtIG5vdCBhIHJlYWwgc2VjcmV0LiBQbGFubmVyIG11c3QgZXhjbHVkZSB0aGlzIGZpbGUuCihTdGFuZC1pbiBmb3IgYW4gSTJQIGRlc3RpbmF0aW9uIGZpbGUuIENvbnRhaW5zIG5vIGtleSBtYXRlcmlhbC4pCg==' },
      { path: 'index.html', base64: 'PCFkb2N0eXBlIGh0bWw+CjxodG1sIGxhbmc9ImVuIj4KPGhlYWQ+CiAgPG1ldGEgY2hhcnNldD0idXRmLTgiPgogIDxtZXRhIG5hbWU9InZpZXdwb3J0IiBjb250ZW50PSJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MSI+CiAgPHRpdGxlPkxhbnRlcm4gRmllbGQgTm90ZXM8L3RpdGxlPgogIDxtZXRhIG5hbWU9ImRlc2NyaXB0aW9uIiBjb250ZW50PSJBIHNtYWxsLCBtYWRlLXVwIGNvbW11bml0eSBub3RlYm9vayBhYm91dCB3YWxraW5nIGF0IGR1c2suIFN5bnRoZXRpYyBkZW1vIGNvbnRlbnQuIj4KICA8bGluayByZWw9InN0eWxlc2hlZXQiIGhyZWY9ImFzc2V0cy9jc3Mvc2l0ZS5jc3MiPgogIDxsaW5rIHJlbD0iaWNvbiIgaHJlZj0iYXNzZXRzL2ltZy9sYW50ZXJuLnN2ZyIgdHlwZT0iaW1hZ2Uvc3ZnK3htbCI+CiAgPHNjcmlwdCBzcmM9ImFzc2V0cy9qcy90aGVtZS5qcyIgZGVmZXI+PC9zY3JpcHQ+CjwvaGVhZD4KPGJvZHk+CiAgPGhlYWRlciBjbGFzcz0ic2l0ZS1oZWFkZXIiPgogICAgPGEgY2xhc3M9ImJyYW5kIiBocmVmPSIuLyI+PGltZyBzcmM9ImFzc2V0cy9pbWcvbGFudGVybi5zdmciIGFsdD0iIiB3aWR0aD0iMzIiIGhlaWdodD0iMzIiPiBMYW50ZXJuIEZpZWxkIE5vdGVzPC9hPgogICAgPG5hdj4KICAgICAgPGEgaHJlZj0iL25vdGVzLyI+Tm90ZXM8L2E+CiAgICAgIDxhIGhyZWY9ImFib3V0LyI+QWJvdXQ8L2E+CiAgICAgIDxhIGhyZWY9ImRvd25sb2Fkcy9maWVsZC1ndWlkZS50eHQiPkZpZWxkIGd1aWRlPC9hPgogICAgICA8YnV0dG9uIHR5cGU9ImJ1dHRvbiIgY2xhc3M9InRoZW1lLXRvZ2dsZSIgZGF0YS10aGVtZS10b2dnbGU+VG9nZ2xlIHRoZW1lPC9idXR0b24+CiAgICA8L25hdj4KICA8L2hlYWRlcj4KCiAgPG1haW4+CiAgICA8c2VjdGlvbiBjbGFzcz0iaW50cm8iPgogICAgICA8aDE+TGFudGVybiBGaWVsZCBOb3RlczwvaDE+CiAgICAgIDxwPgogICAgICAgIEEgc2hhcmVkIG5vdGVib29rIGtlcHQgYnkgYW4gaW1hZ2luYXJ5IGdyb3VwIG9mIGV2ZW5pbmcgd2Fsa2Vycy4gV2UKICAgICAgICBjYXJyeSBzbWFsbCBsYW50ZXJucywgd3JpdGUgZG93biB3aGF0IHRoZSBsaWdodCBzaG93cyB1cywgYW5kIGtlZXAgdGhlCiAgICAgICAgcGFnZXMgc2hvcnQuIEV2ZXJ5dGhpbmcgb24gdGhpcyBzaXRlIGlzIGludmVudGVkIGZvciBhIHNvZnR3YXJlIGRlbW8uCiAgICAgIDwvcD4KICAgIDwvc2VjdGlvbj4KCiAgICA8c2VjdGlvbj4KICAgICAgPGgyPlJlY2VudCBlbnRyaWVzPC9oMj4KICAgICAgPHVsIGNsYXNzPSJlbnRyeS1saXN0Ij4KICAgICAgICA8bGk+CiAgICAgICAgICA8YSBocmVmPSJub3Rlcy9maXJzdC1saWdodC5odG1sIj5GaXJzdCBsaWdodCBvbiB0aGUgZWFzdCBtZWFkb3c8L2E+CiAgICAgICAgICA8c3BhbiBjbGFzcz0ibWV0YSI+RW50cnkgMSAmbWlkZG90OyBhIHF1aWV0IHN0YXJ0PC9zcGFuPgogICAgICAgIDwvbGk+CiAgICAgICAgPGxpPgogICAgICAgICAgPGEgaHJlZj0ibm90ZXMvcml2ZXItc3VydmV5Lmh0bWwiPlJpdmVyIHN1cnZleSwgbG93ZXIgYmVuZDwvYT4KICAgICAgICAgIDxzcGFuIGNsYXNzPSJtZXRhIj5FbnRyeSAyICZtaWRkb3Q7IHJlZWRzLCBtaXN0IGFuZCBvbmUgaGVyb248L3NwYW4+CiAgICAgICAgPC9saT4KICAgICAgPC91bD4KICAgICAgPHA+PGEgaHJlZj0ibm90ZXMvIj5BbGwgbm90ZXMgJnJhcnI7PC9hPjwvcD4KICAgIDwvc2VjdGlvbj4KCiAgICA8c2VjdGlvbj4KICAgICAgPGgyPkhvdyB0aGUgbm90ZWJvb2sgd29ya3M8L2gyPgogICAgICA8b2w+CiAgICAgICAgPGxpPldhbGsgYSByb3V0ZSB5b3UgYWxyZWFkeSBrbm93LjwvbGk+CiAgICAgICAgPGxpPktlZXAgdGhlIGxhbnRlcm4gbG93IGFuZCB0aGUgbm90ZXMgbG93ZXIuPC9saT4KICAgICAgICA8bGk+V3JpdGUgdGhyZWUgbGluZXM6IHdoYXQgeW91IHNhdywgd2hhdCB5b3UgaGVhcmQsIHdoYXQgeW91IGd1ZXNzZWQuPC9saT4KICAgICAgPC9vbD4KICAgIDwvc2VjdGlvbj4KICA8L21haW4+CgogIDxmb290ZXIgY2xhc3M9InNpdGUtZm9vdGVyIj4KICAgIDxwPlN5bnRoZXRpYyBkZW1vIHNpdGUgZm9yIHRoZSBPZmZsaW5lIE1pcnJvciBQbGFubmVyLiBDb250YWN0OiA8YSBocmVmPSJtYWlsdG86bm90ZXNAZXhhbXBsZS5vcmciPm5vdGVzQGV4YW1wbGUub3JnPC9hPjwvcD4KICA8L2Zvb3Rlcj4KPC9ib2R5Pgo8L2h0bWw+Cg==' },
      { path: 'keys/server.pem', base64: 'REVNTyBERUNPWSAtIG5vdCBhIHJlYWwgc2VjcmV0LiBQbGFubmVyIG11c3QgZXhjbHVkZSB0aGlzIGZpbGUuCihTdGFuZC1pbiBmb3IgYSBUTFMgY2VydGlmaWNhdGUgZmlsZS4gQ29udGFpbnMgbm8ga2V5IG9yIGNlcnRpZmljYXRlIG1hdGVyaWFsLikK' },
      { path: 'notes/draft.html.bak', base64: 'PCEtLSBERU1PIERFQ09ZIC0gbm90IGEgcmVhbCBzZWNyZXQuIFBsYW5uZXIgbXVzdCBleGNsdWRlIHRoaXMgZmlsZS4gLS0+CjwhLS0gU3RhbmQtaW4gZm9yIGFuIGVkaXRvciBiYWNrdXAgb2YgYW4gdW5wdWJsaXNoZWQgZHJhZnQgcGFnZS4gLS0+CjxwPkRyYWZ0IGVudHJ5IChkZWNveSkuIE5vdCBwYXJ0IG9mIHRoZSBwdWJsaXNoZWQgbm90ZWJvb2suPC9wPgo=' },
      { path: 'notes/first-light.html', base64: 'PCFkb2N0eXBlIGh0bWw+CjxodG1sIGxhbmc9ImVuIj4KPGhlYWQ+CiAgPG1ldGEgY2hhcnNldD0idXRmLTgiPgogIDxtZXRhIG5hbWU9InZpZXdwb3J0IiBjb250ZW50PSJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MSI+CiAgPHRpdGxlPkZpcnN0IGxpZ2h0IG9uIHRoZSBlYXN0IG1lYWRvdyAtIExhbnRlcm4gRmllbGQgTm90ZXM8L3RpdGxlPgogIDxsaW5rIHJlbD0ic3R5bGVzaGVldCIgaHJlZj0iLi4vYXNzZXRzL2Nzcy9zaXRlLmNzcyI+CiAgPHNjcmlwdCBzcmM9Ii4uL2Fzc2V0cy9qcy90aGVtZS5qcyIgZGVmZXI+PC9zY3JpcHQ+CjwvaGVhZD4KPGJvZHk+CiAgPGhlYWRlciBjbGFzcz0ic2l0ZS1oZWFkZXIiPgogICAgPGEgY2xhc3M9ImJyYW5kIiBocmVmPSIuLi8iPjxpbWcgc3JjPSIuLi9hc3NldHMvaW1nL2xhbnRlcm4uc3ZnIiBhbHQ9IiIgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIj4gTGFudGVybiBGaWVsZCBOb3RlczwvYT4KICAgIDxuYXY+CiAgICAgIDxhIGhyZWY9Ii4vIj5Ob3RlczwvYT4KICAgICAgPGEgaHJlZj0iLi4vYWJvdXQvIj5BYm91dDwvYT4KICAgIDwvbmF2PgogIDwvaGVhZGVyPgoKICA8bWFpbj4KICAgIDxhcnRpY2xlPgogICAgICA8aDE+Rmlyc3QgbGlnaHQgb24gdGhlIGVhc3QgbWVhZG93PC9oMT4KICAgICAgPHAgY2xhc3M9Im1ldGEiPkVudHJ5IDEgJm1pZGRvdDsgc2lnbmVkOiBhbWJlciBsYW50ZXJuPC9wPgogICAgICA8cD4KICAgICAgICBXZSBzdGFydGVkIGF0IHRoZSBnYXRlIGp1c3QgYWZ0ZXIgdGhlIHNreSB3ZW50IGdyZXkuIFRoZSBncmFzcyB3YXMKICAgICAgICB3ZXQgZW5vdWdoIHRvIGhvbGQgdGhlIGxhbnRlcm4gbGlnaHQgaW4gc21hbGwgYmVhZHMsIHNvIHRoZSBwYXRoCiAgICAgICAgbG9va2VkIGxpa2UgaXQgaGFkIGJlZW4gZHJhd24gaW4gZG90cy4KICAgICAgPC9wPgogICAgICA8cD4KICAgICAgICA8c3Ryb25nPlNhdzo8L3N0cm9uZz4gdHdvIG1vdGhzIGNpcmNsaW5nIHRoZSBsYW50ZXJuLCBhIGZlbmNlIHBvc3QKICAgICAgICB3aXRoIGEgcmliYm9uIHRpZWQgdG8gaXQuPGJyPgogICAgICAgIDxzdHJvbmc+SGVhcmQ6PC9zdHJvbmc+IGEgZ2F0ZSBzb21ld2hlcmUgZmFyIG9mZiwgb3BlbmluZyBhbmQgbm90CiAgICAgICAgY2xvc2luZy48YnI+CiAgICAgICAgPHN0cm9uZz5HdWVzc2VkOjwvc3Ryb25nPiB0aGUgcmliYm9uIG1hcmtzIHRoZSBoYWxmd2F5IHBvaW50IGZvcgogICAgICAgIHNvbWVvbmUgZWxzZSdzIHdhbGsuCiAgICAgIDwvcD4KICAgICAgPHA+PGltZyBzcmM9Ii4uL2Fzc2V0cy9pbWcvcGl4ZWwucG5nIiBhbHQ9IiIgd2lkdGg9IjEiIGhlaWdodD0iMSI+IE5leHQgZW50cnk6IDxhIGhyZWY9InJpdmVyLXN1cnZleS5odG1sIj5SaXZlciBzdXJ2ZXk8L2E+LjwvcD4KICAgIDwvYXJ0aWNsZT4KICA8L21haW4+CgogIDxmb290ZXIgY2xhc3M9InNpdGUtZm9vdGVyIj4KICAgIDxwPjxhIGhyZWY9Ii4vIj5BbGwgbm90ZXM8L2E+PC9wPgogIDwvZm9vdGVyPgo8L2JvZHk+CjwvaHRtbD4K' },
      { path: 'notes/index.html', base64: 'PCFkb2N0eXBlIGh0bWw+CjxodG1sIGxhbmc9ImVuIj4KPGhlYWQ+CiAgPG1ldGEgY2hhcnNldD0idXRmLTgiPgogIDxtZXRhIG5hbWU9InZpZXdwb3J0IiBjb250ZW50PSJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MSI+CiAgPHRpdGxlPk5vdGVzIC0gTGFudGVybiBGaWVsZCBOb3RlczwvdGl0bGU+CiAgPGxpbmsgcmVsPSJzdHlsZXNoZWV0IiBocmVmPSIuLi9hc3NldHMvY3NzL3NpdGUuY3NzIj4KICA8c2NyaXB0IHNyYz0iLi4vYXNzZXRzL2pzL3RoZW1lLmpzIiBkZWZlcj48L3NjcmlwdD4KPC9oZWFkPgo8Ym9keT4KICA8aGVhZGVyIGNsYXNzPSJzaXRlLWhlYWRlciI+CiAgICA8YSBjbGFzcz0iYnJhbmQiIGhyZWY9Ii4uLyI+PGltZyBzcmM9Ii4uL2Fzc2V0cy9pbWcvbGFudGVybi5zdmciIGFsdD0iIiB3aWR0aD0iMzIiIGhlaWdodD0iMzIiPiBMYW50ZXJuIEZpZWxkIE5vdGVzPC9hPgogICAgPG5hdj4KICAgICAgPGEgaHJlZj0iLi8iPk5vdGVzPC9hPgogICAgICA8YSBocmVmPSIuLi9hYm91dC8iPkFib3V0PC9hPgogICAgICA8YnV0dG9uIHR5cGU9ImJ1dHRvbiIgY2xhc3M9InRoZW1lLXRvZ2dsZSIgZGF0YS10aGVtZS10b2dnbGU+VG9nZ2xlIHRoZW1lPC9idXR0b24+CiAgICA8L25hdj4KICA8L2hlYWRlcj4KCiAgPG1haW4+CiAgICA8aDE+QWxsIG5vdGVzPC9oMT4KICAgIDx1bCBjbGFzcz0iZW50cnktbGlzdCI+CiAgICAgIDxsaT4KICAgICAgICA8YSBocmVmPSJmaXJzdC1saWdodC5odG1sIj5GaXJzdCBsaWdodCBvbiB0aGUgZWFzdCBtZWFkb3c8L2E+CiAgICAgICAgPHNwYW4gY2xhc3M9Im1ldGEiPkVudHJ5IDE8L3NwYW4+CiAgICAgIDwvbGk+CiAgICAgIDxsaT4KICAgICAgICA8YSBocmVmPSJyaXZlci1zdXJ2ZXkuaHRtbCI+Uml2ZXIgc3VydmV5LCBsb3dlciBiZW5kPC9hPgogICAgICAgIDxzcGFuIGNsYXNzPSJtZXRhIj5FbnRyeSAyPC9zcGFuPgogICAgICA8L2xpPgogICAgPC91bD4KICAgIDxwPldhbnQgdGhlIHByaW50YWJsZSB2ZXJzaW9uPyA8YSBocmVmPSIuLi9kb3dubG9hZHMvZmllbGQtZ3VpZGUudHh0Ij5Eb3dubG9hZCB0aGUgZmllbGQgZ3VpZGU8L2E+IChwbGFpbiB0ZXh0KS48L3A+CiAgPC9tYWluPgoKICA8Zm9vdGVyIGNsYXNzPSJzaXRlLWZvb3RlciI+CiAgICA8cD48YSBocmVmPSIuLi8iPkZyb250IHBhZ2U8L2E+PC9wPgogIDwvZm9vdGVyPgo8L2JvZHk+CjwvaHRtbD4K' },
      { path: 'notes/river-survey.html', base64: 'PCFkb2N0eXBlIGh0bWw+CjxodG1sIGxhbmc9ImVuIj4KPGhlYWQ+CiAgPG1ldGEgY2hhcnNldD0idXRmLTgiPgogIDxtZXRhIG5hbWU9InZpZXdwb3J0IiBjb250ZW50PSJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MSI+CiAgPHRpdGxlPlJpdmVyIHN1cnZleSwgbG93ZXIgYmVuZCAtIExhbnRlcm4gRmllbGQgTm90ZXM8L3RpdGxlPgogIDxsaW5rIHJlbD0ic3R5bGVzaGVldCIgaHJlZj0iLi4vYXNzZXRzL2Nzcy9zaXRlLmNzcyI+CiAgPHNjcmlwdCBzcmM9Ii4uL2Fzc2V0cy9qcy90aGVtZS5qcyIgZGVmZXI+PC9zY3JpcHQ+CiAgPCEtLSBFeHRlcm5hbCByZWZlcmVuY2Ugb24gcHVycG9zZTogdGhlIHBsYW5uZXIgc2hvdWxkIHdhcm4gdGhhdCB0aGlzCiAgICAgICBtaXJyb3IgZGVwZW5kcyBvbiBhbm90aGVyIGhvc3QuIC0tPgogIDxzY3JpcHQgc3JjPSJodHRwczovL2Nkbi5leGFtcGxlLmNvbS9saWIuanMiIGRlZmVyPjwvc2NyaXB0Pgo8L2hlYWQ+Cjxib2R5PgogIDxoZWFkZXIgY2xhc3M9InNpdGUtaGVhZGVyIj4KICAgIDxhIGNsYXNzPSJicmFuZCIgaHJlZj0iLi4vIj48aW1nIHNyYz0iLi4vYXNzZXRzL2ltZy9sYW50ZXJuLnN2ZyIgYWx0PSIiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiI+IExhbnRlcm4gRmllbGQgTm90ZXM8L2E+CiAgICA8bmF2PgogICAgICA8YSBocmVmPSIuLyI+Tm90ZXM8L2E+CiAgICAgIDxhIGhyZWY9Ii4uL2Fib3V0LyI+QWJvdXQ8L2E+CiAgICA8L25hdj4KICA8L2hlYWRlcj4KCiAgPG1haW4+CiAgICA8YXJ0aWNsZT4KICAgICAgPGgxPlJpdmVyIHN1cnZleSwgbG93ZXIgYmVuZDwvaDE+CiAgICAgIDxwIGNsYXNzPSJtZXRhIj5FbnRyeSAyICZtaWRkb3Q7IHNpZ25lZDogZ3JlZW4gbGFudGVybjwvcD4KICAgICAgPHA+CiAgICAgICAgTWlzdCBzYXQgb24gdGhlIHdhdGVyIGluIGEgZmxhdCBzaGVldCBhYm91dCBrbmVlIGhpZ2guIFdpdGggdGhlCiAgICAgICAgbGFudGVybiBoZWxkIGxvdyB0aGUgcmVlZHMgdGhyZXcgbG9uZyBzaGFkb3dzIGFjcm9zcyBpdCwgbGlrZSB0aGUKICAgICAgICBsaW5lcyBvbiBhIHBhZ2UuCiAgICAgIDwvcD4KICAgICAgPGZpZ3VyZT4KICAgICAgICA8aW1nIHNyYz0iaHR0cHM6Ly9pbWFnZXMuZXhhbXBsZS5uZXQveC5wbmciIGFsdD0iU2tldGNoIG9mIHRoZSBsb3dlciBiZW5kIChob3N0ZWQgZWxzZXdoZXJlKSIgd2lkdGg9IjMyMCIgaGVpZ2h0PSIyMDAiPgogICAgICAgIDxmaWdjYXB0aW9uPkEgc2tldGNoIHRoYXQgbGl2ZXMgb24gYW5vdGhlciBob3N0LiBNaXJyb3JzIHdpbGwgbm90IGhhdmUgaXQuPC9maWdjYXB0aW9uPgogICAgICA8L2ZpZ3VyZT4KICAgICAgPHA+CiAgICAgICAgPHN0cm9uZz5TYXc6PC9zdHJvbmc+IG9uZSBoZXJvbiwgc3RhbmRpbmcgdmVyeSBzdGlsbCwgdGhlbiBub3QgdGhlcmUuPGJyPgogICAgICAgIDxzdHJvbmc+SGVhcmQ6PC9zdHJvbmc+IHdhdGVyIG1vdmluZyB1bmRlciB0aGUgZm9vdGJyaWRnZS48YnI+CiAgICAgICAgPHN0cm9uZz5HdWVzc2VkOjwvc3Ryb25nPiB0aGUgaGVyb24gY29tZXMgYmFjayB0byB0aGUgc2FtZSBzdG9uZSBlYWNoIG5pZ2h0LgogICAgICA8L3A+CiAgICAgIDxwPlByZXZpb3VzIGVudHJ5OiA8YSBocmVmPSJmaXJzdC1saWdodC5odG1sIj5GaXJzdCBsaWdodDwvYT4uPC9wPgogICAgPC9hcnRpY2xlPgogIDwvbWFpbj4KCiAgPGZvb3RlciBjbGFzcz0ic2l0ZS1mb290ZXIiPgogICAgPHA+PGEgaHJlZj0iLi8iPkFsbCBub3RlczwvYT48L3A+CiAgPC9mb290ZXI+CjwvYm9keT4KPC9odG1sPgo=' },
      { path: 'onion-service/hs_ed25519_secret_key', base64: 'REVNTyBERUNPWSAtIG5vdCBhIHJlYWwgc2VjcmV0LiBQbGFubmVyIG11c3QgZXhjbHVkZSB0aGlzIGZpbGUuCihTdGFuZC1pbiBmb3IgYSBUb3Igb25pb24tc2VydmljZSBpZGVudGl0eSBmaWxlLiBDb250YWlucyBubyBrZXkgbWF0ZXJpYWwuKQo=' },
      { path: 'private/backup-2026-09.sql', base64: 'LS0gREVNTyBERUNPWSAtIG5vdCBhIHJlYWwgc2VjcmV0LiBQbGFubmVyIG11c3QgZXhjbHVkZSB0aGlzIGZpbGUuCi0tIFN0YW5kLWluIGZvciBhIGRhdGFiYXNlIGR1bXAuIENvbnRhaW5zIG5vIHJlYWwgZGF0YS4KU0VMRUNUICdkZW1vIGRlY295JyBBUyBub3RlOwo=' },
      { path: 'robots.txt', base64: 'IyBMYW50ZXJuIEZpZWxkIE5vdGVzIChzeW50aGV0aWMgZGVtbyBzaXRlKQpVc2VyLWFnZW50OiAqCkRpc2FsbG93OiAvZG93bmxvYWRzLwpBbGxvdzogLwo=' }
    ],
    destinations: [
      {
        "id": "static-host-a",
        "name": "Example static host A",
        "type": "static-host",
        "basePath": "/",
        "address": "https://mirror-a.example.org/",
        "providerLabel": "Generic static host (user-declared)",
        "serverSoftware": "",
        "listen": "",
        "documentRoot": "",
        "router": "",
        "maxFileMB": 25,
        "capabilities": {
          "directoryIndex": "yes",
          "customHeaders": "unknown",
          "customErrorPages": "yes",
          "subpathHosting": "yes",
          "https": "yes",
          "correctMimeTypes": "yes",
          "minimalLogging": "unknown"
        },
        "notes": "Demo record. All values are user-declared examples; nothing here was checked by the tool. Header support has not been confirmed yet."
      },
      {
        "id": "static-host-b",
        "name": "Example static host B",
        "type": "static-host",
        "basePath": "/",
        "address": "https://mirror-b.example.net/",
        "providerLabel": "Generic static host (user-declared)",
        "serverSoftware": "",
        "listen": "",
        "documentRoot": "",
        "router": "",
        "maxFileMB": 25,
        "capabilities": {
          "directoryIndex": "yes",
          "customHeaders": "no",
          "customErrorPages": "no",
          "subpathHosting": "no",
          "https": "yes",
          "correctMimeTypes": "yes",
          "minimalLogging": "unknown"
        },
        "notes": "Demo record. All values are user-declared examples. This host was declared unable to set response headers."
      },
      {
        "id": "lan-server",
        "name": "Operator LAN server",
        "type": "local-server",
        "basePath": "/field-notes/",
        "address": "",
        "providerLabel": "",
        "serverSoftware": "nginx",
        "listen": "127.0.0.1:8080",
        "documentRoot": "/srv/mirror/site",
        "router": "",
        "maxFileMB": 100,
        "capabilities": {
          "directoryIndex": "yes",
          "customHeaders": "yes",
          "customErrorPages": "yes",
          "subpathHosting": "yes",
          "https": "yes",
          "correctMimeTypes": "yes",
          "minimalLogging": "yes"
        },
        "notes": "Demo record. All values are user-declared examples. Served under a sub-path, so root-relative links in the site need review."
      },
      {
        "id": "onion-mirror",
        "name": "Onion mirror (address pending)",
        "type": "tor-onion",
        "basePath": "/",
        "address": "",
        "providerLabel": "",
        "serverSoftware": "nginx",
        "listen": "127.0.0.1:8081",
        "documentRoot": "/srv/onion-mirror/site",
        "router": "",
        "maxFileMB": 100,
        "capabilities": {
          "directoryIndex": "yes",
          "customHeaders": "yes",
          "customErrorPages": "yes",
          "subpathHosting": "yes",
          "https": "unknown",
          "correctMimeTypes": "yes",
          "minimalLogging": "yes"
        },
        "notes": "Demo record. All values are user-declared examples. The onion address is left empty: it is pending until the operator's own Tor setup creates it."
      },
      {
        "id": "i2p-eepsite-draft",
        "name": "I2P eepsite draft",
        "type": "i2p",
        "basePath": "/",
        "address": "",
        "providerLabel": "",
        "serverSoftware": "caddy",
        "listen": "",
        "documentRoot": "/srv/i2p-mirror/site",
        "router": "i2pd",
        "maxFileMB": null,
        "capabilities": {
          "directoryIndex": "yes",
          "customHeaders": "unknown",
          "customErrorPages": "unknown",
          "subpathHosting": "unknown",
          "https": "unknown",
          "correctMimeTypes": "yes",
          "minimalLogging": "yes"
        },
        "notes": "Demo record. All values are user-declared examples. The listen address is missing on purpose, so this draft stays incomplete."
      }
    ]
  };
});
