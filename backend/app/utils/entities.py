import re
from typing import Final, Literal, TypedDict

MAX_ENTITIES_PER_TYPE: Final[int] = 50
MIN_ENTITY_LENGTH: Final[int] = 3
MAX_ENTITY_LENGTH: Final[int] = 90
MIN_PERSON_WORDS: Final[int] = 2


class NamedEntities(TypedDict):
    people: list[str]
    organizations: list[str]
    locations: list[str]


_ENTITY_CONNECTORS: Final[set[str]] = {
    "de",
    "del",
    "la",
    "las",
    "los",
    "y",
    "e",
    "el",
    "da",
    "do",
    "dos",
    "of",
    "the",
    "and",
    "for",
}

_ENTITY_STOPWORDS: Final[set[str]] = {
    "A",
    "An",
    "By",
    "El",
    "Esta",
    "Estas",
    "Este",
    "Estos",
    "La",
    "Las",
    "Los",
    "News",
    "Noticias",
    "Opinion",
    "Published",
    "That",
    "The",
    "This",
    "Un",
    "Una",
    "Updated",
}

_COUNTRY_ALIASES: Final[dict[str, str]] = {
    "ee uu": "Estados Unidos",
    "ee. uu": "Estados Unidos",
    "ee. uu.": "Estados Unidos",
    "eeuu": "Estados Unidos",
    "e.e.u.u": "Estados Unidos",
    "e.e.u.u.": "Estados Unidos",
    "estados unidos": "Estados Unidos",
    "estados unidos de américa": "Estados Unidos",
    "usa": "Estados Unidos",
    "u.s.": "Estados Unidos",
    "u.s.a.": "Estados Unidos",
    "us": "Estados Unidos",
    "united states": "Estados Unidos",
    "united states of america": "Estados Unidos",
}

_GENERIC_ENTITY_TERMS: Final[set[str]] = {
    "administración",
    "administration",
    "ciudad",
    "city",
    "congreso",
    "country",
    "departamento",
    "department",
    "el gobierno",
    "estado",
    "fiscalía",
    "gobierno",
    "government",
    "ministerio",
    "ministry",
    "nación",
    "nation",
    "organización",
    "organización mundial",
    "organization",
    "país",
    "policía",
    "police",
    "presidencia",
    "province",
    "provincia",
    "región",
    "region",
    "state",
    "territory",
    "territorio",
}

_PERSON_BLOCKLIST: Final[set[str]] = {
    "américa latina",
    "america latina",
    "casa blanca",
    "medio oriente",
    "mv hondius",
    "palacio nacional",
    "real madrid",
}

_NON_PERSON_WORDS: Final[set[str]] = {
    "américa",
    "america",
    "blanca",
    "casa",
    "club",
    "comisión",
    "committee",
    "congress",
    "congreso",
    "east",
    "estado",
    "estados",
    "fiscalía",
    "gobierno",
    "hondius",
    "latina",
    "madrid",
    "medio",
    "ministerio",
    "national",
    "oriente",
    "palace",
    "palacio",
    "real",
    "unidos",
}

_KNOWN_ORGANIZATIONS: Final[set[str]] = {
    "Casa Blanca",
    "Comisión de Hacienda",
    "Fiscalía General",
    "Ministerio Público",
    "MV Hondius",
    "Real Madrid",
}

_ORG_KEYWORDS: Final[tuple[str, ...]] = (
    "administration",
    "agency",
    "airlines",
    "army",
    "assembly",
    "association",
    "bank",
    "cabinet",
    "commission",
    "committee",
    "company",
    "congress",
    "court",
    "department",
    "embassy",
    "foundation",
    "government",
    "institute",
    "ministry",
    "municipality",
    "nation",
    "office",
    "organization",
    "party",
    "police",
    "reuters",
    "senate",
    "university",
    "administración",
    "agencia",
    "alcaldía",
    "asamblea",
    "asociación",
    "banco",
    "cancillería",
    "comisión",
    "comité",
    "corte",
    "ejército",
    "embajada",
    "empresa",
    "fiscalía",
    "fundación",
    "gobierno",
    "iglesia",
    "instituto",
    "ministerio",
    "nación",
    "organización",
    "partido",
    "policía",
    "presidencia",
    "procuraduría",
    "régimen",
    "universidad",
)

_KNOWN_LOCATIONS: Final[set[str]] = {
    "Africa",
    "Alberta",
    "America",
    "Argentina",
    "Asia",
    "Brazil",
    "Canada",
    "Chile",
    "China",
    "Colombia",
    "Costa Rica",
    "Cuba",
    "Dominican Republic",
    "Ecuador",
    "El Salvador",
    "Europe",
    "Florida",
    "Guatemala",
    "Honduras",
    "Iran",
    "Israel",
    "Managua",
    "Mexico",
    "Miami",
    "Nicaragua",
    "Panama",
    "Russia",
    "Spain",
    "United States",
    "Venezuela",
    "África",
    "América",
    "América Latina",
    "Brasil",
    "Canadá",
    "España",
    "Estados Unidos",
    "Europa",
    "Irán",
    "México",
    "Panamá",
    "República Dominicana",
    "Rusia",
    "Medio Oriente",
    "Palacio Nacional",
}

_LOCATION_HINTS: Final[tuple[str, ...]] = (
    "city",
    "country",
    "province",
    "state",
    "territory",
    "ciudad",
    "departamento",
    "estado",
    "municipio",
    "país",
    "provincia",
    "territorio",
)

