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


def test_srs_preview_marks_draft_baseline_as_non_official(client, db_session):
    project, headers = _project_and_headers(db_session)
    baseline = ProjectBaseline(
        project_id=project.id,
        version=1,
        name="Bản nháp",
        status="draft",
        snapshot={
            "project_id": project.id,
            "entities": {
                "srs_document": [],
                "specification": [],
                "user_story": [],
            },
        },
        open_issues=[],
    )
    db_session.add(baseline)
    db_session.commit()
    db_session.refresh(baseline)

    response = client.get(
        f"/api/projects/{project.id}/specification-document?baseline_id={baseline.id}",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["baseline_status"] == "draft"
    assert body["is_official"] is False

def test_baseline_snapshot_includes_stable_keys_for_entities_and_trace_links(client, db_session):
    from database.models import Actor, RawRequirement, TraceLink

    project, headers = _project_and_headers(db_session)
    requirement = RawRequirement(
        project_id=project.id,
        content="Khách hàng đặt đơn hàng",
        status="draft",
    )
    actor = Actor(project_id=project.id, name="Khách hàng")
    db_session.add_all([requirement, actor])
    db_session.flush()
    trace = TraceLink(
        project_id=project.id,
        source_type="raw_requirement",
        source_id=requirement.id,
        target_type="actor",
        target_id=actor.id,
        relation_type="involves",
    )
    db_session.add(trace)
    db_session.commit()

    response = client.post(
        f"/api/projects/{project.id}/baselines",
        json={"name": "Baseline có mã ổn định"},
        headers=headers,
    )

    assert response.status_code == 200
    baseline_id = response.json()["id"]
    snapshot = client.get(
        f"/api/projects/{project.id}/baselines/{baseline_id}",
        headers=headers,
    ).json()["snapshot"]
    entities = snapshot["entities"]
    assert entities["raw_requirement"][0]["entity_key"].startswith("REQ-")
    assert entities["actor"][0]["entity_key"].startswith("ACT-")
    trace_snapshot = entities["trace_link"][0]
    assert trace_snapshot["source_entity_key"] == entities["raw_requirement"][0]["entity_key"]
    assert trace_snapshot["target_entity_key"] == entities["actor"][0]["entity_key"]
