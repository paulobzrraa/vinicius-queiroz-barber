#!/usr/bin/env python3
"""
Importa o backlog (backlog.docx) para o GitHub: uma issue por item e um
GitHub Project para acompanhar o andamento.

Cada linha BL-xxx do backlog vira a issue "BL-xxx — Título", com a etiqueta
da coluna Labels. No project, as colunas Phase e Priority viram os campos
"Fase" e "Prioridade", e o Status começa em Todo.

Precisa do gh autenticado com acesso a projects:
  gh auth login -s project        (se já estiver logado: gh auth refresh -s project)

Uso:
  python3 scripts/backlog-para-github.py             # cria etiquetas, issues e project
  python3 scripts/backlog-para-github.py --dry-run   # só mostra o que faria

É seguro rodar de novo: issue com o mesmo ID não é recriada, item já no
project não é duplicado e campo já preenchido no project não é sobrescrito.
"""

from __future__ import annotations

import csv
import json
import os
import re
import shutil
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

REPO = os.environ.get("REPO", "paulobzrraa/vinicius-queiroz-barber")
OWNER = os.environ.get("OWNER", "paulobzrraa")
PROJECT_TITLE = os.environ.get("PROJECT_TITLE", "Vinicius Queiroz Barber")
DOC = Path(__file__).resolve().parent.parent / "backlog.docx"
DRY_RUN = "--dry-run" in sys.argv[1:]

GH = os.environ.get("GH") or shutil.which("gh") or str(Path.home() / ".local/bin/gh")
GH_ENV = {**os.environ, "GH_PROMPT_DISABLED": "1", "GH_NO_UPDATE_NOTIFIER": "1"}

HEADER = ["ID", "Title", "Description", "Phase", "Priority", "Labels"]

# Etiquetas da coluna Labels: nome -> (cor, descrição).
LABELS = {
    "frontend": ("1D76DB", "Interface e componentes"),
    "design": ("D4C5F9", "Identidade visual e design system"),
    "responsive": ("0E8A16", "Responsividade"),
    "animation": ("FBCA04", "Animações e microinterações"),
    "accessibility": ("5319E7", "Acessibilidade"),
    "performance": ("D93F0B", "Performance"),
    "seo": ("006B75", "SEO"),
    "qa": ("BFD4F2", "Testes e validação"),
}

FIELD_PHASE = "Fase"
FIELD_PRIORITY = "Prioridade"
FIELD_STATUS = "Status"
STATUS_INITIAL = "Todo"

# Prioridades na ordem de gravidade, com a cor da opção no project.
PRIORITY_COLORS = {"Critical": "RED", "High": "ORANGE", "Medium": "YELLOW", "Low": "GRAY"}
# Cores das fases, na ordem em que aparecem no backlog (repetem se houver mais fases).
PHASE_COLORS = ["GRAY", "BLUE", "PURPLE", "GREEN", "PINK", "YELLOW", "ORANGE", "RED"]

CREATE_FIELD = """
mutation($project: ID!, $name: String!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
  createProjectV2Field(input: {
    projectId: $project, dataType: SINGLE_SELECT, name: $name, singleSelectOptions: $options
  }) {
    projectV2Field { ... on ProjectV2SingleSelectField { id options { id name } } }
  }
}
"""

LINKED_REPOS = """
query($id: ID!) {
  node(id: $id) { ... on ProjectV2 { repositories(first: 50) { nodes { nameWithOwner } } } }
}
"""

PROJECT_ITEMS = """
query($id: ID!, $cursor: String) {
  node(id: $id) {
    ... on ProjectV2 {
      items(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          content { ... on Issue { url } ... on PullRequest { url } }
          fieldValues(first: 30) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2FieldCommon { name } }
              }
            }
          }
        }
      }
    }
  }
}
"""


# ------------------------------------------------------------------- gh
def gh(*args: str, stdin: str | None = None) -> str:
    result = subprocess.run(
        [GH, *args], input=stdin, capture_output=True, text=True, env=GH_ENV
    )
    if result.returncode != 0:
        sys.exit(f"Erro em `gh {' '.join(args[:3])}`:\n{result.stderr.strip()}")
    return result.stdout


