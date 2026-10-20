/**
 * Native Settings page for the plugin.
 *
 * Registered in `settings.section` (the released 0.2.1 client's settings
 * page list); reads and writes the browser-side store in `./settings.ts`.
 * The engine and the transcript fold read that store on every paste / scan,
 * so a saved change applies without a reload.
 */
import * as React from "react";
import { getConfig, resetConfig, setConfig, type CollapseConfig } from "./settings.js";

const h = React.createElement;

/** Whether the UI is Chinese (decided per render). */
function isZh(): boolean {
    try {
        return String(document.documentElement.lang || navigator.language || "")
            .toLowerCase()
            .startsWith("zh");
    } catch {
        return false;
    }
}

/** One labeled setting row. */
function field(label: string, hint: string, control: React.ReactNode): React.ReactElement {
    return h(
        "label",
        {
            style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                padding: "10px 12px",
                border: "1px solid var(--dsw-alias-border-l1)",
                borderRadius: "10px",
                background: "var(--dsw-alias-bg-layer-1)"
            }
        },
        h(
            "span",
            { style: { display: "flex", flexDirection: "column", gap: "2px" } },
            h("span", { style: { fontSize: "14px" } }, label),
            hint ? h("span", { style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary)" } }, hint) : null
        ),
        control
    );
}

/** A number input bound to one integer field. */
function numberInput(
    value: number,
    min: number,
    max: number,
    onChange: (value: number) => void
): React.ReactElement {
    return h("input", {
        type: "number",
        min,
        max,
        value: String(value),
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(next);
        },
        style: {
            width: "88px",
            padding: "5px 8px",
            border: "1px solid var(--dsw-alias-border-l1)",
            borderRadius: "8px",
            background: "var(--dsw-alias-bg-layer-2)",
            color: "var(--dsw-alias-label-primary)",
            fontSize: "13px"
        }
    });
}

/** A checkbox bound to one boolean field. */
function checkbox(value: boolean, onChange: (value: boolean) => void): React.ReactElement {
    return h("input", {
        type: "checkbox",
        checked: value,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.checked),
        style: { width: "18px", height: "18px", accentColor: "var(--dsw-alias-brand-primary)" }
    });
}

/** The Settings page component. */
export function SettingsPage(): React.ReactElement {
    const z = isZh();
    const [draft, setDraft] = React.useState<CollapseConfig>(() => ({ ...getConfig() }));
    const [saved, setSaved] = React.useState(false);

    const set = <K extends keyof CollapseConfig>(key: K, value: CollapseConfig[K]): void => {
        setDraft((prev) => ({ ...prev, [key]: value }));
        setSaved(false);
    };

    const save = (): void => {
        setConfig(draft);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    };

    const reset = (): void => {
        const next = resetConfig();
        setDraft({ ...next });
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    };

    return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "12px", maxWidth: "560px", padding: "4px 0" } },
        h(
            "p",
            { style: { margin: 0, fontSize: "13px", color: "var(--dsw-alias-label-secondary)" } },
            z
                ? "输入框粘贴折叠与发送后消息折叠的阈值。设置保存在当前浏览器（localStorage），保存后立即生效。"
                : "Thresholds for composer paste folding and sent-message folding. Settings live in this browser (localStorage) and apply immediately."
        ),
        field(z ? "启用输入框折叠" : "Enable composer folding", "", checkbox(draft.active, (v) => set("active", v))),
        field(
            z ? "输入框：最小行数" : "Composer: minimum lines",
            z ? "粘贴至少这么多行才折叠" : "A paste needs at least this many lines to fold",
            numberInput(draft.minLines, 1, 100, (v) => set("minLines", v))
        ),
        field(
            z ? "输入框：最小字符数" : "Composer: minimum characters",
            z ? "0 表示只看行数" : "0 means lines only",
            numberInput(draft.minChars, 0, 100000, (v) => set("minChars", v))
        ),
        field(
            z ? "发送后折叠长消息" : "Fold long sent messages",
            "",
            checkbox(draft.foldSent, (v) => set("foldSent", v))
        ),
        field(
            z ? "消息折叠：最小字符数" : "Message fold: minimum characters",
            "",
            numberInput(draft.sentMinChars, 0, 1000000, (v) => set("sentMinChars", v))
        ),
        field(
            z ? "消息折叠：最小行数" : "Message fold: minimum lines",
            "",
            numberInput(draft.sentMinLines, 1, 100000, (v) => set("sentMinLines", v))
        ),
        h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px", paddingTop: "2px" } },
            h(
                "button",
                {
                    type: "button",
                    onClick: save,
                    style: {
                        height: "32px",
                        padding: "0 16px",
                        border: "1px solid var(--dsw-alias-brand-primary)",
                        borderRadius: "8px",
                        background: "var(--dsw-alias-brand-primary)",
                        color: "#fff",
                        fontSize: "13px",
                        cursor: "pointer"
                    }
                },
                z ? "保存" : "Save"
            ),
            h(
                "button",
                {
                    type: "button",
                    onClick: reset,
                    style: {
                        height: "32px",
                        padding: "0 14px",
                        border: "1px solid var(--dsw-alias-border-l1)",
                        borderRadius: "8px",
                        background: "transparent",
                        color: "var(--dsw-alias-label-secondary)",
                        fontSize: "13px",
                        cursor: "pointer"
                    }
                },
                z ? "恢复默认" : "Reset to defaults"
            ),
            saved
                ? h("span", { style: { fontSize: "12px", color: "var(--dsw-alias-state-success-primary)" } }, z ? "已保存" : "Saved")
                : null
        )
    );
}
