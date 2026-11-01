import pytest

from application.projects import (
    ProjectNotFoundError,
    create_project,
    delete_project,
    list_projects,
)
from database.models import Project, User


def _user(db_session):
    user = User(
        email="project-application@example.com",
        name="Project Application",
        google_id="project-application-google-id",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_project_application_create_and_list(db_session):
    user = _user(db_session)

    created = create_project(db_session, user_id=user.id, name="Application project")
    projects = list_projects(db_session, user.id)

    assert created.id is not None
    assert created.name == "Application project"
    assert [project.id for project in projects] == [created.id]


def test_project_application_delete_removes_owned_project(db_session):
    user = _user(db_session)
    project = Project(name="Delete through application", user_id=user.id)
    db_session.add(project)
    db_session.commit()
    project_id = project.id

    delete_project(db_session, project_id=project_id, user_id=user.id)

    assert db_session.get(Project, project_id) is None


def test_project_application_does_not_delete_another_users_project(db_session):
    owner = _user(db_session)
    other_user = User(
        email="another-user@example.com",
        name="Another User",
        google_id="another-user-google-id",
    )
    db_session.add(other_user)
    db_session.flush()
    project = Project(name="Protected project", user_id=owner.id)
    db_session.add(project)
    db_session.commit()

    with pytest.raises(ProjectNotFoundError):
        delete_project(
            db_session,
            project_id=project.id,
            user_id=other_user.id,
        )

    assert db_session.get(Project, project.id) is not None
