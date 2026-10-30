import json
import time
from unittest.mock import patch

from database.models import Project, RawRequirement, Specification, User, UserStory
from routers import auth


def test_standard_stage_one_routes_are_registered_once(client):
    expected = {
        ("POST", "/api/projects/{project_id}/requirements"),
        ("POST", "/api/projects/{project_id}/requirements/coverage-check"),
        ("POST", "/api/projects/{project_id}/requirements/batch"),
        ("GET", "/api/projects/{project_id}/requirements"),
        ("POST", "/api/projects/{project_id}/requirements/analyze-batch"),
        ("POST", "/api/projects/{project_id}/requirements/user-stories/preview"),
        ("POST", "/api/projects/{project_id}/requirements/confirm-batch"),
        ("GET", "/api/requirements/{requirement_id}"),
        ("PATCH", "/api/requirements/{requirement_id}"),
        ("DELETE", "/api/requirements/{requirement_id}"),
        ("POST", "/api/requirements/{requirement_id}/analyze"),
        ("POST", "/api/requirements/{requirement_id}/confirm"),
        ("GET", "/api/projects/{project_id}/user-stories"),
        ("GET", "/api/user-stories/{story_id}"),
        ("PATCH", "/api/user-stories/{story_id}"),
        ("DELETE", "/api/user-stories/{story_id}"),
        ("POST", "/api/user-stories/{user_story_id}/specifications"),
        ("POST", "/api/projects/{project_id}/user-stories/generate-specs-batch"),
        ("GET", "/api/user-stories/{user_story_id}/specifications"),
        ("GET", "/api/projects/{project_id}/specifications"),
        ("GET", "/api/specifications/{specification_id}"),
        ("PATCH", "/api/specifications/{specification_id}"),
        ("DELETE", "/api/specifications/{specification_id}"),
        ("POST", "/api/projects/{project_id}/specifications/non-functional"),
        ("PUT", "/api/projects/{project_id}/srs-document-meta"),
        ("GET", "/api/projects/{project_id}/specification-document"),
        ("POST", "/api/projects/{project_id}/specification-document/export"),
    }
    routes = [
        (method.upper(), path)
        for path, operations in client.app.openapi()["paths"].items()
        for method in operations
    ]
    missing = expected.difference(routes)
    assert not missing, "Missing routes: " + ", ".join(
        f"{method} {path}" for method, path in sorted(missing)
    )
    assert all(routes.count(route) == 1 for route in expected)


def _setup_project(db_session):
    user = User(
        email="stage1@example.com",
        name="Stage One",
        google_id="stage-one-google-id",
    )
    db_session.add(user)
    db_session.flush()
    project = Project(name="Stage One Project", user_id=user.id)
    db_session.add(project)
    db_session.commit()
    db_session.refresh(user)
    db_session.refresh(project)
    token = auth._sign({"uid": user.id, "exp": time.time() + 60})
    return project, {"Authorization": f"Bearer {token}"}


def _requirement_payload(project_id):
    return {
        "actor": "Khách hàng",
        "action": "đặt",
        "target_object": "đơn hàng",
        "purpose": "mua được sản phẩm",
        "pre_conditions": ["Đã đăng nhập"],
        "business_rules": ["Giỏ hàng không rỗng"],
    }


def _functional_spec(function_code="FR-001", function_name="Quản lý hồ sơ"):
    return {
        "function_code": function_code,
        "function_name": function_name,
        "description": "Cập nhật thông tin hồ sơ.",
        "actors": ["Nhân viên"],
        "priority": "Must",
        "pre_conditions": ["Đã đăng nhập."],
        "main_flow": ["1. Người dùng mở hồ sơ."],
        "alternative_flows": [],
        "exception_flows": [],
        "post_conditions": ["Hồ sơ được cập nhật."],
        "business_rules": [],
        "field_mapping": [
            {
                "field_name": "Email",
                "data_type": "String",
                "required": True,
                "validation_rule": "Phải đúng định dạng email.",
            }
        ],
    }


