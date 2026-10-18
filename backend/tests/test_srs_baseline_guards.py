"""Regression tests for official SRS export baseline gates."""
import time

from database.models import Project, ProjectBaseline, User
from routers import auth


def _project_and_headers(db_session):
    user = User(
        email="srs-baseline@example.com",
        name="SRS Baseline Test",
        google_id="srs-baseline-test-google-id",
    )
    db_session.add(user)
    db_session.flush()
    project = Project(name="SRS Baseline Test Project", user_id=user.id)
    db_session.add(project)
    db_session.commit()
    db_session.refresh(user)
    db_session.refresh(project)
    token = auth._sign({"uid": user.id, "exp": time.time() + 60})
    return project, {"Authorization": f"Bearer {token}"}


def test_export_rejects_explicit_draft_baseline(client, db_session):
    project, headers = _project_and_headers(db_session)
    baseline = ProjectBaseline(
        project_id=project.id,
        version=1,
        name="Bản nháp",
        status="draft",
        snapshot={"project_id": project.id, "entities": {"specification": []}},
        open_issues=[],
    )
    db_session.add(baseline)
    db_session.commit()
    db_session.refresh(baseline)

    response = client.post(
        f"/api/projects/{project.id}/specification-document/export?baseline_id={baseline.id}",
        json={"format": "docx"},
        headers=headers,
    )

    assert response.status_code == 409
    assert "baseline đã được duyệt" in response.json()["detail"]


def test_export_without_approved_baseline_is_rejected(client, db_session):
    project, headers = _project_and_headers(db_session)

    response = client.post(
        f"/api/projects/{project.id}/specification-document/export",
        json={"format": "docx"},
        headers=headers,
    )

    assert response.status_code == 409
    assert "Chưa có baseline được duyệt" in response.json()["detail"]


def test_export_rejects_snapshot_with_wrong_project_id(client, db_session):
    project, headers = _project_and_headers(db_session)
    baseline = ProjectBaseline(
        project_id=project.id,
        version=1,
        name="Baseline sai project",
        status="approved",
        snapshot={"project_id": project.id + 999, "entities": {"specification": []}},
        open_issues=[],
    )
    db_session.add(baseline)
    db_session.commit()
    db_session.refresh(baseline)

    response = client.post(
        f"/api/projects/{project.id}/specification-document/export?baseline_id={baseline.id}",
        json={"format": "docx"},
        headers=headers,
    )

    assert response.status_code == 409
    assert "Snapshot baseline không hợp lệ" in response.json()["detail"]
