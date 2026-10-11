import re
from typing import List, Dict, Any


def _strip_quotes(s: str) -> str:
    """Remove surrounding double quotes if present."""
    s = s.strip()
    if s.startswith('"') and s.endswith('"'):
        return s[1:-1]
    return s


def parse_plantuml(source_code: str) -> Dict[str, Any]:
    """Parse a subset of PlantUML syntax used by the app.

    Returns a dictionary with keys:
        - actors: List[{'name': str}]
        - use_cases: List[{'name': str}]
        - classes: List[{'name': str, 'attributes': List[str], 'methods': List[str]}]
        - relations: List[{'from': str, 'to': str, 'type': str, 'label': str | None}]

    The parser is deliberately tolerant: it ignores lines it cannot understand
    and does not raise on syntax errors. This prevents breaking the UI when
    the user writes unsupported PlantUML constructs.
    """
    # Normalise line endings and remove surrounding @startuml/@enduml if present
    lines = [ln.strip() for ln in source_code.replace('\r', '\n').split('\n') if ln.strip()]
    if lines and lines[0].lower().startswith('@startuml'):
        lines = lines[1:]
    if lines and lines[-1].lower().startswith('@enduml'):
        lines = lines[:-1]

    actors: List[Dict[str, str]] = []
    use_cases: List[Dict[str, str]] = []
    classes: List[Dict[str, Any]] = []
    relations: List[Dict[str, Any]] = []

    # State for class parsing
    current_class: Dict[str, Any] | None = None

    # Regex patterns (simple, enough for the supported subset)
    actor_pat = re.compile(r'^actor\s+"?([^\"]+)"?\s+as\s+(\w+)', re.IGNORECASE)
    actor_simple_pat = re.compile(r'^actor\s+"?([^\"]+)"?', re.IGNORECASE)
    usecase_pat = re.compile(r'^usecase\s+"?([^\"]+)"?\s+as\s+(\w+)', re.IGNORECASE)
    usecase_simple_pat = re.compile(r'^usecase\s+"?([^\"]+)"?', re.IGNORECASE)
    class_start_pat = re.compile(r'^class\s+"?([^\"]+)"?\s+as\s+(\w+)\s*\{', re.IGNORECASE)
    class_end_pat = re.compile(r'^\}$')
    relation_pat = re.compile(r'^(\w+)\s*([\-\.]{1,3}[\>\-])\s*(\w+)(?:\s*:\s*(.+))?$', re.IGNORECASE)

    for line in lines:
        # End of class definition
        if current_class and class_end_pat.match(line):
            classes.append(current_class)
            current_class = None
            continue

        # Inside class definition – attributes or methods
        if current_class:
            # Very naive: treat anything containing '(' as method, else attribute
            if '(' in line and ')' in line:
                current_class['methods'].append(line)
            else:
                current_class['attributes'].append(line)
            continue

        # Actor (full syntax)
        m = actor_pat.match(line)
        if m:
            name = _strip_quotes(m.group(1))
            actors.append({'name': name})
            continue
        # Actor simple (no alias)
        m = actor_simple_pat.match(line)
        if m:
            name = _strip_quotes(m.group(1))
            actors.append({'name': name})
            continue

        # Use case (full syntax)
        m = usecase_pat.match(line)
        if m:
            name = _strip_quotes(m.group(1))
            use_cases.append({'name': name})
            continue
        # Use case simple
        m = usecase_simple_pat.match(line)
        if m:
            name = _strip_quotes(m.group(1))
            use_cases.append({'name': name})
            continue

        # Class start
        m = class_start_pat.match(line)
        if m:
            name = _strip_quotes(m.group(1))
            current_class = {'name': name, 'attributes': [], 'methods': []}
            continue

        # Relation line
        m = relation_pat.match(line)
        if m:
            src, arrow, dst, label = m.group(1), m.group(2), m.group(3), m.group(4)
            # Normalise arrow to relation type hint
            rel_type = {
                '-->': 'association',
                '..>': 'dependency',
                '--|>': 'inheritance',
                '*--': 'composition',
                'o--': 'aggregation',
            }.get(arrow.strip(), 'association')
            relations.append({
                'from': src,
                'to': dst,
                'type': rel_type,
                'label': label.strip() if label else None,
            })
            continue

        # Anything else is ignored – tolerant parsing
        continue

    # If a class block was never closed, add it anyway
    if current_class:
        classes.append(current_class)

    return {
        'actors': actors,
        'use_cases': use_cases,
        'classes': classes,
        'relations': relations,
    }

# Simple sanity test when run directly
if __name__ == '__main__':
    sample = '''
    @startuml
    actor "User" as U
    usecase "Login" as LC
    class "Account" as A {\n  +id: int\n  +email: str\n  login()\n}\n    U --> LC : uses
    A --> LC : implements
    @enduml
    '''
    import json, sys
    print(json.dumps(parse_plantuml(sample), ensure_ascii=False, indent=2))
