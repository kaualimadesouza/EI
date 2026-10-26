"""The error-to-status table is kept by hand and has no fallback: a new domain
error missing from it would answer 500. This closes that drift."""

from topa_api.domain.errors import DomainError
from topa_api.presentation.fastapi.errors import ERROR_STATUS


def _concrete_errors() -> set[type[DomainError]]:
    found: set[type[DomainError]] = set()
    pending = [DomainError]
    while pending:
        for subclass in pending.pop().__subclasses__():
            found.add(subclass)
            pending.append(subclass)
    return found


def test_every_domain_error_has_a_status() -> None:
    assert sorted(error.__name__ for error in _concrete_errors() - ERROR_STATUS.keys()) == []


def test_the_table_lists_no_error_that_no_longer_exists() -> None:
    assert sorted(error.__name__ for error in ERROR_STATUS.keys() - _concrete_errors()) == []
