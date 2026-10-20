/**
 * Browser half — the `zh` dictionary.
 *
 * Same key set as ./en-US.ts; keys not in this table fall open to the key
 * itself, never to a crash.
 */
export const zh = {
    title: "折叠多行粘贴",
    description: "将粘贴的多行文本压缩为可展开的「X 字符 / Y 行」徽章。",
    active: "启用",
    activeHint: "折叠编辑器中粘贴的多行文本。关闭则保持默认行为。",
    minLines: "最少行数",
    minLinesHint: "粘贴文本至少达到此行数时折叠。",
    minChars: "最少字符数",
    minCharsHint: "在此基础上还要求此字符数。0 表示只看行数。",
    invalid: "请输入范围内的整数。",
    label: "{chars} 字符 / {lines} 行",
    expand: "展开",
    collapse: "折叠",
    overridden: "已覆盖",
    reset: "重置为默认",
    readOnly: "此部署的设置只读。",
    save: "保存",
    saving: "保存中…",
    discard: "放弃",
    unsaved: "未保存",
    statusError: "异常",
    saveFailed: "部署未接受这些值，已保留供你修正。"
};
