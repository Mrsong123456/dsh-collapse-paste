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

/**
 * The host's filled-primary pair. `--dsw-alias-brand-primary` is an INK
 * token (near-black in light, near-white in dark), so using it as a surface
 * made the Save label white-on-white in dark mode. Fall back to the same
 * blue the fold pill uses when the filled pair is not defined.
 */
const PRIMARY_FILL = "var(--dsw-alias-button-primary-fill, #4d6bfe)";
const PRIMARY_INK = "var(--dsw-alias-label-primary-foreground, #fff)";

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

/**
 * A number input that stays editable while empty.
 *
 * The value is a controlled number, but binding `String(value)` directly
 * made clearing the field impossible: `Number("") === 0` immediately wrote
 * a zero back. This keeps the raw text while focused, parses only a
 * non-empty value, and clamps once on blur.
 */
function NumberField(props: {
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
}): React.ReactElement {
    const { value, min, max, onChange } = props;
    const [text, setText] = React.useState(String(value));
    const [focused, setFocused] = React.useState(false);
    React.useEffect(() => {
        if (!focused) setText(String(value));
    }, [value, focused]);
    return h("input", {
        type: "number",
        min,
        max,
        value: text,
        onFocus: () => setFocused(true),
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
            const next = event.target.value;
            setText(next);
            if (next.trim() === "") return;
            const parsed = Number(next);
            if (Number.isFinite(parsed)) onChange(parsed);
        },
        onBlur: () => {
            setFocused(false);
            const parsed = Math.floor(Number(text));
            if (text.trim() === "" || !Number.isFinite(parsed)) {
                setText(String(value));
                return;
            }
            const clamped = Math.min(max, Math.max(min, parsed));
            setText(String(clamped));
            if (clamped !== value) onChange(clamped);
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
        style: { width: "18px", height: "18px", accentColor: PRIMARY_FILL }
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

    const flash = (): void => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    };

    const save = (): void => {
        setDraft({ ...setConfig(draft) });
        flash();
    };

    const reset = (): void => {
        const next = resetConfig();
        setDraft({ ...next });
        flash();
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
        field(
            z ? "启用输入框折叠" : "Enable composer folding",
            z ? "关闭后立即展开当前草稿，之后的粘贴保持原样" : "Off unfolds the current draft; later pastes stay stock",
            checkbox(draft.active, (v) => set("active", v))
        ),
        field(
            z ? "输入框：最小行数" : "Composer: minimum lines",
            z ? "与字符数下限需同时达到" : "Must also meet the character floor",
            h(NumberField, { value: draft.minLines, min: 1, max: 100, onChange: (v) => set("minLines", v) })
        ),
        field(
            z ? "输入框：最小字符数" : "Composer: minimum characters",
            z ? "0 表示只看行数" : "0 means lines only",
            h(NumberField, { value: draft.minChars, min: 0, max: 100000, onChange: (v) => set("minChars", v) })
        ),
        field(
            z ? "发送后折叠长消息" : "Fold long sent messages",
            z ? "关闭后消息区立即恢复完整显示" : "Off expands messages immediately",
            checkbox(draft.foldSent, (v) => set("foldSent", v))
        ),
        field(
            z ? "消息折叠：最小字符数" : "Message fold: minimum characters",
            z ? "与最小行数任一达到即折叠" : "Folds when this or the line floor is met",
            h(NumberField, { value: draft.sentMinChars, min: 0, max: 1000000, onChange: (v) => set("sentMinChars", v) })
        ),
        field(
            z ? "消息折叠：最小行数" : "Message fold: minimum lines",
            z ? "与最小字符数任一达到即折叠" : "Folds when this or the character floor is met",
            h(NumberField, { value: draft.sentMinLines, min: 1, max: 100000, onChange: (v) => set("sentMinLines", v) })
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
                        border: "1px solid " + PRIMARY_FILL,
                        borderRadius: "8px",
                        background: PRIMARY_FILL,
                        color: PRIMARY_INK,
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