def graphql(query: str, **variables) -> dict:
    body = json.dumps({"query": query, "variables": variables})
    return json.loads(gh("api", "graphql", "--input", "-", stdin=body))["data"]


def unique(values) -> list:
    """Remove repetidos mantendo a ordem de primeira aparição."""
    return list(dict.fromkeys(values))


# -------------------------------------------------------------- backlog
def read_backlog() -> list[dict]:
    """Lê o CSV que está como texto no backlog.docx, um registro por parágrafo."""
    if not DOC.exists():
        sys.exit(f"{DOC.name} não encontrado em {DOC.parent}")

    w = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    with zipfile.ZipFile(DOC) as docx:
        root = ET.fromstring(docx.read("word/document.xml"))
    lines = ["".join(t.text or "" for t in p.iter(w + "t")) for p in root.iter(w + "p")]
    rows = list(csv.reader(line for line in lines if line.strip()))

    if not rows or rows[0] != HEADER:
        sys.exit(f"Cabeçalho inesperado em {DOC.name}: {rows[0] if rows else '(vazio)'}")

    keys = ("id", "title", "description", "phase", "priority", "label")
    items = []
    for row in rows[1:]:
        if len(row) != len(HEADER) or not re.fullmatch(r"BL-\d{3}", row[0].strip()):
            sys.exit(f"Linha inválida em {DOC.name}: {row}")
        items.append(dict(zip(keys, (cell.strip() for cell in row))))

    ids = [item["id"] for item in items]
    repeated = sorted({i for i in ids if ids.count(i) > 1})
    if repeated:
        sys.exit(f"IDs repetidos em {DOC.name}: {repeated}")
    return items


def issue_title(item: dict) -> str:
    return f"{item['id']} — {item['title']}"


def issue_body(item: dict) -> str:
    return (
        f"{item['description']}\n\n"
        f"- **Fase:** {item['phase']}\n"
        f"- **Prioridade:** {item['priority']}\n\n"
        f"<sub>Importado de `{DOC.name}` ({item['id']}).</sub>\n"
    )


# ----------------------------------------------------------- pré-checagem
def check_access() -> None:
    if not Path(GH).exists() and not shutil.which(GH):
        sys.exit("gh não encontrado. Instale o GitHub CLI ou informe o caminho em GH=...")

    result = subprocess.run([GH, "auth", "status"], capture_output=True, text=True, env=GH_ENV)
    output = result.stdout + result.stderr
    if result.returncode != 0:
        sys.exit("gh não autenticado. Rode: gh auth login -s project")
    if "Token scopes" in output and "'project'" not in output:
        sys.exit("O token do gh não tem acesso a projects. Rode: gh auth refresh -s project")

    repo = json.loads(gh("repo", "view", REPO, "--json", "hasIssuesEnabled,visibility"))
    if not repo["hasIssuesEnabled"]:
        sys.exit(f"As issues estão desativadas em {REPO}.")
    print(f"Repositório {REPO} ({repo['visibility'].lower()})")


# ------------------------------------------------------------- etiquetas
def sync_labels(items: list[dict]) -> None:
    print("→ etiquetas")
    for name in unique(item["label"] for item in items):
        color, description = LABELS.get(name, ("EDEDED", ""))
        if DRY_RUN:
            print(f"  [dry-run] criaria ou atualizaria: {name}")
            continue
        # --force atualiza cor e descrição se a etiqueta já existir.
        gh("label", "create", name, "--repo", REPO, "--color", color,
           "--description", description, "--force")
        print(f"  ✓ {name}")


