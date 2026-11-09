import { app } from "../../../scripts/app.js";

const IN = "MagikPipeIn", OUT = "MagikPipeOut";
const kind = n => n?.comfyClass || n?.type;
const linkOf = (g, id) => g?.links?.get?.(id) ?? g?.links?.[id];
const nodeOf = (g, id) => g?.getNodeById?.(id);
let pending = false, syncing = false;

function source(node, slot, seen = new Set()) {
    if (!node || seen.has(node)) return null;
    seen.add(node);
    const link = linkOf(node.graph, node.inputs?.[slot]?.link);
    if (!link) return null;
    const parent = nodeOf(node.graph, link.origin_id);
    if (!parent) return null;
    if (kind(parent) === "Reroute" || parent.type === "Reroute") {
        return source(parent, 0, seen);
    }
    return { node: parent, slot: link.origin_slot, output: parent.outputs?.[link.origin_slot] };
}

function fits(a, b) {
    if (!a || !b || a === "*" || b === "*" || a === b) return true;
    return String(a).split(",").some(t => String(b).split(",").includes(t));
}

function synchronizeGraph(graph) {
    if (!graph || syncing) return;
    syncing = true;
    try {
        const nodes = graph._nodes || [];
        for (const n of nodes.filter(n => kind(n) === IN)) {
            n.inputs ||= [];
            let last = -1;
            n.inputs.forEach((s, i) => { if (s.link != null) last = i; });
            const count = Math.max(2, last + 2);
            while (n.inputs.length < count) n.addInput(`input_${n.inputs.length + 1}`, "*");
            // Only trim unused sockets at the end; indices of wired slots stay stable.
            while (n.inputs.length > count) n.removeInput(n.inputs.length - 1);
            n.inputs.forEach((s, i) => {
                const src = source(n, i);
                s.name = `input_${i + 1}`;
                s.type = src?.output?.type || "*";
                s.label = `${i + 1}: ${src?.output?.name || "input"}`;
                const l = linkOf(graph, s.link);
                if (l) l.type = s.type;
            });
            const size = n.computeSize?.();
            if (size) n.setSize([Math.max(n.size[0], size[0]), Math.max(n.size[1], size[1])]);
        }
        for (const n of nodes.filter(n => kind(n) === OUT)) {
            const src = source(n, 0);
            if (kind(src?.node) !== IN) continue;
            const inputs = src.node.inputs;
            let last = -1;
            inputs.forEach((s, i) => { if (s.link != null) last = i; });
            const shape = inputs.slice(0, Math.max(2, last + 1));
            n.outputs ||= [];
            while (n.outputs.length > shape.length) n.removeOutput(n.outputs.length - 1);
            while (n.outputs.length < shape.length) n.addOutput(`output_${n.outputs.length + 1}`, "*");
            shape.forEach((s, i) => {
                const o = n.outputs[i];
                o.name = `output_${i + 1}`;
                const origin = source(src.node, i);
                const originName = origin?.node?.title || origin?.node?.getTitle?.() || kind(origin?.node);
                o.label = originName ? `${s.label} (${originName})` : s.label;
                o.type = s.type;
                for (const id of [...(o.links || [])]) {
                    const l = linkOf(graph, id);
                    const target = nodeOf(graph, l?.target_id);
                    const input = target?.inputs?.[l?.target_slot];
                    if (input && !fits(o.type, input.type)) target.disconnectInput(l.target_slot);
                    else if (l) l.type = o.type;
                }
            });
            const size = n.computeSize?.();
            if (size) n.setSize([Math.max(n.size[0], size[0]), Math.max(n.size[1], size[1])]);
        }
        graph.setDirtyCanvas?.(true, true);
    } finally { syncing = false; }
}

function schedule() {
    if (pending || syncing) return;
    pending = true;
    queueMicrotask(() => { pending = false; synchronizeGraph(app.graph); });
}

app.registerExtension({
    name: "Magik.Pipe",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (![IN, OUT].includes(nodeData.name)) return;
        for (const method of ["onNodeCreated", "onConfigure", "onConnectionsChange", "onAdded"]) {
            const original = nodeType.prototype[method];
            nodeType.prototype[method] = function (...args) {
                const result = original?.apply(this, args);
                schedule();
                return result;
            };
        }
    },
    afterConfigureGraph() { synchronizeGraph(app.graph); },
    setup() {
        // Flush deferred socket changes before ComfyUI serializes the API prompt.
        const original = app.graphToPrompt;
        app.graphToPrompt = function (...args) {
            synchronizeGraph(app.graph);
            return original.apply(this, args);
        };
    },
});
