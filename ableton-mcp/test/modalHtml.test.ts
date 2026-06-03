import { describe, it, expect } from "vitest";
import { buildInstructionModalHtml, toDataUrl, CANCEL_SENTINEL } from "../src/selection/modalHtml.js";

describe("buildInstructionModalHtml", () => {
  const html = buildInstructionModalHtml();
  it("has a textarea and Send/Cancel controls", () => {
    expect(html).toContain("<textarea");
    expect(html.toLowerCase()).toContain("send");
    expect(html.toLowerCase()).toContain("cancel");
  });
  it("posts results via the host message handlers using close_and_send", () => {
    expect(html).toContain("close_and_send");
    expect(html).toContain("webkit.messageHandlers.live");
    expect(html).toContain("chrome.webview"); // Windows fallback
  });
  it("uses the cancel sentinel for the Cancel control", () => {
    expect(html).toContain(CANCEL_SENTINEL);
  });
});

describe("toDataUrl", () => {
  it("produces a base64 data: URL", () => {
    const url = toDataUrl("<h1>x</h1>");
    expect(url.startsWith("data:text/html;base64,")).toBe(true);
    expect(Buffer.from(url.split(",")[1], "base64").toString("utf8")).toBe("<h1>x</h1>");
  });
});
