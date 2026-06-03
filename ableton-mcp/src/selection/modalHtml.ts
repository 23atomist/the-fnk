export const CANCEL_SENTINEL = "__ABLETON_MCP_CANCEL__";

/** Self-contained HTML form: textarea + Send/Cancel. Posts the typed text (or the cancel
 *  sentinel) back to the host via close_and_send. No remote resources. */
export function buildInstructionModalHtml(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font:14px -apple-system,system-ui,sans-serif;margin:0;padding:16px;background:#1e1e1e;color:#eee}
    textarea{width:100%;height:120px;box-sizing:border-box;background:#2a2a2a;color:#eee;border:1px solid #444;border-radius:6px;padding:8px;font:14px inherit;resize:vertical}
    .row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
    button{font:14px inherit;padding:8px 16px;border-radius:6px;border:0;cursor:pointer}
    .send{background:#3b82f6;color:#fff}.cancel{background:#3a3a3a;color:#ddd}
    h3{margin:0 0 8px}</style></head><body>
    <h3>Ask Claude</h3>
    <textarea id="t" placeholder="e.g. make a 4-bar minor-key bassline" autofocus></textarea>
    <div class="row">
      <button class="cancel" onclick="post('${CANCEL_SENTINEL}')">Cancel</button>
      <button class="send" onclick="post(document.getElementById('t').value)">Send</button>
    </div>
    <script>
      function post(v){
        var msg={method:"close_and_send",params:[v]};
        if(window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.live){
          window.webkit.messageHandlers.live.postMessage(msg);
        } else if(window.chrome&&window.chrome.webview){
          window.chrome.webview.postMessage(msg);
        }
      }
      document.getElementById('t').addEventListener('keydown',function(e){
        if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){post(document.getElementById('t').value);}
      });
    </script></body></html>`;
}

/** Wrap HTML as a base64 data: URL for ui.showModalDialog. */
export function toDataUrl(html: string): string {
  return `data:text/html;base64,${Buffer.from(html, "utf8").toString("base64")}`;
}

/** A modal that shows a question and returns the producer's short answer. */
export function buildQuestionModalHtml(question: string): string {
  const safe = question.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font:14px -apple-system,system-ui,sans-serif;margin:0;padding:16px;background:#1e1e1e;color:#eee}
    input{width:100%;box-sizing:border-box;background:#2a2a2a;color:#eee;border:1px solid #444;border-radius:6px;padding:8px;font:14px inherit}
    .row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
    button{font:14px inherit;padding:8px 16px;border-radius:6px;border:0;cursor:pointer}
    .send{background:#3b82f6;color:#fff}.cancel{background:#3a3a3a;color:#ddd}
    p{margin:0 0 10px}</style></head><body>
    <p>${safe}</p>
    <input id="a" autofocus />
    <div class="row">
      <button class="cancel" onclick="post('${CANCEL_SENTINEL}')">Cancel</button>
      <button class="send" onclick="post(document.getElementById('a').value)">Answer</button>
    </div>
    <script>
      function post(v){
        var msg={method:"close_and_send",params:[v]};
        if(window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.live){window.webkit.messageHandlers.live.postMessage(msg);}
        else if(window.chrome&&window.chrome.webview){window.chrome.webview.postMessage(msg);}
      }
      document.getElementById('a').addEventListener('keydown',function(e){if(e.key==='Enter'){post(document.getElementById('a').value);}});
    </script></body></html>`;
}
