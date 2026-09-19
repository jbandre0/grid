---
name: handoff
description: Prepares this project for a smooth handoff to a fresh Claude Code chat by rewriting BUILD_STATE.md to reflect everything decided and built in the current session. Use this whenever the user wants to start a new chat to save tokens or reduce context length, says the conversation is getting long, asks to "wrap up," "save progress," "update BUILD_STATE," or otherwise prepare to close out or switch sessions on THE GRID project. Trigger this proactively if the user mentions switching chats, starting fresh, or running low on context — don't wait for them to name BUILD_STATE.md explicitly.
---

# Handoff

THE GRID's CLAUDE.md tells every new session to read `BUILD_STATE.md` before doing anything else. That instruction only works if BUILD_STATE.md is actually current — and it drifts out of date fast, because a chat session accumulates a lot of real design decisions (things tried and rejected, interaction patterns reworked, visual direction settled) that never make it into the file unless someone deliberately writes them back. This skill is that deliberate step: it turns the current conversation's working context into the next session's starting context, so closing this chat doesn't throw that context away.

## Why this has to happen inside the conversation

There's no git history to diff and no external log of what happened this session — the only record of what was built, tried, reverted, or left half-decided is the conversation itself. So don't try to infer changes from the filesystem alone (a diff of App.jsx tells you *what* the code looks like now, not *why*, or what was tried and abandoned along the way). Read back through the session and reconstruct the narrative: what got built, what got explicitly rejected and why (that "why" is often the most valuable part — it stops the next session from re-proposing something already ruled out), and what's genuinely still open versus what just hasn't come up yet.

## Steps

1. **Read the current `BUILD_STATE.md` and `CLAUDE.md` in full.** You need their existing structure and voice before touching either — BUILD_STATE.md uses concise bolded-lead bullets grouped under "What's built and working" and "Known open items," with asides noting what's mocked versus real. Match that voice; don't shift into a changelog or session-log format.

2. **Reconstruct what actually happened this session.** Look for: features built or substantially reworked, specific approaches the user explicitly rejected (and any reason given — "too bright," "reads as dots not a line," etc.), new interaction patterns introduced, and anything the user said was a first pass / prototype / "just want to see what it looks like" rather than a settled decision — those belong in "known open items," not "what's built."

3. **Rewrite BUILD_STATE.md in place.** Update "What's built and working" so each bullet reflects current reality — if a feature was rebuilt from scratch this session (not just tweaked), replace its old description rather than layering a note on top of the stale one. Update "Known open items" to drop anything resolved this session and add anything newly deferred or left unresolved. The goal is that someone reading the file cold, with zero access to this conversation, ends up with an accurate mental model — not a history of how it got that way.

4. **Check CLAUDE.md for drift, but don't edit it.** CLAUDE.md is the user's own standing instructions, not a project log, and editing it without being asked crosses a line the user hasn't authorized. If something in it now reads as inaccurate or superseded (a described interaction pattern that changed, a terminology mismatch), call it out to the user as a suggestion in your final summary instead.

5. **Surface unresolved threads.** Scan back for questions you asked that never got a clear answer, or follow-ups you offered ("want me to also update the mobile view?") that the user didn't respond to. List them explicitly so they don't just silently vanish when the chat closes — the next session has no way to know a question was ever asked.

6. **If this project has no git repository, mention it — don't act on it.** Check with `git status` (or note if `.git` is absent). A project with real iteration history like this one benefits from actual version control across sessions, but initializing a repo is the user's call, not something to do as a side effect of a handoff. One line suggesting it is enough.

7. **End with a short, human-readable summary** of what changed in BUILD_STATE.md (not a diff dump — a few plain sentences), plus the CLAUDE.md drift notes and unresolved questions from steps 4–5. This is what the user actually reads before deciding the handoff is safe, so keep it scannable.
