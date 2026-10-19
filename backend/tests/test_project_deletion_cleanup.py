import time

from database.models import (
    Actor,
    ClassEntity,
    ClassRelation,
    Diagram,
    DiagramRevision,
    EntityRevision,
    GlossaryTerm,
    Project,
    ProjectBaseline,
    RawRequirement,
    Specification,
    SpecificationApproval,
    SrsDocument,
    TraceLink,
    UcActorRelation,
    UseCase,
    User,
    UserStory,
)
from routers import auth


def test_delete_project_removes_all_dependent_records(client, db_session):
    user = User(
        email="project-delete@example.com",
        name="Project Delete",
        google_id="project-delete-google-id",
    )
    db_session.add(user)
    db_session.flush()
    project = Project(name="Project to delete", user_id=user.id)
    db_session.add(project)
    db_session.flush()

    requirement = RawRequirement(
        project_id=project.id,
        content='{"actor":"Người dùng"}',
        status="confirmed",
    )
    db_session.add(requirement)
    db_session.flush()
    story = UserStory(
        requirement_id=requirement.id,
        role="Người dùng",
        feature="Quản lý dữ liệu",
        benefit="Dữ liệu chính xác",
    )
    db_session.add(story)
    db_session.flush()

    functional_spec = Specification(
        user_story_id=story.id,
        type="functional",
        content="{}",
        version=1,
    )
    nonfunctional_spec = Specification(
        project_id=project.id,
        type="non_functional",
        content="{}",
        version=1,
    )
    db_session.add_all([functional_spec, nonfunctional_spec])
    db_session.flush()

    use_case = UseCase(
        specification_id=functional_spec.id,
        name="Cập nhật dữ liệu",
        main_flow="[]",
        alt_flow="[]",
        exception_flow="[]",
    )
    actor = Actor(project_id=project.id, name="Người dùng")
    class_a = ClassEntity(project_id=project.id, name="TaiKhoan")
    class_b = ClassEntity(project_id=project.id, name="HoSo")
    db_session.add_all([use_case, actor, class_a, class_b])
    db_session.flush()

    relation = UcActorRelation(
        use_case_id=use_case.id,
        actor_id=actor.id,
        relation_type="association",
    )
    class_relation = ClassRelation(
        class_a_id=class_a.id,
        class_b_id=class_b.id,
        relation_type="association",
    )
    diagram = Diagram(
        project_id=project.id,
        use_case_id=use_case.id,
        type="sequence",
        source_code="@startuml\\n@enduml",
        image_url=None,
        version=1,
    )
    db_session.add_all([relation, class_relation, diagram])
    db_session.flush()

    db_session.add_all([
        DiagramRevision(
            diagram_id=diagram.id,
            version=1,
            source_code="@startuml\\n@enduml",
            change_type="create",
        ),
        SpecificationApproval(specification_id=functional_spec.id, status="approved"),
        SpecificationApproval(specification_id=nonfunctional_spec.id, status="approved"),
        SrsDocument(project_id=project.id),
        TraceLink(
            project_id=project.id,
            source_type="requirement",
            source_id=requirement.id,
            target_type="user_story",
            target_id=story.id,
            relation_type="traces_to",
        ),
        ProjectBaseline(
            project_id=project.id,
            version=1,
            name="Baseline 1",
            status="approved",
            snapshot={},
            open_issues=[],
        ),
        GlossaryTerm(
            project_id=project.id,
            term="Tài khoản",
            canonical_term="tai-khoan",
            aliases=[],
            definition="Thông tin đăng nhập",
        ),
        EntityRevision(
            project_id=project.id,
            entity_type="requirement",
            entity_id=requirement.id,
            version=1,
            content={"status": "confirmed"},
        ),
    ])
    db_session.commit()
    project_id = project.id

    token = auth._sign({"uid": user.id, "exp": time.time() + 60})
    response = client.delete(
        f"/api/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 204
    assert db_session.get(Project, project_id) is None
    for model in (
        RawRequirement,
        UserStory,
        Specification,
        SpecificationApproval,
        UseCase,
        Actor,
        UcActorRelation,
        ClassEntity,
        ClassRelation,
        Diagram,
        DiagramRevision,
        SrsDocument,
        TraceLink,
        ProjectBaseline,
        GlossaryTerm,
        EntityRevision,
    ):
        assert db_session.query(model).count() == 0, model.__name__
