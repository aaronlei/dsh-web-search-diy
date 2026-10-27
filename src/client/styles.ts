/**
 * The card stylesheet. Styles mirror the official card rules under the
 * `dwsd-` prefix and are installed idempotently from the plugin effect.
 */
import { ID } from "./consts.ts";

/** Styles mirroring the official card rules under our own `dwsd-` prefix. */
export const CARD_CSS = [
	".dwsd-body{margin:0;padding-bottom:8px}",
	".dwsd-status{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5}",
	".dwsd-footer{border-top:.5px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}",
	".dwsd-failed{min-width:0;color:var(--dsw-alias-label-error);flex:1;margin:0;font-size:12px;line-height:1.5}",
	".dwsd-discard,.dwsd-save{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}",
	".dwsd-discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}",
	".dwsd-discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}",
	".dwsd-save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}",
	".dwsd-discard:disabled,.dwsd-save:disabled{opacity:.4;cursor:default}",
	".dwsd-discard:focus-visible,.dwsd-save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}",
	".dwsd-field{flex-direction:column;gap:6px;padding:12px 0;display:flex}",
	".dwsd-field+.dwsd-field{border-top:.5px solid var(--dsw-alias-border-l2)}",
	".dwsd-head{align-items:center;gap:8px;display:flex}",
	".dwsd-label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}",
	".dwsd-badges{align-items:center;gap:8px;display:inline-flex}",
	".dwsd-badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}",
	".dwsd-badgeMuted{white-space:nowrap;color:var(--dsw-alias-label-tertiary);border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px}",
	".dwsd-input{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}",
	".dwsd-input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}",
	".dwsd-input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}",
	".dwsd-inputInvalid{border-color:var(--dsw-alias-label-error)}",
	".dwsd-invalid{color:var(--dsw-alias-label-error);margin:0;font-size:12px;line-height:1.5}",
	".dwsd-hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}",
	".dwsd-choices{gap:4px;display:grid}",
	".dwsd-choice{cursor:pointer;border-radius:6px;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:8px;min-width:0;padding:6px;display:grid}",
	".dwsd-choice:hover{background:var(--dsw-alias-bg-layer-4)}",
	".dwsd-choice input{accent-color:var(--dsw-alias-brand-primary);margin:0}",
	".dwsd-choiceDisabled{opacity:.5;cursor:default}",
	".dwsd-choiceLabel{color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}",
	".dwsd-choiceReason{color:var(--dsw-alias-label-tertiary);margin-left:8px;font-size:12px;line-height:1.5}",
	".dwsd-combo{position:relative;align-items:center;gap:6px;display:flex}",
	".dwsd-combo .dwsd-input{flex:1;min-width:0}",
	".dwsd-comboToggle{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);border-radius:8px;cursor:pointer;font:inherit;padding:0 10px;height:34px;line-height:1}",
	".dwsd-comboToggle:hover{color:var(--dsw-alias-label-primary)}",
	".dwsd-comboList{z-index:20;background:var(--dsw-alias-bg-layer-3);border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;max-height:240px;margin:0;padding:4px;list-style:none;position:absolute;top:38px;left:0;right:0;overflow:auto}",
	".dwsd-comboList button{background:0 0;border:0;border-radius:6px;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;font-size:13px;line-height:1.5;padding:6px 8px;text-align:left;width:100%}",
	".dwsd-comboList button:hover{background:var(--dsw-alias-bg-layer-4)}",
	".dwsd-switchRow{color:var(--dsw-alias-label-primary);justify-content:space-between;align-items:center;gap:16px;font-size:13px;line-height:1.5;display:flex}",
	".dwsd-switch{box-sizing:border-box;background:var(--dsw-alias-border-l3);cursor:pointer;border:0;border-radius:10px;flex:none;width:36px;height:20px;padding:2px;position:relative}",
	".dwsd-switchOn{background:var(--dsw-alias-brand-primary)}",
	".dwsd-switch:disabled{cursor:default;opacity:.5}",
	".dwsd-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}",
	".dwsd-thumb{background:var(--dsw-alias-label-primary-foreground);border-radius:50%;width:16px;height:16px;transition:transform .12s;display:block}",
	".dwsd-switchOn .dwsd-thumb{transform:translate(16px)}",
	".dwsd-advanced{margin-top:4px}",
	".dwsd-advanced>summary{cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.5;padding:8px 0}",
	".dwsd-advanced>summary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}",
	".dwsd-notice{margin:0 0 4px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}",
	".dwsd-confirm{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}"
].join("");
/** Idempotently install the card stylesheet into the document head. */
export function injectStyles(): void {
	if (typeof document === "undefined") return;
	const tagId = "dsh-web-search-diy/client.css";
	if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
	const tag = document.createElement("style");
	tag.dataset.plugin = ID;
	tag.dataset.pluginCss = tagId;
	tag.textContent = CARD_CSS;
	document.head.appendChild(tag);
}
