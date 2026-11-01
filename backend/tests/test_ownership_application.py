import pytest

from application.ownership import resolve_project_id


def test_resolve_project_id_from_project_path_parameter(db_session):
    assert resolve_project_id(
        db_session,
        {"project_id": "42"},
        "/api/projects/42",
    ) == 42


def test_resolve_project_id_returns_none_for_unknown_resource_path(db_session):
    assert resolve_project_id(
        db_session,
        {},
        "/api/resources",
    ) is None


def test_resolve_project_id_rejects_non_numeric_project_id(db_session):
    with pytest.raises(ValueError):
        resolve_project_id(
            db_session,
            {"project_id": "not-a-number"},
            "/api/projects/not-a-number",
        )


def test_user_owns_project_checks_owner(db_session):
    from database.models import Project

    project = Project(name="Owned project", user_id=101)
    db_session.add(project)
    db_session.commit()

    from application.ownership import user_owns_project

    assert user_owns_project(
        db_session,
        project_id=project.id,
        user_id=101,
    )
    assert not user_owns_project(
        db_session,
        project_id=project.id,
        user_id=202,
    )
