# Architecture Diagram Maintenance

## Canonical Chat Diagram

- Canonical Mermaid source: `docs/architecture/current-chat-system-flow.mmd`.
- Preview wrapper: `docs/architecture/current-chat-system-flow.md`.
- The diagram describes the current working-tree implementation, not only the latest Git commit and not a future target architecture.

## Update Workflow

When the project owner asks for the current architecture diagram:

1. Read the existing `.mmd` baseline first.
2. Inspect only code areas changed since the previous diagram update, plus their direct call boundaries.
3. Preserve every unchanged node, label, and edge.
4. Add, remove, or edit only architecture elements whose runtime behavior actually changed.
5. Update the `.mmd` source in place; do not create dated duplicate diagrams unless explicitly requested.
6. Mirror the exact same Mermaid source inside the `.md` preview.
7. Verify the Mermaid blocks match before reporting completion.

Do not present planned vector search, queues, agents, LangChain, or other future components as current architecture until they exist in the working tree.