_ENTITY_PATTERN = re.compile(
    r"\b(?:[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÜÑáéíóúüñ.'-]+|[A-Z]{2,})"
    r"(?:\s+(?:de|del|la|las|los|y|e|el|da|do|dos|of|the|and|for)\s+"
    r"(?:[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÜÑáéíóúüñ.'-]+|[A-Z]{2,})|"
    r"\s+(?:[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÜÑáéíóúüñ.'-]+|[A-Z]{2,})){0,5}"
)


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _entity_key(value: str) -> str:
    key = _normalize_text(value).strip(" ,;:.|-()[]{}\"'").casefold()
    key = re.sub(r"\s+", " ", key)
    return re.sub(r"\be\.?\s*e\.?\s*u\.?\s*u\.?\b", "eeuu", key)


def _normalize_entity_value(value: str) -> str:
    cleaned = _normalize_text(value).strip(" ,;:.|-()[]{}\"'")
    key = _entity_key(cleaned)
    return _COUNTRY_ALIASES.get(key, cleaned)


def normalize_entity_for_type(  # noqa: PLR0911
    entity_type: Literal["people", "organizations", "locations"],
    value: str,
) -> str | None:
    cleaned = _normalize_entity_value(value)
    if len(cleaned) < MIN_ENTITY_LENGTH or len(cleaned) > MAX_ENTITY_LENGTH:
        return None

    key = _entity_key(cleaned)
    if key in _COUNTRY_ALIASES:
        return "Estados Unidos" if entity_type == "locations" else None

    if key in _GENERIC_ENTITY_TERMS:
        return None

    if entity_type == "people":
        if key in _PERSON_BLOCKLIST:
            return None

        words = [word for word in re.split(r"\s+", key) if word not in _ENTITY_CONNECTORS]
        if len(words) < MIN_PERSON_WORDS:
            return None

        if any(word in _NON_PERSON_WORDS for word in words):
            return None

        if cleaned in _KNOWN_LOCATIONS or cleaned in _KNOWN_ORGANIZATIONS:
            return None

    if entity_type == "organizations":
        if cleaned in _KNOWN_LOCATIONS:
            return None

    if entity_type == "locations":
        if cleaned in _KNOWN_ORGANIZATIONS:
            return None

    return cleaned


def _normalize_string_list(values: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()

    for item in values:
        cleaned = _normalize_entity_value(item)
        if not cleaned:
            continue

        key = cleaned.casefold()
        if key in seen:
            continue

        seen.add(key)
        result.append(cleaned)

        if len(result) >= MAX_ENTITIES_PER_TYPE:
            break

    return result


def _append_entity(target: list[str], value: str) -> None:
    cleaned = _normalize_entity_value(value)
    if len(cleaned) < MIN_ENTITY_LENGTH:
        return

    key = cleaned.casefold()
    if any(item.casefold() == key for item in target):
        return

    target.append(cleaned)


def _looks_like_entity(value: str) -> bool:
    if len(value) < MIN_ENTITY_LENGTH or len(value) > MAX_ENTITY_LENGTH:
        return False

    words = value.split()
    meaningful = [word for word in words if word.casefold() not in _ENTITY_CONNECTORS]
    if not meaningful:
        return False

    if len(meaningful) == 1 and meaningful[0] in _ENTITY_STOPWORDS:
        return False

    return not value.endswith((" dijo", " afirmó", " señaló", " informó"))


def _classify_entity(  # noqa: PLR0911
    value: str,
) -> Literal["people", "organizations", "locations"] | None:
    value = _normalize_entity_value(value)
    lowered = value.casefold()

    if _entity_key(value) in _COUNTRY_ALIASES:
        return "locations"

    if value in _KNOWN_LOCATIONS:
        return "locations"

    if value in _KNOWN_ORGANIZATIONS:
        return "organizations"

    if any(keyword in lowered for keyword in _ORG_KEYWORDS):
        return "organizations"

    if any(hint in lowered for hint in _LOCATION_HINTS):
        return "locations"

    words = [word for word in value.split() if word.casefold() not in _ENTITY_CONNECTORS]
    if len(words) >= MIN_PERSON_WORDS:
        return "people"

    return None


def _candidate_variants(value: str) -> list[str]:
    cleaned = _normalize_text(value).strip(" ,;:|-()[]{}\"'")
    if not cleaned:
        return []

    variants = [cleaned]

    for raw_sentence_part in re.split(r"\.\s+", cleaned):
        sentence_part = raw_sentence_part.strip(" ,;:.|-()[]{}\"'")
        if sentence_part and sentence_part not in variants:
            variants.append(sentence_part)

    for part in list(variants):
        for raw_side in re.split(r"\s+y\s+", part):
            side = raw_side.strip(" ,;:.|-()[]{}\"'")
            if side and side not in variants:
                variants.append(side)

    return variants


def extract_named_entities(full_text: str) -> NamedEntities:
    entities: NamedEntities = {"people": [], "organizations": [], "locations": []}
    text = _normalize_text(full_text)
    if not text:
        return entities

    for match in _ENTITY_PATTERN.finditer(text):
        for candidate in _candidate_variants(match.group(0)):
            if not _looks_like_entity(candidate):
                continue

            entity_type = _classify_entity(candidate)
            if entity_type is None:
                continue

            normalized = normalize_entity_for_type(entity_type, candidate)
            if normalized is None:
                continue

            _append_entity(entities[entity_type], normalized)
        if all(len(values) >= MAX_ENTITIES_PER_TYPE for values in entities.values()):
            break

    return {
        "people": _normalize_string_list(entities["people"]),
        "organizations": _normalize_string_list(entities["organizations"]),
        "locations": _normalize_string_list(entities["locations"]),
    }
