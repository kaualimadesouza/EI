from typing import Protocol


class ReadinessProbe(Protocol):
    """Whether the dependencies the API cannot serve without are answering."""

    def database_is_up(self) -> bool: ...
