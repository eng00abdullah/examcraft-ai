# Reference sources and provenance

Checked on 2026-11-14. These are primary technical references. The project-specific state model, objective, heuristic proof, limits, UI direction, and acceptance gates are design decisions in this kit, not claims copied from a vendor or an empirical university deployment.

## Search background

- UC Berkeley CS188, Uninformed Search: https://inst.eecs.berkeley.edu/~cs188/textbook/search/uninformed.html
  - Source for FIFO BFS, LIFO DFS, growth of BFS's frontier, and the condition under which BFS's shallowest solution also has minimum cost.
- UC Berkeley CS188, Informed Search: https://inst.eecs.berkeley.edu/~cs188/textbook/search/informed.html
  - Source for heuristic search, A* admissibility, goal-selection reasoning, and the zero-heuristic uniform-cost baseline.

## Antigravity usage

- Rules: https://antigravity.google/docs/rules/
  - Current documentation describes discovering AGENTS.md/GEMINI.md and directory-scoped instructions. The master prompt also explicitly asks the agent to read the supplied files, so the handoff does not depend solely on automatic discovery.
- Implementation plan: https://antigravity.google/docs/implementation-plan
  - The explicit /plan workflow creates a reviewable implementation artifact and requests review before changes. The quickstart uses a normal execution prompt; retain the user's existing review/permission policy if the application asks for review.
- Remote Control: https://antigravity.google/docs/remote-control/
  - Remote interaction requires a connected instance and an authenticated browser using the relevant account. It is not established merely by having this ZIP. No remote-control connection was created by this handoff.

## Implementation references

- FastAPI concurrency and async: https://fastapi.tiangolo.com/async/
- FastAPI Server-Sent Events: https://fastapi.tiangolo.com/tutorial/server-sent-events/
- React Flow documentation: https://reactflow.dev/learn

Dependency APIs and availability can change. Confirm the installed versions against their official documentation while implementing, pin compatible dependencies, and validate the actual behavior. No package version, cloud hosting capability, or performance claim is assumed from this list.