# ---------------------------------------------------------------- issues
def sync_issues(items: list[dict]) -> dict[str, str]:
    """Cria as issues que faltam. Devolve {ID do backlog: URL da issue}."""
    print("→ issues")
    existing: dict[str, str] = {}
    listed = gh("issue", "list", "--repo", REPO, "--state", "all", "--limit", "1000",
                "--json", "title,url")
    for issue in json.loads(listed):
        match = re.match(r"(BL-\d{3})\b", issue["title"])
        if match:
            existing.setdefault(match.group(1), issue["url"])

    urls: dict[str, str] = {}
    for item in items:
        if item["id"] in existing:
            urls[item["id"]] = existing[item["id"]]
            print(f"  = {item['id']} já existe: {existing[item['id']]}")
            continue
        if DRY_RUN:
            print(f"  [dry-run] criaria: {issue_title(item)}  [{item['label']}]")
            continue
        url = gh("issue", "create", "--repo", REPO, "--title", issue_title(item),
                 "--label", item["label"], "--body-file", "-", stdin=issue_body(item)).strip()
        urls[item["id"]] = url
        print(f"  + {url}")
        # Espaça as criações para ficar abaixo do limite secundário do GitHub.
        time.sleep(1)
    return urls


# --------------------------------------------------------------- project
def find_or_create_project() -> dict | None:
    print("→ project")
    listed = gh("project", "list", "--owner", OWNER, "--limit", "100", "--format", "json")
    for project in json.loads(listed)["projects"]:
        if project["title"] == PROJECT_TITLE:
            print(f"  = project #{project['number']} já existe")
            return project
    if DRY_RUN:
        print(f'  [dry-run] criaria o project "{PROJECT_TITLE}"')
        return None
    project = json.loads(gh("project", "create", "--owner", OWNER, "--title", PROJECT_TITLE,
                            "--format", "json"))
    print(f"  + project #{project['number']} criado")
    return project


def link_repo(project: dict) -> None:
    nodes = graphql(LINKED_REPOS, id=project["id"])["node"]["repositories"]["nodes"]
    if REPO.lower() in {node["nameWithOwner"].lower() for node in nodes}:
        print(f"  = já vinculado a {REPO}")
    elif DRY_RUN:
        print(f"  [dry-run] vincularia a {REPO}")
    else:
        gh("project", "link", str(project["number"]), "--owner", OWNER, "--repo", REPO)
        print(f"  + vinculado a {REPO}")


def ensure_fields(project: dict, items: list[dict]) -> dict[str, dict]:
    """Garante os campos Fase e Prioridade.

    Devolve os campos single select do project: {nome: {"id", "options": {opção: id}}}.
    """
    listed = gh("project", "field-list", str(project["number"]), "--owner", OWNER,
                "--limit", "100", "--format", "json")
    fields = {
        field["name"]: {"id": field["id"], "options": {o["name"]: o["id"] for o in field["options"]}}
        for field in json.loads(listed)["fields"]
        if "options" in field
    }

    severity = list(PRIORITY_COLORS)
    priorities = sorted(
        unique(item["priority"] for item in items),
        key=lambda p: severity.index(p) if p in severity else len(severity),
    )
    wanted = {
        FIELD_PHASE: [
            (name, PHASE_COLORS[n % len(PHASE_COLORS)])
            for n, name in enumerate(unique(item["phase"] for item in items))
        ],
        FIELD_PRIORITY: [(name, PRIORITY_COLORS.get(name, "GRAY")) for name in priorities],
    }

    for name, options in wanted.items():
        if name in fields:
            missing = [option for option, _ in options if option not in fields[name]["options"]]
            if missing:
                sys.exit(f'O campo "{name}" do project não tem as opções {missing}. '
                         "Adicione-as no project e rode de novo.")
            print(f'  = campo "{name}" já existe')
            continue
        if DRY_RUN:
            print(f'  [dry-run] criaria o campo "{name}": {", ".join(o for o, _ in options)}')
            continue
        created = graphql(
            CREATE_FIELD,
            project=project["id"],
            name=name,
            options=[{"name": o, "color": color, "description": ""} for o, color in options],
        )["createProjectV2Field"]["projectV2Field"]
        fields[name] = {"id": created["id"], "options": {o["name"]: o["id"] for o in created["options"]}}
        print(f'  + campo "{name}" criado')

    if STATUS_INITIAL not in fields.get(FIELD_STATUS, {}).get("options", {}):
        print(f'  ! o project não tem o Status "{STATUS_INITIAL}"; o Status ficará vazio')
    return fields


