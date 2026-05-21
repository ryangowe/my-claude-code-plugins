"""Module layout skeleton — the canonical top-to-bottom section order.

A tiny but coherent module: copy the section order, not the contents.
Every section is optional, but when present must appear in this position.
See SKILL.md for the rules.
"""

# 1. imports — stdlib, then third-party, then absolute imports within
#    the package, then relative imports within the sub-package


# 2. private constants
_BACKOFF_BASE = 2.0


# 3. public classes
class Pipeline:
    """Class layout follows the same public-before-private discipline."""

    # class attributes
    version: int = 1

    # __init__
    def __init__(self, steps: list["_Step"]) -> None:
        self._steps = steps

    # public static / class methods
    @classmethod
    def empty(cls) -> "Pipeline":
        return cls([])

    # dunder methods
    def __len__(self) -> int:
        return len(self._steps)

    # public methods
    def run(self) -> list[str]:
        return [self._render(step) for step in self._steps]

    # private methods
    def _render(self, step: "_Step") -> str:
        return f"{self.version}:{step.name}"


# 4. public functions — may reference a private class via a string annotation
def build_pipeline(names: list[str]) -> Pipeline:
    return Pipeline([_load_step(name) for name in names])


# 5. private classes — defined after the public functions that use them
class _Step:
    def __init__(self, name: str, backoff: float) -> None:
        self.name = name
        self.backoff = backoff


# 6. private functions
def _load_step(name: str) -> _Step:
    return _Step(_normalize(name), _BACKOFF_BASE)


def _normalize(name: str) -> str:
    return name.strip().lower()


# 7. main function, if any
def main() -> None:
    pipeline = build_pipeline(["fetch", "transform", "load"])
    pipeline.run()


if __name__ == "__main__":
    main()
