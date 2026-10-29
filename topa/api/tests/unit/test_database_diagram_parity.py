import re
from dataclasses import dataclass
from pathlib import Path

import pytest

import topa_api.adapters.db.models  # noqa: F401
from topa_api.adapters.db.base import Base


@dataclass(frozen=True)
class ErdTable:
    """Represents a table and its columns in a Mermaid ER diagram."""

    name: str
    columns: frozenset[str]


@dataclass(frozen=True)
class ErdSchema:
    """Holds tables parsed from a Mermaid ER diagram."""

    tables: dict[str, ErdTable]

    @property
    def table_names(self) -> set[str]:
        return set(self.tables.keys())

    def get_columns(self, table_name: str) -> set[str]:
        if table_name not in self.tables:
            raise KeyError(f"Table '{table_name}' not found in ERD schema")
        return set(self.tables[table_name].columns)


def find_repo_root(start_path: Path | None = None) -> Path:
    """Locate the repository root containing docs/banco-de-dados.md."""
    current = (start_path or Path(__file__)).resolve()
    candidates = [current, *current.parents] if current.is_dir() else list(current.parents)
    for parent in candidates:
        if (parent / "docs" / "banco-de-dados.md").is_file():
            return parent
    raise FileNotFoundError("Could not find repository root containing docs/banco-de-dados.md")


def extract_mermaid_erd(markdown_content: str) -> str:
    """Extract the mermaid erDiagram fenced block from markdown text."""
    pattern = re.compile(r"```mermaid\s*\n(.*?)```", re.DOTALL)
    for match in pattern.finditer(markdown_content):
        block = match.group(1)
        if "erDiagram" in block:
            return block
    raise ValueError("No Mermaid erDiagram block found in markdown content")


def parse_mermaid_erd(erd_text: str) -> ErdSchema:
    """Parse table definitions and column names from a Mermaid ERD."""
    table_pattern = re.compile(r"^[ \t]*([A-Za-z0-9_]+)[ \t]*\{([^}]*)\}", re.MULTILINE)
    tables: dict[str, ErdTable] = {}
    for match in table_pattern.finditer(erd_text):
        table_name = match.group(1)
        body = match.group(2)
        columns: set[str] = set()
        for raw_line in body.splitlines():
            line = raw_line.strip()
            if not line or line.startswith("%%"):
                continue
            parts = line.split()
            if len(parts) < 2:
                raise ValueError(f"Malformed column definition in table '{table_name}': {line!r}")
            columns.add(parts[1])
        tables[table_name] = ErdTable(name=table_name, columns=frozenset(columns))
    return ErdSchema(tables=tables)


def load_docs_erd_schema(doc_path: Path) -> ErdSchema:
    """Read a markdown file and parse its Mermaid ERD schema."""
    content = doc_path.read_text(encoding="utf-8")
    block = extract_mermaid_erd(content)
    return parse_mermaid_erd(block)


def check_schema_parity(erd: ErdSchema) -> None:
    """Assert full parity between the ERD schema and SQLAlchemy metadata."""
    model_tables = set(Base.metadata.tables.keys())
    missing_tables = model_tables - erd.table_names
    extra_tables = erd.table_names - model_tables
    assert erd.table_names == model_tables, (
        f"Table mismatch between ERD and Base.metadata.\n"
        f"Missing in ERD: {sorted(missing_tables)}\n"
        f"Extra in ERD: {sorted(extra_tables)}"
    )

    for table_name, table in Base.metadata.tables.items():
        erd_columns = erd.get_columns(table_name)
        model_columns = set(table.columns.keys())
        missing_columns = model_columns - erd_columns
        extra_columns = erd_columns - model_columns
        assert erd_columns == model_columns, (
            f"Column mismatch for table '{table_name}' between ERD and Base.metadata.\n"
            f"Missing in ERD: {sorted(missing_columns)}\n"
            f"Extra in ERD: {sorted(extra_columns)}"
        )