def _nonfunctional_spec():
    groups = [
        "Hiệu năng & Dung lượng",
        "Bảo mật & An toàn",
        "Độ tin cậy & Khả dụng",
        "Khả năng bảo trì & Mở rộng",
        "Khả năng sử dụng & Tương thích",
    ]
    return {
        "items": [
            {"group": group, "criteria": "Có thể kiểm thử.", "requirement": "Cần xác nhận."}
            for group in groups
        ]
    }


def test_project_endpoints_use_database_project_records(client, db_session):
    original, headers = _setup_project(db_session)
    listed = client.get("/api/projects", headers=headers)
    assert listed.status_code == 200
    assert any(project["id"] == original.id for project in listed.json())

    created = client.post(
        "/api/projects",
        json={"name": "Project persisted in the database"},
        headers=headers,
    )
    assert created.status_code == 201
    assert set(created.json()) == {"id", "name", "created_at"}
    assert db_session.get(Project, created.json()["id"]).name == "Project persisted in the database"


def test_stage1_persists_requirement_analyzes_and_confirms(client, db_session):
    project, headers = _setup_project(db_session)

    response = client.post(
        f"/api/projects/{project.id}/requirements",
        json=_requirement_payload(project.id),
        headers=headers,
    )
    assert response.status_code == 201
    requirement_id = response.json()["id"]
    stored = db_session.get(RawRequirement, requirement_id)
    assert stored is not None
    assert stored.status == "draft"
    assert json.loads(stored.content)["target_object"] == "đơn hàng"

    with patch(
        "services.ollama.generate_content",
        return_value=json.dumps(
            {
                "is_complete": True,
                "missing_elements": [],
                "feedback": "Đã đủ thông tin.",
            },
            ensure_ascii=False,
        ),
    ) as ollama:
        analyzed = client.post(
            f"/api/requirements/{requirement_id}/analyze",
            headers=headers,
        )
    assert analyzed.status_code == 200
    assert analyzed.json()["is_complete"] is True
    assert "Khách hàng" in ollama.call_args.args[0]
    db_session.refresh(stored)
    assert stored.status == "draft"

    update_payload = _requirement_payload(project.id)
    update_payload["purpose"] = "mua hàng nhanh hơn"
    updated = client.patch(
        f"/api/requirements/{requirement_id}",
        json=update_payload,
        headers=headers,
    )
    assert updated.status_code == 200
    db_session.refresh(stored)
    assert json.loads(stored.content)["purpose"] == "mua hàng nhanh hơn"
    assert stored.status == "draft"

    confirmed = client.post(
        f"/api/requirements/{requirement_id}/confirm",
        headers=headers,
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["feature"] == "đặt đơn hàng"
    assert confirmed.json()["acceptance_criteria"] == ""
    db_session.refresh(stored)
    assert stored.status == "confirmed"
    assert db_session.query(UserStory).filter_by(requirement_id=requirement_id).count() == 1


def test_stage1_validates_requirement_and_confirmation_is_idempotent(client, db_session):
    project, headers = _setup_project(db_session)
    invalid = _requirement_payload(project.id)
    invalid["actor"] = "   "
    assert (
        client.post(
            f"/api/projects/{project.id}/requirements",
            json=invalid,
            headers=headers,
        ).status_code
        == 422
    )

    response = client.post(
        f"/api/projects/{project.id}/requirements",
        json=_requirement_payload(project.id),
        headers=headers,
    )
    requirement_id = response.json()["id"]
    first = client.post(f"/api/requirements/{requirement_id}/confirm", headers=headers)
    second = client.post(f"/api/requirements/{requirement_id}/confirm", headers=headers)
    assert first.status_code == second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert db_session.query(UserStory).filter_by(requirement_id=requirement_id).count() == 1


def test_stage1_generates_edits_versions_and_lists_specifications(client, db_session):
    project, headers = _setup_project(db_session)
    requirement = RawRequirement(
        project_id=project.id,
        content=json.dumps(
            {
                "actor": "Nhân viên",
                "action": "quản lý",
                "target_object": "hồ sơ",
                "purpose": "cập nhật dữ liệu",
                "pre_conditions": [],
                "business_rules": [],
            }
        ),
        status="confirmed",
    )
    db_session.add(requirement)
    db_session.flush()
    story = UserStory(
        requirement_id=requirement.id,
        role="Nhân viên",
        feature="quản lý hồ sơ",
        benefit="cập nhật dữ liệu",
        acceptance_criteria="",
    )
    db_session.add(story)
    db_session.commit()
    db_session.refresh(story)

    with patch(
        "services.ollama.generate_content",
        return_value=json.dumps(_functional_spec(), ensure_ascii=False),
    ) as ollama:
        functional = client.post(
            f"/api/user-stories/{story.id}/specifications",
            json={"type": "functional"},
            headers=headers,
        )
        regenerated = client.post(
            f"/api/user-stories/{story.id}/specifications",
            json={"type": "functional"},
            headers=headers,
        )
    assert functional.json()["version"] == 1
    assert regenerated.status_code == 409
    ollama.assert_called_once()
    assert ollama.call_args.kwargs["json_response"] is True
    assert "FR-001" in ollama.call_args.args[0]
    assert "không phải Use Case" in ollama.call_args.args[0]
    assert "chưa có, hãy suy luận tiêu chí kiểm thử hợp lý" in ollama.call_args.args[0]

    specification_id = functional.json()["id"]
    invalid_edit = client.patch(
        f"/api/specifications/{specification_id}",
        json={"content": {"function_code": "UC01"}},
        headers=headers,
    )
    assert invalid_edit.status_code == 422
    assert db_session.get(Specification, specification_id).version == 1

    edited_content = _functional_spec(function_name="Hồ sơ đã được sửa tay")
    edited = client.patch(
        f"/api/specifications/{specification_id}",
        json={"content": edited_content},
        headers=headers,
    )
    assert edited.status_code == 200
    assert json.loads(edited.json()["content"])["function_name"] == "Hồ sơ đã được sửa tay"
    assert edited.json()["version"] == 2
    ollama.assert_called_once()

    with patch(
        "services.ollama.generate_content",
        return_value=json.dumps(
            _functional_spec(function_name="Đặc tả do AI tạo lại"),
            ensure_ascii=False,
        ),
    ) as ollama:
        regenerated = client.post(
            f"/api/user-stories/{story.id}/specifications",
            json={"type": "functional", "regenerate": True},
            headers=headers,
        )
    assert regenerated.status_code == 201
    assert json.loads(regenerated.json()["content"])["function_name"] == "Đặc tả do AI tạo lại"
    assert regenerated.json()["version"] == 2
    assert db_session.query(Specification).filter_by(id=specification_id).count() == 1
    ollama.assert_called_once()

    with patch(
        "services.ollama.generate_content",
        return_value=json.dumps(_nonfunctional_spec(), ensure_ascii=False),
    ) as ollama:
        non_functional = client.post(
            f"/api/projects/{project.id}/specifications/non-functional",
            headers=headers,
        )
        non_functional_again = client.post(
            f"/api/projects/{project.id}/specifications/non-functional",
            headers=headers,
        )
    with patch(
        "services.ollama.generate_content",
        return_value=json.dumps(
            {
                "items": [
                    {
                        **item,
                        "requirement": f"{item['requirement']} Đã tạo lại.",
                    }
                    for item in _nonfunctional_spec()["items"]
                ]
            },
            ensure_ascii=False,
        ),
    ) as ollama:
        non_functional_regenerated = client.post(
            f"/api/projects/{project.id}/specifications/non-functional?regenerate=true",
            headers=headers,
        )
    assert non_functional.status_code == 201
    assert non_functional.json()["user_story_id"] is None
    assert non_functional.json()["version"] == 1
    assert non_functional_again.status_code == 409
    assert non_functional_regenerated.status_code == 201
    assert non_functional_regenerated.json()["id"] == non_functional.json()["id"]
    assert non_functional_regenerated.json()["version"] == 1
    ollama.assert_called_once()

    listed = client.get(
        f"/api/projects/{project.id}/specifications",
        headers=headers,
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 2
    assert {item["type"] for item in listed.json()} == {
        "functional",
        "non_functional",
    }
    assert db_session.query(Specification).count() == 2

    requirements = client.get(
        f"/api/projects/{project.id}/requirements",
        headers=headers,
    )
    assert requirements.status_code == 200
    assert requirements.json()[0]["user_story"]["id"] == story.id

    document = client.get(
        f"/api/projects/{project.id}/specification-document",
        headers=headers,
    )
    assert document.status_code == 200
    assert "Đặc tả do AI tạo lại" in document.json()["raw_markdown"]
    assert "3.2 Đặc tả phi chức năng" in document.json()["raw_markdown"]

    export = client.post(
        f"/api/projects/{project.id}/specification-document/export",
        json={"format": "md"},
        headers=headers,
    )
    assert export.status_code == 422


def test_metadata_and_word_only_export(client, db_session):
    project, headers = _setup_project(db_session)
    requirement = RawRequirement(
        project_id=project.id,
        content=json.dumps(_requirement_payload(project.id), ensure_ascii=False),
        status="confirmed",
    )
    db_session.add(requirement)
    db_session.flush()
    story = UserStory(
        requirement_id=requirement.id,
        role="Quản lý",
        feature="Quản lý tài khoản",
        benefit="Dữ liệu chính xác",
        acceptance_criteria="Tài khoản được cập nhật.",
    )
    db_session.add(story)
    db_session.commit()
    db_session.refresh(story)

    db_session.add(
        Specification(
            user_story_id=story.id,
            type="functional",
            content=json.dumps(_functional_spec("UC01", "Tài khoản"), ensure_ascii=False),
            version=1,
        )
    )
    db_session.commit()

    metadata = {
        "intro_purpose": "Mục đích",
        "intro_scope": "Phạm vi",
        "intro_definitions": "Thuật ngữ",
        "overview_user_classes": "Quản lý",
        "overview_environment": "Trình duyệt web",
        "appendix_notes": "Ghi chú",
    }
    saved_meta = client.put(
        f"/api/projects/{project.id}/srs-document-meta",
        json=metadata,
        headers=headers,
    )
    assert saved_meta.status_code == 200
    document = client.get(
        f"/api/projects/{project.id}/specification-document",
        headers=headers,
    )
    assert [section["number"] for section in document.json()["sections"]] == [
        "1", "2", "3", "4",
    ]
    assert document.json()["metadata"] == metadata

    word_file = client.post(
        f"/api/projects/{project.id}/specification-document/export",
        json={"format": "docx"},
        headers=headers,
    )
    rejected_pdf = client.post(
        f"/api/projects/{project.id}/specification-document/export",
        json={"format": "pdf"},
        headers=headers,
    )
    assert word_file.status_code == 409
    assert "baseline" in word_file.json()["detail"].lower()
    assert rejected_pdf.status_code == 422


def test_batch_analysis_and_confirmation_persist_all_draft_requirements(client, db_session):
    project, headers = _setup_project(db_session)
    requirement_ids = []
    for _ in range(2):
        response = client.post(
            f"/api/projects/{project.id}/requirements",
            json=_requirement_payload(project.id),
            headers=headers,
        )
        assert response.status_code == 201
        requirement_ids.append(response.json()["id"])

    complete = json.dumps(
        {"is_complete": True, "missing_elements": [], "feedback": "Đầy đủ."},
        ensure_ascii=False,
    )
    with patch("services.ollama.generate_content", return_value=complete):
        analyzed = client.post(
            f"/api/projects/{project.id}/requirements/analyze-batch",
            headers=headers,
        )
    assert analyzed.status_code == 200
    assert {item["requirement_id"] for item in analyzed.json()["results"]} == set(requirement_ids)
    assert all(item["is_complete"] for item in analyzed.json()["results"])

    with patch("services.ollama.generate_content", return_value=complete):
        confirmed = client.post(
            f"/api/projects/{project.id}/requirements/confirm-batch",
            json={"requirement_ids": requirement_ids},
            headers=headers,
        )
    assert confirmed.status_code == 200
    assert len(confirmed.json()) == 2
    assert {story["requirement_id"] for story in confirmed.json()} == set(requirement_ids)
    assert db_session.query(UserStory).count() == 2
    assert db_session.query(RawRequirement).filter_by(status="confirmed").count() == 2


def test_requirement_coverage_suggests_missing_features_and_saves_only_selected(client, db_session):
    project, headers = _setup_project(db_session)
    existing = client.post(
        f"/api/projects/{project.id}/requirements",
        json=_requirement_payload(project.id),
        headers=headers,
    )
    suggestion = {
        **_requirement_payload(project.id),
        "actor": "Quản trị viên",
        "action": "quản lý",
        "target_object": "tài khoản",
        "purpose": "kiểm soát quyền truy cập",
        "reason": "Hệ thống cần có chức năng quản trị tài khoản.",
    }
    result_json = {
        "is_sufficient": False,
        "summary": "Còn thiếu chức năng quản trị.",
        "suggestions": [suggestion],
    }
    with patch(
        "services.ollama.generate_content",
        return_value=json.dumps(result_json, ensure_ascii=False),
    ) as ollama:
        checked = client.post(
            f"/api/projects/{project.id}/requirements/coverage-check",
            headers=headers,
        )
    assert checked.status_code == 200
    assert checked.json() == result_json
    assert db_session.query(RawRequirement).filter_by(project_id=project.id).count() == 1
    assert project.name in ollama.call_args.args[0]
    assert "đơn hàng" in ollama.call_args.args[0]
    ollama.assert_called_once()
    assert ollama.call_args.kwargs["json_response"] is True

    added = client.post(
        f"/api/projects/{project.id}/requirements/batch",
        json={
            "requirements": [
                {
                    key: value
                    for key, value in suggestion.items()
                    if key != "reason"
                }
            ]
        },
        headers=headers,
    )
    assert added.status_code == 201
    assert len(added.json()) == 1
    assert added.json()[0]["status"] == "draft"
    assert json.loads(added.json()[0]["content"])["target_object"] == "tài khoản"
    assert db_session.query(RawRequirement).filter_by(project_id=project.id).count() == 2


def test_batch_confirmation_rejects_incomplete_item_without_partial_commit(client, db_session):
    project, headers = _setup_project(db_session)
    requirement_ids = []
    for _ in range(2):
        response = client.post(
            f"/api/projects/{project.id}/requirements",
            json=_requirement_payload(project.id),
            headers=headers,
        )
        requirement_ids.append(response.json()["id"])
    incomplete = json.dumps(
        {"is_complete": False, "missing_elements": ["Quy tắc"], "feedback": "Thiếu."},
        ensure_ascii=False,
    )
    with patch("services.ollama.generate_content", side_effect=[json.dumps(
        {"is_complete": True, "missing_elements": [], "feedback": "Đủ."},
        ensure_ascii=False,
    ), incomplete]):
        response = client.post(
            f"/api/projects/{project.id}/requirements/confirm-batch",
            json={"requirement_ids": requirement_ids},
            headers=headers,
        )
    assert response.status_code == 409
    assert db_session.query(UserStory).count() == 0
    assert db_session.query(RawRequirement).filter_by(status="draft").count() == 2


def test_ai_user_story_preview_can_be_reviewed_and_confirmed(client, db_session):
    project, headers = _setup_project(db_session)
    created = client.post(
        f"/api/projects/{project.id}/requirements",
        json=_requirement_payload(project.id),
        headers=headers,
    )
    requirement_id = created.json()["id"]
    generated_story = {
        "role": "Khách hàng",
        "feature": "Đặt đơn hàng",
        "benefit": "Mua được sản phẩm dễ dàng",
        "acceptance_criteria": "Đơn hàng được tạo thành công.",
    }
    with patch(
        "services.ollama.generate_content",
        return_value=json.dumps(generated_story, ensure_ascii=False),
    ) as ollama:
        preview = client.post(
            f"/api/projects/{project.id}/requirements/user-stories/preview",
            headers=headers,
        )
    assert preview.status_code == 200
    assert preview.json()["results"] == [
        {"requirement_id": requirement_id, **generated_story}
    ]
    assert "không tự tạo" in ollama.call_args.args[0].lower()
    assert db_session.query(UserStory).count() == 0

    approved_story = {
        "requirement_id": requirement_id,
        **generated_story,
        "acceptance_criteria": "Đơn hàng được tạo và hiển thị cho khách hàng.",
    }
    confirmed = client.post(
        f"/api/projects/{project.id}/requirements/confirm-batch",
        json={
            "requirement_ids": [requirement_id],
            "user_stories": [approved_story],
        },
        headers=headers,
    )
    assert confirmed.status_code == 200
    assert confirmed.json()[0]["acceptance_criteria"] == approved_story["acceptance_criteria"]
    assert db_session.query(UserStory).filter_by(requirement_id=requirement_id).count() == 1
    assert db_session.get(RawRequirement, requirement_id).status == "confirmed"


def test_batch_spec_generation_only_creates_missing_functional_specs(client, db_session):
    project, headers = _setup_project(db_session)
    requirement = RawRequirement(
        project_id=project.id,
        content=json.dumps({
            "actor": "Người dùng",
            "action": "xem",
            "target_object": "báo cáo",
            "purpose": "theo dõi",
            "pre_conditions": [],
            "business_rules": [],
        }),
        status="confirmed",
    )
    db_session.add(requirement)
    db_session.flush()
    first_story = UserStory(requirement_id=requirement.id, role="Người dùng", feature="xem báo cáo")
    second_story = UserStory(requirement_id=requirement.id, role="Quản lý", feature="xuất báo cáo")
    db_session.add_all([first_story, second_story])
    db_session.flush()
    db_session.add(Specification(
        user_story_id=first_story.id,
        type="functional",
        content="Đã có",
        version=1,
    ))
    db_session.commit()

    with patch(
        "services.ollama.generate_content",
        return_value=json.dumps(_functional_spec("FR-002", "Xuất báo cáo"), ensure_ascii=False),
    ) as ollama:
        response = client.post(
            f"/api/projects/{project.id}/user-stories/generate-specs-batch",
            headers=headers,
        )
        again = client.post(
            f"/api/projects/{project.id}/user-stories/generate-specs-batch",
            headers=headers,
        )
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["user_story_id"] == second_story.id
    assert response.json()[0]["type"] == "functional"
    assert again.json() == []
    ollama.assert_called_once()



def test_requirement_revision_history_and_restore(client, db_session):
    project, headers = _setup_project(db_session)
    created = client.post(
        f"/api/projects/{project.id}/requirements",
        json=_requirement_payload(project.id),
        headers=headers,
    )
    assert created.status_code == 201
    requirement_id = created.json()["id"]

    updated_payload = _requirement_payload(project.id)
    updated_payload["purpose"] = "theo dõi và quản lý đơn hàng"
    updated = client.patch(
        f"/api/requirements/{requirement_id}",
        json=updated_payload,
        headers=headers,
    )
    assert updated.status_code == 200

    history_url = (
        f"/api/projects/{project.id}/entities/raw_requirement/"
        f"{requirement_id}/revisions"
    )
    history = client.get(history_url, headers=headers)
    assert history.status_code == 200
    revisions = history.json()
    assert [item["version"] for item in revisions] == [2, 1]

    restored = client.post(
        f"{history_url}/1/restore",
        json={"change_note": "Khôi phục nội dung ban đầu"},
        headers=headers,
    )
    assert restored.status_code == 200
    assert restored.json()["restored_from_version"] == 1
    assert restored.json()["current_version"] == 3

    latest_history = client.get(history_url, headers=headers)
    assert latest_history.status_code == 200
    assert latest_history.json()[0]["change_type"] == "restore"
