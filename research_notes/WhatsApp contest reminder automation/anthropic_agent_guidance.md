# Anthropic guidance on orchestrating subagents (research and build), and its application to the WhatsApp contest-reminder bot

Fetched 2026-11-07. Current model family per the docs: Fable 5.1, Opus 5.5, Sonnet 5.5, Haiku 5.5.

## 1. When is multi-agent orchestration worth it (and when not)?

### Takeaway
Anthropic's own research system uses an orchestrator-worker pattern with parallel subagents. It reports large gains on broad research, at about 15x the tokens of a chat. Anthropic says multi-agent is a poor fit for tightly coupled work and for most coding tasks. Its general advice is to start with the simplest solution.

### Cited Findings
- Orchestrator-worker: a lead agent plans, spawns subagents that search in parallel, and synthesizes the results. The lead was Claude Opus 4 and the subagents were Claude Sonnet 4. That setup beat single-agent Opus 4 by 90.2% on the internal research eval. — [Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- Cost: agents use about 4x the tokens of chat, and multi-agent systems about 15x. The task's value must justify that. Token usage alone explained 80% of performance variance on BrowseComp. — [Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- Effort scaling is written into the lead's prompt. Simple fact-finding gets 1 agent and about 3-10 tool calls. Direct comparisons get 2-4 subagents with about 10-15 calls each. Complex research gets more than 10 subagents. Early versions spawned 50 subagents for simple queries, which is why the rules were added. — [Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- Parallelism: 3-5 subagents in parallel, each using 3+ tools in parallel, cut research time by up to 90% on complex queries. — [Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- Poor fit: domains needing shared context or with many dependencies between agents, and "most coding tasks", which have fewer parallelizable subtasks than research. Agents are not yet good at real-time coordination. — [Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- Delegation: vague instructions caused duplicate work. Each subagent needs an objective, an output format, tool guidance and clear task boundaries. Subagents can write results to files and return lightweight references. — [Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- Workflows (predefined code paths) differ from agents (the LLM directs its own process). Anthropic recommends "finding the simplest solution possible, and only increasing complexity when needed". Agentic systems trade latency and cost for performance, so that trade must be justified. — [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- Orchestrator-workers differs from plain parallelization because subtasks are not pre-defined. Coding tools that change many files are the example given. Frameworks can "obscure the underlying prompts and responses". — [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)

### Inferences
- A small project like this bot has little parallelizable work. A lead plus 0-3 short-lived helpers is enough, and a swarm would repeat the "50 subagents for a simple query" failure.

### Gaps
- The older "Claude Code best practices" post (explore, plan, code, commit) was not retrieved in that form. The current docs page covers verification and subagent costs instead (see section 2).

## 2. Claude Code subagents, model choice and verification

### Takeaway
Claude Code supports per-subagent models, isolated contexts and background parallelism. Anthropic says subagents buy parallelism or a fresh reviewer, not a smarter answer, and that they cost tokens and can be slower. Verification with evidence matters more than delegation.

### Cited Findings
- Use a subagent when a side task would flood the main conversation with output. Use the main conversation for back-and-forth, for phases that share significant context (plan, implement, test), for quick targeted changes, and when latency matters. — [Subagents docs](https://code.claude.com/docs/en/sub-agents)
- Each subagent has its own context window, system prompt, tool access and permissions. A non-fork subagent does not see the conversation history and returns only a summary. — [Subagents docs](https://code.claude.com/docs/en/sub-agents)
- The `model` frontmatter field accepts `sonnet`, `opus`, `haiku`, `fable`, a full model ID, or `inherit`. Resolution order: per-call parameter, frontmatter, `CLAUDE_CODE_SUBAGENT_MODEL`, then the main model. — [Subagents docs](https://code.claude.com/docs/en/sub-agents#choose-a-model)
- Custom agents live in `.claude/agents/*.md`. Only `name` and `description` are required. `tools` (allowlist) and `disallowedTools` (denylist) are enforced by the harness. Background subagents run concurrently, the default cap is 20, and they cannot ask the user clarifying questions. Subagents can spawn their own subagents, up to three layers by default. — [Subagents docs](https://code.claude.com/docs/en/sub-agents)
- Subagents pay off for independent work done at the same time, for keeping long output out of the main context, and for a reviewer that has not seen how the code was written. They cost mostly tokens, and a fresh subagent "can end up slower than doing the task where you are". "You get parallelism or a fresh pair of eyes out of it, but not a smarter answer." — [Best practices](https://code.claude.com/docs/en/best-practices)
- To spend less, set `model: haiku` for simple jobs (collecting files, checking links), ask for short summaries back, check `/usage`, and give reviewer subagents read-only tools. — [Best practices](https://code.claude.com/docs/en/best-practices)
- Verification: "give it a check to run", and ask for evidence (the command and its output, or a screenshot). Options range from a prompt instruction, to `/goal`, to a Stop hook, to `/code-review` in a fresh subagent. After the work, `/verify` builds and runs the app. — [Best practices](https://code.claude.com/docs/en/best-practices)
- Model positioning (current docs, with API IDs): — [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview)
  - Haiku 5.5 (`claude-haiku-5-5`, from $0.10/$0.50 per MTok in/out): "high-volume, latency-sensitive tasks such as classification, extraction, and routing".
  - Sonnet 5.5 (`claude-sonnet-5-5`, $2/$10): "best combination of speed and intelligence".
  - Opus 5.5 (`claude-opus-5-5`, $4/$20): "long-running agentic coding and knowledge work". The docs say to start with it for most workloads.
  - Fable 5.1 (`claude-fable-5-1`, $10/$50): "demanding reasoning and long-horizon agentic work". Use it when evals on Opus 5.5 at higher effort still fall short.
- Claude Code docs: the default Opus 5.5 "handles most coding well", Sonnet "costs less on routine work", and Haiku "is a good fit for subagents doing simple jobs". — [Best practices](https://code.claude.com/docs/en/best-practices)

### Inferences
- Reasonable tiering for this project: Haiku for link and format checks, scraping or parsing sanity checks and fixture generation. Sonnet for most implementation. Opus (or the main session model) for architecture and reviewing the WhatsApp-sending logic. Fable is likely unnecessary.
- "Manager" mode means the main session plans, delegates self-contained pieces with explicit objective and output format, and verifies results by running them. It does not mean maximizing agent count.

### Gaps
- The "Choosing a model" page and the Claude Code model-config page were not opened directly. Positioning comes from the models overview and the best-practices page.
- Part of the subagents page (the last ~16k characters) was not read.

## 3. Safety of driving WhatsApp Web with browser or computer-use automation

### Takeaway
Anthropic says no browser agent is immune to prompt injection. It recommends isolation, minimal sensitive data, allowlists and human confirmation for consequential actions. WhatsApp message content is untrusted input.

### Cited Findings
- "No browser agent is immune to prompt injection." Even a 1% attack success rate "still represents meaningful risk". Reported rates for Best-of-N adaptive attacks with improved safeguards were about 1.4-2.4% across Opus 4.5, Sonnet 4/4.5 and Haiku 4.5. — [Prompt injection defenses](https://www.anthropic.com/research/prompt-injection-defenses)
- Claude for Chrome pilot: the attack success rate went from 23.6% without mitigations to 11.2% in autonomous mode. Claude asks before high-risk actions (publishing, purchasing, sharing personal data). Anthropic advises starting with trusted sites and avoiding sites with financial, legal, medical or other sensitive data. — [Claude for Chrome](https://claude.com/blog/claude-for-chrome)
- Computer-use docs recommend a dedicated VM or container with minimal privileges, keeping sensitive data (such as login info) away from the model, an allowlist of domains, and human confirmation for meaningful real-world consequences. Claude can follow commands found in page content that conflict with the user's instructions. — [Computer use tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)

### Inferences
- Having an agent drive the user's logged-in WhatsApp Web carries real risk: incoming chat text can contain injected instructions, and the session is a personal account. Safer designs:
  - Use agents only to build and test the bot.
  - Run the runtime sender as deterministic code (a workflow, not an agent) that sends only to a fixed allowlist of chats.
  - Use a separate browser profile or test number.
  - Require human confirmation for the first sends.
- Separately from prompt injection, automating a personal WhatsApp account can violate WhatsApp's terms. That is outside Anthropic's guidance and was not researched here.

### Gaps
- Anthropic's Help Center safety guide for Claude for Chrome was not retrieved. No Anthropic guidance specific to WhatsApp was found.
- Attack-rate figures come from different models and test sets and are not directly comparable. Only the 1.4-2.4% figures were taken from the primary research page.
