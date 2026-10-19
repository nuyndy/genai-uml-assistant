"""Regression tests for baseline drift reporting API."""
import time

from database.models import Project, ProjectBaseline, RawRequirement, User
from routers import auth


def _project_and_headers(db_session, email="baseline-drift@example.com"):
    user = User(
        email=email,
        name="Baseline Drift Test",
        google_id=f"{email}-google-id",
    )
    db_session.add(user)
    db_session.flush()
    project = Project(name="Baseline Drift Project", user_id=user.id)
    db_session.add(project)
    db_session.commit()
    token = auth._sign({"uid": user.id, "exp": time.time() + 60})
    return project, {"Authorization": f"Bearer {token}"}


def test_drift_endpoint_reports_new_requirement(client, db_session):
    project, headers = _project_and_headers(db_session)
    baseline = ProjectBaseline(
        project_id=project.id,
        version=1,
        name="Đã duyệt",
        status="approved",
        snapshot={"project_id": project.id, "entities": {
            "raw_requirement": [],
            "actor": [],
            "class_entity": [],
            "diagram": [],
            "glossary_term": [],
            "srs_document": [],
            "entity_revision": [],
            "trace_link": [],
            "specification": [],
            "use_case": [],
            "uc_actor_relation": [],
            "user_story": [],
            "class_relation": [],
            "diagram_revision": [],
        }},
        open_issues=[],
    )
    db_session.add(baseline)
    db_session.commit()

    db_session.add(RawRequirement(
        project_id=project.id,
        content="Người dùng có thể đăng nhập",
        status="confirmed",
    ))
    db_session.commit()

    response = client.get(
        f"/api/projects/{project.id}/baselines/{baseline.id}/drift",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["review_required"] is True
    assert "raw_requirement" in body["changed_entity_types"]
    change = next(item for item in body["changes"] if item["entity_type"] == "raw_requirement")
    assert change["added_ids"]


def test_drift_endpoint_rejects_baseline_from_another_project(client, db_session):
    project, headers = _project_and_headers(db_session, "baseline-drift-owner@example.com")
    other_user = User(
        email="baseline-drift-other@example.com",
        name="Other Owner",
        google_id="baseline-drift-other-google-id",
    )
    db_session.add(other_user)
    db_session.flush()
    other_project = Project(name="Other Project", user_id=other_user.id)
    db_session.add(other_project)
    db_session.flush()
    baseline = ProjectBaseline(
        project_id=other_project.id,
        version=1,
        name="Private",
        status="approved",
        snapshot={"project_id": other_project.id, "entities": {}},
        open_issues=[],
    )
    db_session.add(baseline)
    db_session.commit()

    response = client.get(
        f"/api/projects/{project.id}/baselines/{baseline.id}/drift",
        headers=headers,
    )

    assert response.status_code == 404



def test_review_status_reports_drift_and_unresolved_issues(client, db_session):
    project, headers = _project_and_headers(db_session, "baseline-review-status@example.com")
    baseline = ProjectBaseline(
        project_id=project.id,
        version=1,
        name="Baseline cần rà soát",
        status="approved",
        snapshot={"project_id": project.id, "entities": {
            "raw_requirement": [],
            "actor": [],
            "class_entity": [],
            "diagram": [],
            "glossary_term": [],
            "srs_document": [],
            "entity_revision": [],
            "trace_link": [],
            "specification": [],
            "use_case": [],
            "uc_actor_relation": [],
            "user_story": [],
            "class_relation": [],
            "diagram_revision": [],
        }},
        open_issues=[
            {"id": "issue-1", "status": "open", "description": "Cần rà soát luồng ngoại lệ"},
            {"id": "issue-2", "status": "accepted", "acceptance_reason": "Được chấp nhận trong phạm vi phiên bản"},
        ],
    )
    db_session.add(baseline)
    db_session.commit()
    db_session.add(RawRequirement(
        project_id=project.id,
        content="Người dùng có thể đăng nhập",
        status="confirmed",
    ))
    db_session.commit()

    response = client.get(
        f"/api/projects/{project.id}/baselines/{baseline.id}/review-status",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["review_required"] is True
    assert body["data_drift"] is True
    assert body["unresolved_issue_count"] == 1
    assert body["accepted_issue_count"] == 1
    assert body["unresolved_issues"][0]["id"] == "issue-1"


def test_review_status_marks_draft_baseline_as_requiring_review(client, db_session):
    project, headers = _project_and_headers(db_session, "baseline-review-draft@example.com")
    baseline = ProjectBaseline(
        project_id=project.id,
        version=1,
        name="Bản nháp",
        status="draft",
        snapshot={"project_id": project.id, "entities": {
            "raw_requirement": [],
            "actor": [],
            "class_entity": [],
            "diagram": [],
            "glossary_term": [],
            "srs_document": [],
            "entity_revision": [],
            "trace_link": [],
            "specification": [],
            "use_case": [],
            "uc_actor_relation": [],
            "user_story": [],
            "class_relation": [],
            "diagram_revision": [],
        }},
        open_issues=[],
    )
    db_session.add(baseline)
    db_session.commit()

    response = client.get(
        f"/api/projects/{project.id}/baselines/{baseline.id}/review-status",
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["review_required"] is True
    assert response.json()["baseline_status"] == "draft"
