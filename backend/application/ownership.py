from sqlalchemy.orm import Session, aliased

from database.models import (
    Actor,
    ClassEntity,
    ClassRelation,
    Diagram,
    Project,
    RawRequirement,
    Specification,
    UcActorRelation,
    UseCase,
    UserStory,
)


def resolve_project_id(
    db: Session,
    path_params: dict[str, str],
    path: str,
) -> int | None:
    """Resolve the project owning a resource identified by API path parameters."""
    if "project_id" in path_params:
        return int(path_params["project_id"])

    if "requirement_id" in path_params:
        return (
            db.query(RawRequirement.project_id)
            .filter(RawRequirement.id == int(path_params["requirement_id"]))
            .scalar()
        )

    if "story_id" in path_params or "user_story_id" in path_params:
        story_id = int(path_params.get("story_id", path_params.get("user_story_id", "")))
        return (
            db.query(RawRequirement.project_id)
            .join(UserStory, UserStory.requirement_id == RawRequirement.id)
            .filter(UserStory.id == story_id)
            .scalar()
        )

    if "specification_id" in path_params:
        specification_id = int(path_params["specification_id"])
        story_project_id = (
            db.query(RawRequirement.project_id)
            .join(UserStory, UserStory.requirement_id == RawRequirement.id)
            .join(Specification, Specification.user_story_id == UserStory.id)
            .filter(Specification.id == specification_id)
            .scalar()
        )
        if story_project_id is not None:
            return story_project_id
        return (
            db.query(Specification.project_id)
            .filter(
                Specification.id == specification_id,
                Specification.user_story_id.is_(None),
            )
            .scalar()
        )

    if "use_case_id" in path_params:
        use_case_id = int(path_params["use_case_id"])
        return (
            db.query(RawRequirement.project_id)
            .join(UserStory, UserStory.requirement_id == RawRequirement.id)
            .join(Specification, Specification.user_story_id == UserStory.id)
            .join(UseCase, UseCase.specification_id == Specification.id)
            .filter(UseCase.id == use_case_id)
            .scalar()
        )

    if "actor_id" in path_params:
        return (
            db.query(Actor.project_id)
            .filter(Actor.id == int(path_params["actor_id"]))
            .scalar()
        )

    if "class_id" in path_params:
        return (
            db.query(ClassEntity.project_id)
            .filter(ClassEntity.id == int(path_params["class_id"]))
            .scalar()
        )

    if "diagram_id" in path_params:
        return (
            db.query(Diagram.project_id)
            .filter(Diagram.id == int(path_params["diagram_id"]))
            .scalar()
        )

    if "relation_id" in path_params:
        relation_id = int(path_params["relation_id"])
        if path.startswith("/api/class-relations/"):
            class_a = aliased(ClassEntity)
            class_b = aliased(ClassEntity)
            class_project_ids = (
                db.query(class_a.project_id, class_b.project_id)
                .join(ClassRelation, ClassRelation.class_a_id == class_a.id)
                .join(class_b, ClassRelation.class_b_id == class_b.id)
                .filter(ClassRelation.id == relation_id)
                .first()
            )
            if class_project_ids is None or class_project_ids[0] != class_project_ids[1]:
                return None
            return class_project_ids[0]

        return (
            db.query(RawRequirement.project_id)
            .join(UserStory, UserStory.requirement_id == RawRequirement.id)
            .join(Specification, Specification.user_story_id == UserStory.id)
            .join(UseCase, UseCase.specification_id == Specification.id)
            .join(UcActorRelation, UcActorRelation.use_case_id == UseCase.id)
            .join(Actor, Actor.id == UcActorRelation.actor_id)
            .filter(
                UcActorRelation.id == relation_id,
                Actor.project_id == RawRequirement.project_id,
            )
            .scalar()
        )

    return None


def user_owns_project(db: Session, *, project_id: int, user_id: int) -> bool:
    """Check project ownership without exposing persistence details to routers."""
    return (
        db.query(Project.id)
        .filter(
            Project.id == project_id,
            Project.user_id == user_id,
        )
        .first()
        is not None
    )
