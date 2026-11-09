# Magik Pipe

Two ComfyUI nodes bundle any number of connected data sockets into one cable
and restore them in their original order.

## Install

Extract the `Magik_Pipe` directory into `ComfyUI/custom_nodes/`, restart ComfyUI,
and refresh the browser. No additional dependencies are needed.
Find both nodes under **Magik → Pipe**.

## Usage

1. Add **Magik Pipe In** and connect at least two inputs.
2. Connect more data to the spare socket that appears at the bottom.
3. Connect its **Magik Pipe** output to **Magik Pipe Out**.
4. Pipe Out automatically mirrors the number, types, labels, and order of the
   connected inputs. Each output label includes the origin node's name in
   parentheses, using its current title (including custom titles). Standard
   reroutes are followed to the actual origin. Connect these outputs to their consumers.

Example: MODEL, CLIP, VAE, LATENT in that order produce MODEL, CLIP, VAE,
LATENT outputs in that same order. Multiple Pipe Out nodes can use one pipe.

Inputs must be connected consecutively from the first socket: do not leave
holes. The spare unconnected socket is excluded from the pipe. Unconnected
required sockets cause normal ComfyUI validation errors. Workflow reloads
restore the dynamic sockets. Standard reroutes between the two nodes are
supported. Pipe Out retains its last shape when disconnected; reconnecting
updates it. If a changed type is incompatible with a downstream socket, that
connection is removed. Removing trailing inputs removes their matching outputs
and connections. List processing follows ordinary ComfyUI execution mapping;
these nodes do not combine or flatten image batches or payload lists.

## Implementation notes

Backend class IDs: `MagikPipeIn`, `MagikPipeOut`. Cable type: `MAGIK_PIPE`.
`MagikPipe` is an immutable wrapper containing an ordered tuple of payload
references. No tensor/model copy, encoding, sampling, or conversion occurs.
The frontend uses stable internal names `input_1`, `input_2`, etc., with
human-readable labels derived from the upstream output. Numeric suffixes are
sorted numerically, including indices above nine.

The backend supports wildcard dynamic input validation and indexed wildcard
return types. Crucially, Pipe Out does not set a fixed `OUTPUT_IS_LIST` tuple:
ComfyUI merges all returned outputs using the actual result length. A fixed
two-entry tuple would silently drop all outputs after the second one.
The frontend synchronizes before API prompt serialization and after loading.
This package targets regular graph nodes; nested subgraphs and third-party
virtual pipe/reroute mechanisms are not verified.

## Verification

Backend reference identity, ordering above nine inputs, invalid gaps, arbitrary
return-type indices, and ComfyUI-style output merging are covered by the
included test script. Frontend syntax and simulated graph connection/reload
behavior are checked during development. A live ComfyUI installation is still
needed to verify integration with your installed frontend version.
