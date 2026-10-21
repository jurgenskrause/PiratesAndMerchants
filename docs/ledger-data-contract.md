# Ledger data contract

The port ledger is a renderer over a data source. `PortDashboard` accepts a
`getLedgerData(port)` callback; the callback returns the object shape produced
by `createDemoLedgerData` in `dist/ledger-demo-data.js`.

```js
{
  meta: { title, subtitle, eyebrow },
  pages: {
    folio: {
      left: { eyebrow, title, summary, context },
      right: { eyebrow, title, metrics, summary }
    },
    markets: {
      left: { eyebrow, title, summary, rows },
      right: { eyebrow, title, summary, context }
    }
  }
}
```

`dist/ledger-schema.js` owns the tab catalogue and page templates. Templates
select fields by path and render only presentation blocks: section headers,
paragraphs, notes, callouts, lists, metrics, key-value rows, timelines,
transparent charts, source stamps and tables. A live economy adapter may
replace the demo object without changing the DOM renderer or CSS.

Content blocks never paint a parchment image. The shared dialog pseudo-element
is the only page texture. Components use transparent backgrounds, ink rules,
spacing and typography to separate information.

Tab icons are explicit resources under `dist/gfx/ledger/tabs/`. Add a new tab
by extending `LEDGER_TABS`, adding its template, and supplying its page data.
Use display strings or numeric values with a formatter (`money`, `integer`, or
`percent`) in the data object. Formatting never changes source values.
