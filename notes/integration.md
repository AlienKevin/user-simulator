# Dropping a custom-trained user simulator into `with-user`

## TL;DR

`with-user` calls the user-sim via **`litellm.completion`** from
`src/withuser/user_sim.py`. There is **no Python class to subclass and
no native HTTP client to swap**: you serve your trained model behind
an **OpenAI-compatible `/v1/chat/completions` endpoint** (vLLM, SGLang,
TGI's OpenAI route, llama.cpp `--api`, Ollama in OpenAI mode, etc.) and
point litellm at it with the `openai/<your-model-id>` prefix plus
`OPENAI_API_BASE` (or `--user-model` + `api_base` in `model_kwargs`).

The user-sim is **stateful within a single instance**: a fresh
conversation is started per task. Every call sends the full message
history. The model must output a single JSON object with the schema
`{"decision": "continue" | "interject", "message": "<text>"}`.

## 1. The exact call site

`src/withuser/user_sim.py:97-122`:

```python
response = litellm.completion(
    model=cfg.model_name,          # e.g. "openai/my-user-sim"
    messages=api_messages,         # OpenAI chat format, full history
    **cfg.model_kwargs,            # temperature, max_tokens, drop_params, api_base, ...
)
...
text = response.choices[0].message.content or ""
self.messages.append({"role": "assistant", "content": text})
return self._parse(text)
```

Implications for your serving stack:

- Must accept OpenAI `messages=[{"role": "system"|"user"|"assistant", "content": "..."}]`.
- Returns one assistant text completion (no tool calls required, no
  streaming required).
- Output is parsed by regex (`re.search(r"\{.*\}", text, re.DOTALL)`) +
  `json.loads`. Anything outside the JSON is discarded. Empty / invalid
  output silently falls back to `continue`.

## 2. Chat template your model must support

A run sends, in order:

1. `system`: rendered `system_template` (see `with-user-prompts.md`, ~1 KB).
2. `user`: rendered `initial_template` with `{{problem_statement}}` (the gold SWE-bench problem statement, can be 0.5–5 KB).
3. `assistant`: your reply, must be a JSON object containing the opening message.
4. `user`: rendered `step_template` after agent step 1.
5. `assistant`: JSON `{"decision": ..., "message": ...}`.
6. … repeats for every step where the user-sim is consulted (gated by `intervene_every` and `max_interjections`).

Concretely, what your model should output **every turn**:

```json
{"decision": "interject", "message": "I'm hitting an error when I call foo() with an empty list — it's supposed to return []."}
```

or

```json
{"decision": "continue", "message": ""}
```

Train / SFT on exactly this schema. The system prompt already describes
it, but if your model is a base model you'll want to bake it in.

## 3. Serving recipe (vLLM example)

```bash
# 1. Serve your model on an OpenAI-compatible port
vllm serve /path/to/your/user-sim \
    --served-model-name my-user-sim \
    --port 8000 \
    --host 0.0.0.0 \
    --api-key dummy        # litellm requires *some* key, even "EMPTY"

# 2. Point with-user at it
export OPENAI_API_BASE="http://localhost:8000/v1"
export OPENAI_API_KEY="dummy"

# 3. Run
with-user run \
    --benchmark swebench --harness mini-swe-agent \
    --subset verified --split test --slice 0:5 \
    --model openai/gpt-5 \
    --user-model openai/my-user-sim \
    -c agent.user_sim.model_kwargs.temperature=0.7 \
    -c agent.user_sim.model_kwargs.max_tokens=800 \
    -c agent.user_sim.model_kwargs.drop_params=true \
    -w 5 -o runs/demo
```

Notes:

- `--user-model` is set verbatim into `cfg.agent.user_sim.model_name`
  (see `cli.py:121`). The `openai/` prefix tells litellm to use its
  OpenAI client.
- litellm reads `OPENAI_API_BASE` and `OPENAI_API_KEY` from the env. If
  you don't want to set env vars globally you can instead inject them
  per call:

  ```bash
  -c agent.user_sim.model_kwargs.api_base=http://localhost:8000/v1 \
  -c agent.user_sim.model_kwargs.api_key=dummy
  ```

- `drop_params=true` is recommended — if your server rejects unknown
  fields (e.g. `parallel_tool_calls`, certain sampling params), litellm
  will silently drop them.

## 4. Env vars / config knobs cheat-sheet

| What | Where | Why |
|---|---|---|
| `OPENAI_API_BASE=http://host:port/v1` | env | litellm OpenAI route target. |
| `OPENAI_API_KEY=...` | env | Any non-empty string for self-hosted. |
| `--user-model openai/<served-name>` | CLI | Overrides `agent.user_sim.model_name`. The `openai/` prefix is required so litellm picks the OpenAI client. |
| `-c agent.user_sim.model_kwargs.api_base=...` | CLI override | Per-call alternative to env var. |
| `-c agent.user_sim.model_kwargs.api_key=...` | CLI override | Per-call alternative to env var. |
| `-c agent.user_sim.model_kwargs.temperature=0.7` | CLI override | Sampling. |
| `-c agent.user_sim.model_kwargs.max_tokens=800` | CLI override | Reply cap; the default config sets 800. |
| `-c agent.user_sim.model_kwargs.drop_params=true` | CLI override | Have litellm drop kwargs your server rejects. |
| `-c agent.user_sim.intervene_every=1` | CLI override | Step gate. Default 1. |
| `-c agent.user_sim.max_interjections=8` | CLI override | Hard cap per run. Default 8. |
| `-c agent.user_sim.system_template=...` | CLI override | If you trained against a different system prompt, override it here (or ship a YAML config via `-c path/to/your.yaml`). |
| `-c agent.user_sim.initial_template=...` | CLI override | Same for opening prompt. |
| `-c agent.user_sim.step_template=...` | CLI override | Same for step prompt. |

## 5. Anthropic cache-control caveat

`user_sim.py:104` sniffs the model name for any of
`{"anthropic", "claude", "sonnet", "opus", "haiku"}` and, if found,
imports `minisweagent.models.utils.cache_control.set_cache_control` and
attaches an Anthropic-style cache breakpoint to the last message. **Do
not name your served model anything containing those substrings** —
otherwise the OpenAI-compatible server will receive a payload with
`cache_control` blocks and likely 400 (or silently mangle the content
shape). Safe names: `my-user-sim`, `user-sim-v1`, etc.

## 6. Custom system prompt (if your model was trained with one)

If your trained model expects a different system prompt than the
shipped one, the cleanest path is a YAML overlay:

```yaml
# my-user-sim.yaml
agent:
  user_sim:
    model_name: "openai/my-user-sim"
    model_kwargs:
      api_base: "http://localhost:8000/v1"
      api_key: "dummy"
      temperature: 0.7
      max_tokens: 800
      drop_params: true
    system_template: |
      <your trained system prompt here>
    initial_template: |
      <your trained opening prompt; must contain {{problem_statement}}>
    step_template: |
      <your trained step prompt; must contain {{step}}, {{assistant_text}}, {{observation}}, {{task}}>
```

Run with `-c my-user-sim.yaml`. The CLI merges recursively over the
packaged default (`cli.py:_load_yaml_config`), so you only need to
specify the fields you're changing.

**Required Jinja variables** (must appear in your templates, or rendering
will raise `UndefinedError` due to `StrictUndefined`):

- `initial_template`: `{{problem_statement}}`
- `step_template`: `{{step}}`, `{{assistant_text}}`, `{{observation}}`, `{{task}}`

## 7. End-to-end smoke test (no docker, no SWE-bench)

```python
from withuser.user_sim import UserSim, UserSimConfig
import importlib.resources, yaml

cfg_yaml = yaml.safe_load(
    importlib.resources.files("withuser.configs")
    .joinpath("swebench__mini_swe_agent.yaml").read_text()
)
us_cfg = cfg_yaml["agent"]["user_sim"]
us_cfg["model_name"] = "openai/my-user-sim"
us_cfg["model_kwargs"]["api_base"] = "http://localhost:8000/v1"
us_cfg["model_kwargs"]["api_key"] = "dummy"

us = UserSim(UserSimConfig(**us_cfg), render_context={"task": "demo task"})
print(us.opening("App crashes when I upload a 0-byte file."))
print(us.decide(step=1, assistant_text="ls /testbed", observation="manage.py app/", original_task="App crashes when I upload a 0-byte file."))
```

If both calls return non-empty, well-formed dict outputs, the
integration is good.