def project_items(project: dict) -> dict[str, dict]:
    """Itens já no project: {URL da issue: {"id": ID do item, "values": {campo: opção}}}."""
    items: dict[str, dict] = {}
    cursor = None
    while True:
        page = graphql(PROJECT_ITEMS, id=project["id"], cursor=cursor)["node"]["items"]
        for node in page["nodes"]:
            url = (node.get("content") or {}).get("url")
            if not url:
                continue  # rascunho, sem issue
            values = {
                value["field"]["name"]: value["name"]
                for value in node["fieldValues"]["nodes"]
                if value.get("field")
            }
            items[url] = {"id": node["id"], "values": values}
        if not page["pageInfo"]["hasNextPage"]:
            return items
        cursor = page["pageInfo"]["endCursor"]


def set_fields(project_id: str, item_id: str, updates: list[tuple[str, str]]) -> None:
    """Preenche vários campos single select de um item numa única mutation."""
    parts = [
        f"f{n}: updateProjectV2ItemFieldValue(input: {{"
        f"projectId: {json.dumps(project_id)}, itemId: {json.dumps(item_id)}, "
        f"fieldId: {json.dumps(field_id)}, value: {{singleSelectOptionId: {json.dumps(option_id)}}}"
        f"}}) {{ clientMutationId }}"
        for n, (field_id, option_id) in enumerate(updates)
    ]
    graphql("mutation { " + " ".join(parts) + " }")


def sync_items(project: dict, fields: dict[str, dict], items: list[dict], urls: dict[str, str]) -> None:
    print("→ itens do project")
    current = project_items(project)

    for item in items:
        wanted = {FIELD_PHASE: item["phase"], FIELD_PRIORITY: item["priority"],
                  FIELD_STATUS: STATUS_INITIAL}
        url = urls.get(item["id"])
        entry = current.get(url) if url else None

        if entry is None and DRY_RUN:
            filled = ", ".join(f"{f}={v}" for f, v in wanted.items())
            print(f"  [dry-run] adicionaria {item['id']} ({filled})")
            continue

        added = entry is None
        if added:
            result = gh("project", "item-add", str(project["number"]), "--owner", OWNER,
                        "--url", url, "--format", "json")
            entry = {"id": json.loads(result)["id"], "values": {}}

        # Só preenche campo vazio: o que foi mudado à mão no project fica como está.
        # Em dry-run o campo pode ainda não existir, então a prévia não depende das opções.
        pending = [
            (field, value) for field, value in wanted.items()
            if not entry["values"].get(field)
            and (DRY_RUN or value in fields.get(field, {}).get("options", {}))
        ]
        if pending and DRY_RUN:
            print(f"  [dry-run] preencheria {item['id']}: " + ", ".join(f"{f}={v}" for f, v in pending))
            continue
        if pending:
            set_fields(project["id"], entry["id"],
                       [(fields[f]["id"], fields[f]["options"][v]) for f, v in pending])

        if added:
            print(f"  + {item['id']} ({', '.join(f'{f}={v}' for f, v in pending)})")
        elif pending:
            print(f"  ~ {item['id']} preenchido: {', '.join(f'{f}={v}' for f, v in pending)}")
        else:
            print(f"  = {item['id']} já está no project")


# ------------------------------------------------------------------ main
def main() -> None:
    items = read_backlog()
    print(f"{len(items)} itens em {DOC.name}" + (" (dry-run: nada será alterado)" if DRY_RUN else ""))

    check_access()
    sync_labels(items)
    urls = sync_issues(items)

    project = find_or_create_project()
    if project is None:  # só em dry-run, quando o project ainda não existe
        print(f"  [dry-run] criaria os campos {FIELD_PHASE} e {FIELD_PRIORITY}, "
              f"vincularia a {REPO} e adicionaria os {len(items)} itens")
        return

    link_repo(project)
    fields = ensure_fields(project, items)
    sync_items(project, fields, items, urls)

    if not DRY_RUN:
        url = project.get("url") or f"https://github.com/users/{OWNER}/projects/{project['number']}"
        print(f"\nPronto: {url}")


if __name__ == "__main__":
    main()
