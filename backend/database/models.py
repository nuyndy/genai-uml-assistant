from sqlalchemy import Column, Integer, String, Text, ForeignKey, TIMESTAMP, Index
from sqlalchemy.sql import func
from database.db import Base
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB

JSONBCompat = JSON().with_variant(JSONB, "postgresql")
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    google_id = Column(String, unique=True, nullable=True, index=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


class Project(Base):
    __tablename__ = "project"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", name="fk_project_user_id_users"),
        nullable=True,
        index=True,
    )
    name = Column(String, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    description = Column(Text, nullable=True)
    updated_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        onupdate=func.now(),
    )


class RawRequirement(Base):
    __tablename__ = "raw_requirement"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("project.id"), nullable=False)
    content = Column(Text, nullable=False)
    status = Column(String, default="draft")

    actor = Column(String, nullable=True)
    action = Column(String, nullable=True)
    target_object = Column(String, nullable=True)
    purpose = Column(Text, nullable=True)
    normalized_text = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    title = Column(String, nullable=True)
    as_a = Column(String, nullable=True)
    i_want_to = Column(String, nullable=True)
    so_that = Column(Text, nullable=True)
    acceptance_criteria = Column(Text, nullable=True)
    technical_notes = Column(Text, nullable=True)


class UserStory(Base):
    __tablename__ = "user_story"

    id = Column(Integer, primary_key=True, index=True)
    requirement_id = Column(
        Integer,
        ForeignKey("raw_requirement.id"),
        nullable=False,
    )
    role = Column(String)
    feature = Column(Text, nullable=False)
    benefit = Column(Text)
    acceptance_criteria = Column(Text)
    technical_notes = Column(Text, nullable=True)


class Specification(Base):
    __tablename__ = "specification"
    id = Column(Integer, primary_key=True, index=True)
    user_story_id = Column(Integer, ForeignKey("user_story.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("project.id"), nullable=True, index=True)
    type = Column(String)
    content = Column(Text, nullable=False)
    version = Column(Integer, default=1)

    __table_args__ = (
        Index(
            "uq_specification_story_type",
            "user_story_id",
            "type",
            unique=True,
            sqlite_where=user_story_id.is_not(None),
            postgresql_where=user_story_id.is_not(None),
        ),
        Index(
            "uq_specification_project_type",
            "project_id",
            "type",
            unique=True,
            sqlite_where=project_id.is_not(None),
            postgresql_where=project_id.is_not(None),
        ),
    )


class SrsDocument(Base):
    __tablename__ = "srs_document"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("project.id"), nullable=False, unique=True)
    intro_purpose = Column(Text, nullable=False, default="")
    intro_scope = Column(Text, nullable=False, default="")
    intro_definitions = Column(Text, nullable=False, default="")
    overview_user_classes = Column(Text, nullable=False, default="")
    overview_environment = Column(Text, nullable=False, default="")
    appendix_notes = Column(Text, nullable=False, default="")
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class UseCase(Base):
    __tablename__ = "use_case"
    id = Column(Integer, primary_key=True, index=True)
    specification_id = Column(Integer, ForeignKey("specification.id"), nullable=False)
    name = Column(String, nullable=False)
    main_flow = Column(Text)
    alt_flow = Column(Text)
    exception_flow = Column(Text)


class Actor(Base):
    __tablename__ = "actor"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("project.id"), nullable=False)
    name = Column(String, nullable=False)


class UcActorRelation(Base):
    __tablename__ = "uc_actor_relation"
    id = Column(Integer, primary_key=True, index=True)
    use_case_id = Column(Integer, ForeignKey("use_case.id"), nullable=False)
    actor_id = Column(Integer, ForeignKey("actor.id"), nullable=False)
    relation_type = Column(String)


class ClassEntity(Base):
    __tablename__ = "class_entity"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("project.id"), nullable=False)
    name = Column(String, nullable=False)
    attributes = Column(Text)
    methods = Column(Text)


class ClassRelation(Base):
    __tablename__ = "class_relation"
    id = Column(Integer, primary_key=True, index=True)
    class_a_id = Column(Integer, ForeignKey("class_entity.id"), nullable=False)
    class_b_id = Column(Integer, ForeignKey("class_entity.id"), nullable=False)
    relation_type = Column(String)


