# Guide / tutorial skeleton

<!-- Reader: someone who wants to accomplish a specific task. -->

<!-- They follow steps top-to-bottom. Each step must be verifiable — -->

<!-- "you should now see X" — before moving to the next. -->

<!-- Don't insert background that isn't needed for the current step. -->

# Build a data pipeline

By the end of this guide you will have a working pipeline that reads
CSV files, transforms rows, and writes results to PostgreSQL.

## Prerequisites

- Python 3.12+
- A running PostgreSQL instance (see [setup guide](postgres-setup.md)
  if you don't have one)
- `pip install pipeline-sdk`

<!-- List every prerequisite upfront. A reader who doesn't meet them -->

<!-- should bail here, not after step 5. -->

## 1. Create the project

```bash
pipeline init my-pipeline
cd my-pipeline
```

You should now have a `pipeline.toml` and an empty `steps/` directory.

## 2. Define a source

Create `steps/read_csv.py`:

```python
from pipeline_sdk import Source

class ReadCSV(Source):
    def run(self, ctx):
        return ctx.read_csv("input.csv")
```

Run `pipeline check` — it should print `1 source found`.

<!-- Each step ends with a verification command or observable result. -->

## 3. Add a transform

...

## 4. Connect a sink

...

## Next steps

- [Configuration reference](config.md) — all `pipeline.toml` options
- [Deploying to production](deploy.md)

<!-- "Next steps" links to related docs, not more tutorial. -->

<!-- The guide ends when the task is done. -->
