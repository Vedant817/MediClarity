import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import ReactDOMServer from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkHtmlBreaks } from "../src/lib/remark-html-breaks.ts";

test("remarkHtmlBreaks converts inline <br> tags in paragraphs to break elements", () => {
  const markdown = "Line 1<br>Line 2<br/>Line 3<br />Line 4<BR>Line 5";
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm, remarkHtmlBreaks] }, markdown)
  );

  assert.ok(!html.includes("&lt;br"), `Raw br was escaped: ${html}`);
  assert.ok(!html.includes("<br>"), `Raw unparsed br remained: ${html}`);
  assert.equal((html.match(/<br\s*\/?>/g) || []).length, 4);
});

test("remarkHtmlBreaks properly formats table cells containing <br> bullet points", () => {
  const table = [
    "| Finding | Possible Precautionary Actions |",
    "| --- | --- |",
    "| Elevated creatinine, urea, BUN | • Keep well-hydrated.<br>• Avoid over-use of NSAIDs.<br>• Monitor blood pressure. |",
    "| Low serum calcium | • Include calcium-rich foods.<br>• Check vitamin D status. |",
  ].join("\n");

  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm, remarkHtmlBreaks] }, table)
  );

  assert.ok(!html.includes("&lt;br"), `Raw br was escaped in table: ${html}`);
  assert.ok(!html.includes("&lt;br/&gt;"), `Raw br/ was escaped in table: ${html}`);
  assert.ok(html.includes("<table>"), "Should contain table");
  assert.ok(html.includes("<td>• Keep well-hydrated.<br/>"), `Table cell should contain br element: ${html}`);
  assert.equal((html.match(/<br\s*\/?>/g) || []).length, 3);
});