class Diagram(Base):
    __tablename__ = "diagram"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("project.id"), nullable=False)
    use_case_id = Column(Integer, ForeignKey("use_case.id"), nullable=True)
    type = Column(String)
    source_code = Column(Text, nullable=False)
    image_url = Column(String)
    version = Column(Integer, default=1)


class DiagramRevision(Base):
    __tablename__ = "diagram_revision"

    id = Column(Integer, primary_key=True, index=True)
    diagram_id = Column(
        Integer,
        ForeignKey("diagram.id", ondelete="CASCADE"),
        nullable=False,
    )
    version = Column(Integer, nullable=False)
    source_code = Column(Text, nullable=False)
    image_url = Column(String, nullable=True)
    change_type = Column(String(30), nullable=False, default="edit")
    created_at = Column(
        TIMESTAMP,
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        Index(
            "uq_diagram_revision_version",
            "diagram_id",
            "version",
            unique=True,
        ),
        Index("ix_diagram_revision_diagram_id", "diagram_id"),
        Index("ix_diagram_revision_created_at", "created_at"),
    )

class GlossaryTerm(Base):
    __tablename__ = "glossary_term"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer,
        ForeignKey("project.id", ondelete="CASCADE"),
        nullable=False,
    )
    term = Column(String(255), nullable=False)
    canonical_term = Column(String(255), nullable=False)
    aliases = Column(JSONBCompat, nullable=False, server_default="[]")
    definition = Column(Text, nullable=False, server_default="")
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        Index(
            "uq_glossary_project_term",
            "project_id",
            "canonical_term",
            unique=True,
        ),
        Index("ix_glossary_project", "project_id"),
    )


class TraceLink(Base):
    __tablename__ = "trace_link"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer,
        ForeignKey("project.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_type = Column(String(50), nullable=False)
    source_id = Column(Integer, nullable=False)
    target_type = Column(String(50), nullable=False)
    target_id = Column(Integer, nullable=False)
    relation_type = Column(
        String(50),
        nullable=False,
        server_default="traces_to",
    )
    rationale = Column(Text, nullable=False, server_default="")
    validation_status = Column(
        String(20),
        nullable=False,
        server_default="pending",
    )
    validation_message = Column(Text, nullable=False, server_default="")
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        Index(
            "uq_trace_link",
            "project_id",
            "source_type",
            "source_id",
            "target_type",
            "target_id",
            "relation_type",
            unique=True,
        ),
        Index("ix_trace_link_project", "project_id"),
        Index(
            "ix_trace_link_source",
            "project_id",
            "source_type",
            "source_id",
        ),
        Index(
            "ix_trace_link_target",
            "project_id",
            "target_type",
            "target_id",
        ),
    )


class ProjectBaseline(Base):
    __tablename__ = "project_baseline"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer,
        ForeignKey("project.id", ondelete="CASCADE"),
        nullable=False,
    )
    version = Column(Integer, nullable=False)
    name = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, server_default="draft")
    snapshot = Column(JSONBCompat, nullable=False)
    open_issues = Column(JSONBCompat, nullable=False, server_default="[]")
    created_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    approved_at = Column(TIMESTAMP(timezone=True), nullable=True)

    __table_args__ = (
        Index(
            "uq_project_baseline_version",
            "project_id",
            "version",
            unique=True,
        ),
        Index(
            "ix_project_baseline_project",
            "project_id",
            "version",
        ),
    )


class EntityRevision(Base):
    __tablename__ = "entity_revision"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer,
        ForeignKey("project.id", ondelete="CASCADE"),
        nullable=False,
    )
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    version = Column(Integer, nullable=False)
    content = Column(JSONBCompat, nullable=False)
    change_type = Column(
        String(30),
        nullable=False,
        server_default="update",
    )
    change_note = Column(Text, nullable=False, server_default="")
    created_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        Index(
            "uq_entity_revision_version",
            "project_id",
            "entity_type",
            "entity_id",
            "version",
            unique=True,
        ),
        Index(
            "ix_entity_revision_lookup",
            "project_id",
            "entity_type",
            "entity_id",
            "version",
        ),
    )
