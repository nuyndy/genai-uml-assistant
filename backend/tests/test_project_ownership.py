import json
import time

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
    User,
    UserStory,
)
from routers import auth


def _create_user(db_session, email, google_id):
    user = User(email=email, name=email, google_id=google_id)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = auth._sign({"uid": user.id, "exp": time.time() + 60})
    return user, {"Authorization": f"Bearer {token}"}


def test_project_list_and_create_are_scoped_to_authenticated_user(
    client, db_session
):
    owner, owner_headers = _create_user(
        db_session, "owner@example.com", "owner-google-id"
    )
    other, other_headers = _create_user(
        db_session, "other@example.com", "other-google-id"
    )
    owned_project = Project(name="Owner project", user_id=owner.id)
    db_session.add(owned_project)
    db_session.commit()

    listed = client.get("/api/projects", headers=other_headers)
    assert listed.status_code == 200
    assert listed.json() == []

    created = client.post(
        "/api/projects",
        json={"name": "Other project"},
        headers=other_headers,
    )
    assert created.status_code == 201
    created_project = db_session.get(Project, created.json()["id"])
    assert created_project.user_id == other.id
    assert client.get("/api/projects", headers=owner_headers).json() == [
        {
            "id": owned_project.id,
            "name": "Owner project",
            "created_at": owned_project.created_at.isoformat(),
        }
    ]


def test_stage_resources_are_hidden_from_users_who_do_not_own_project(
    client, db_session
):
    owner, _ = _create_user(db_session, "stage-owner@example.com", "stage-owner")
    _, other_headers = _create_user(
        db_session, "stage-other@example.com", "stage-other"
    )
    project = Project(name="Private project", user_id=owner.id)
    db_session.add(project)
    db_session.flush()
    requirement = RawRequirement(
        project_id=project.id,
        content=json.dumps(
            {
                "actor": "Student",
                "action": "borrow",
                "target_object": "book",
                "purpose": "read",
                "pre_conditions": [],
                "business_rules": [],
            }
        ),
        status="draft",
    )
    db_session.add(requirement)
    db_session.flush()
    story = UserStory(
        requirement_id=requirement.id,
        role="Student",
        feature="borrow book",
    )
    actor = Actor(project_id=project.id, name="Student")
    db_session.add_all([story, actor])
    db_session.flush()
    specification = Specification(
        user_story_id=story.id,
        type="functional",
        content="Borrow a book",
        version=1,
    )
    db_session.add(specification)
    db_session.flush()
    use_case = UseCase(specification_id=specification.id, name="Borrow book")
    db_session.add(use_case)
    db_session.commit()

    urls = [
        f"/api/projects/{project.id}/requirements",
        f"/api/requirements/{requirement.id}",
        f"/api/projects/{project.id}/user-stories",
        f"/api/user-stories/{story.id}",
        f"/api/user-stories/{story.id}/specifications",
        f"/api/specifications/{specification.id}",
        f"/api/projects/{project.id}/actors",
        f"/api/use-cases/{use_case.id}",
    ]
    for url in urls:
        response = client.get(url, headers=other_headers)
        assert response.status_code == 404, url

    response = client.patch(
        f"/api/actors/{actor.id}",
        json={"name": "Changed name"},
        headers=other_headers,
    )
    assert response.status_code == 404


def test_legacy_unowned_projects_are_not_visible_or_accessible(client, db_session):
    _, headers = _create_user(
        db_session, "legacy-check@example.com", "legacy-check"
    )
    project = Project(name="Unassigned legacy project")
    db_session.add(project)
    db_session.commit()

    assert client.get("/api/projects", headers=headers).json() == []
    response = client.get(
        f"/api/projects/{project.id}/requirements",
        headers=headers,
    )
    assert response.status_code == 404


def test_owner_can_delete_project_and_all_dependent_records(client, db_session):
    owner, owner_headers = _create_user(
        db_session, "delete-owner@example.com", "delete-owner"
    )
    _, other_headers = _create_user(
        db_session, "delete-other@example.com", "delete-other"
    )
    project = Project(name="Project to delete", user_id=owner.id)
    db_session.add(project)
    db_session.flush()
    requirement = RawRequirement(
        project_id=project.id,
        content=json.dumps({"actor": "Student"}),
        status="draft",
    )
    actor = Actor(project_id=project.id, name="Student")
    class_a = ClassEntity(project_id=project.id, name="Book")
    class_b = ClassEntity(project_id=project.id, name="Loan")
    db_session.add_all([requirement, actor, class_a, class_b])
    db_session.flush()
    story = UserStory(requirement_id=requirement.id, feature="Borrow book")
    db_session.add(story)
    db_session.flush()
    specification = Specification(
        user_story_id=story.id,
        type="functional",
        content="Borrow a book",
        version=1,
    )
    db_session.add(specification)
    db_session.flush()
    use_case = UseCase(specification_id=specification.id, name="Borrow book")
    db_session.add(use_case)
    db_session.flush()
    db_session.add_all(
        [
            UcActorRelation(
                use_case_id=use_case.id,
                actor_id=actor.id,
                relation_type="association",
            ),
            ClassRelation(
                class_a_id=class_a.id,
                class_b_id=class_b.id,
                relation_type="association",
            ),
            Diagram(
                project_id=project.id,
                use_case_id=use_case.id,
                type="sequence",
                source_code="@startuml\n@enduml",
            ),
        ]
    )
    db_session.commit()
    project_id = project.id

    denied = client.delete(
        f"/api/projects/{project_id}",
        headers=other_headers,
    )
    assert denied.status_code == 404
    assert db_session.get(Project, project_id) is not None

    deleted = client.delete(
        f"/api/projects/{project_id}",
        headers=owner_headers,
    )
    assert deleted.status_code == 204
    db_session.expire_all()
    assert db_session.get(Project, project_id) is None
    assert db_session.query(RawRequirement).count() == 0
    assert db_session.query(UserStory).count() == 0
    assert db_session.query(Specification).count() == 0
    assert db_session.query(UseCase).count() == 0
    assert db_session.query(Actor).count() == 0
    assert db_session.query(UcActorRelation).count() == 0
    assert db_session.query(ClassEntity).count() == 0
    assert db_session.query(ClassRelation).count() == 0
    assert db_session.query(Diagram).count() == 0