def test_database_diagram_matches_base_metadata() -> None:
    repo_root = find_repo_root()
    doc_path = repo_root / "docs" / "banco-de-dados.md"
    erd = load_docs_erd_schema(doc_path)
    check_schema_parity(erd)


def test_find_repo_root_from_directory(tmp_path: Path) -> None:
    fake_docs = tmp_path / "docs"
    fake_docs.mkdir()
    (fake_docs / "banco-de-dados.md").write_text("test")
    nested = tmp_path / "a" / "b"
    nested.mkdir(parents=True)
    assert find_repo_root(nested) == tmp_path


def test_find_repo_root_missing(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="Could not find repository root"):
        find_repo_root(tmp_path)


def test_extract_mermaid_erd_no_block() -> None:
    with pytest.raises(ValueError, match="No Mermaid erDiagram block found"):
        extract_mermaid_erd("# Documentation\nNo mermaid here.")


def test_extract_mermaid_erd_no_erdiagram() -> None:
    markdown = "```mermaid\ngraph TD\n  A --> B\n```"
    with pytest.raises(ValueError, match="No Mermaid erDiagram block found"):
        extract_mermaid_erd(markdown)


def test_parse_mermaid_erd_malformed_column() -> None:
    erd_text = "erDiagram\nstores {\ninvalid\n}"
    with pytest.raises(
        ValueError, match=re.escape("Malformed column definition in table 'stores'")
    ):
        parse_mermaid_erd(erd_text)


def test_parse_mermaid_erd_skips_comments_and_blank_lines() -> None:
    erd_text = """
    erDiagram
        stores {
            %% comment line
            text slug PK

            text name
        }
    """
    schema = parse_mermaid_erd(erd_text)
    assert schema.table_names == {"stores"}
    assert schema.get_columns("stores") == {"slug", "name"}


def test_erd_schema_get_columns_unknown_table() -> None:
    schema = ErdSchema(tables={})
    with pytest.raises(KeyError, match=re.escape("Table 'nonexistent' not found in ERD schema")):
        schema.get_columns("nonexistent")


def test_check_schema_parity_reports_missing_table() -> None:
    schema = ErdSchema(tables={})
    with pytest.raises(AssertionError, match=r"Table mismatch between ERD and Base\.metadata"):
        check_schema_parity(schema)


def test_check_schema_parity_reports_extra_table() -> None:
    repo_root = find_repo_root()
    doc_path = repo_root / "docs" / "banco-de-dados.md"
    erd = load_docs_erd_schema(doc_path)
    tables = dict(erd.tables)
    tables["extra_table"] = ErdTable(name="extra_table", columns=frozenset({"col"}))
    schema = ErdSchema(tables=tables)
    with pytest.raises(AssertionError, match=re.escape("Extra in ERD: ['extra_table']")):
        check_schema_parity(schema)


def test_check_schema_parity_reports_missing_column() -> None:
    repo_root = find_repo_root()
    doc_path = repo_root / "docs" / "banco-de-dados.md"
    erd = load_docs_erd_schema(doc_path)
    tables = dict(erd.tables)
    tables["stores"] = ErdTable(name="stores", columns=frozenset({"slug"}))
    schema = ErdSchema(tables=tables)
    with pytest.raises(AssertionError, match=re.escape("Column mismatch for table 'stores'")):
        check_schema_parity(schema)


def test_check_schema_parity_reports_extra_column() -> None:
    repo_root = find_repo_root()
    doc_path = repo_root / "docs" / "banco-de-dados.md"
    erd = load_docs_erd_schema(doc_path)
    tables = dict(erd.tables)
    tables["stores"] = ErdTable(
        name="stores",
        columns=frozenset({"slug", "name", "ghost_col"}),
    )
    schema = ErdSchema(tables=tables)
    with pytest.raises(AssertionError, match=re.escape("Extra in ERD: ['ghost_col']")):
        check_schema_parity(schema)
