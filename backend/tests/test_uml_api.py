import json
import time
from unittest.mock import patch

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
from services.plantuml import PlantUMLRenderError


def test_standard_stage_two_routes_are_registered_once(client):
    expected = {
        ("POST", "/api/projects/{project_id}/actors"),
        ("GET", "/api/projects/{project_id}/actors"),
        ("PATCH", "/api/actors/{actor_id}"),
        ("DELETE", "/api/actors/{actor_id}"),
        ("POST", "/api/specifications/{specification_id}/use-cases"),
        ("GET", "/api/projects/{project_id}/use-cases"),
        ("GET", "/api/use-cases/{use_case_id}"),
        ("PATCH", "/api/use-cases/{use_case_id}"),
        ("DELETE", "/api/use-cases/{use_case_id}"),
        ("POST", "/api/use-cases/{use_case_id}/generate-scenario"),
        ("POST", "/api/projects/{project_id}/use-cases/generate-scenarios-batch"),
        ("POST", "/api/specifications/{specification_id}/extract-actors-usecases"),
        ("POST", "/api/projects/{project_id}/extract-actors-usecases-batch"),
        ("POST", "/api/projects/{project_id}/actors-use-cases/batch"),
        ("POST", "/api/use-cases/{use_case_id}/actor-relations"),
        ("GET", "/api/use-cases/{use_case_id}/actor-relations"),
        ("DELETE", "/api/actor-relations/{relation_id}"),
        ("POST", "/api/projects/{project_id}/classes"),
        ("GET", "/api/projects/{project_id}/classes"),
        ("PATCH", "/api/classes/{class_id}"),
        ("DELETE", "/api/classes/{class_id}"),
        ("POST", "/api/projects/{project_id}/generate-classes"),
        ("POST", "/api/classes/{class_id}/relations"),
        ("GET", "/api/projects/{project_id}/class-relations"),
        ("DELETE", "/api/class-relations/{relation_id}"),
        ("POST", "/api/projects/{project_id}/diagrams/use-case"),
        ("POST", "/api/projects/{project_id}/diagrams/class"),
        ("POST", "/api/use-cases/{use_case_id}/diagrams"),
        ("POST", "/api/projects/{project_id}/use-cases/generate-interaction-diagrams-batch"),
        ("GET", "/api/projects/{project_id}/diagrams"),
        ("GET", "/api/diagrams/{diagram_id}"),
        ("PATCH", "/api/diagrams/{diagram_id}"),
        ("DELETE", "/api/diagrams/{diagram_id}"),
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


def _project_with_specification(db_session):
    user = User(
        email="uml-stage@example.com",
        name="UML Stage",
        google_id="uml-stage-google-id",
    )
    db_session.add(user)
    db_session.flush()
    project = Project(name="UML Stage Project", user_id=user.id)
    db_session.add(project)
    db_session.flush()
    requirement = RawRequirement(
        project_id=project.id,
        content=json.dumps(
            {
                "actor": "Khách hàng",
                "action": "đặt",
                "target_object": "đơn hàng",
                "purpose": "mua sản phẩm",
                "pre_conditions": [],
                "business_rules": [],
            },
            ensure_ascii=False,
        ),
        status="confirmed",
    )
    db_session.add(requirement)
    db_session.flush()
    story = UserStory(
        requirement_id=requirement.id,
        role="Khách hàng",
        feature="đặt đơn hàng",
        benefit="mua sản phẩm",
        acceptance_criteria="",
    )
    db_session.add(story)
    db_session.flush()
    specification = Specification(
        user_story_id=story.id,
        type="functional",
        content="Khách hàng xem sản phẩm, đặt hàng và nhận xác nhận.",
        version=1,
    )
    db_session.add(specification)
    db_session.commit()
    db_session.refresh(project)
    db_session.refresh(specification)
    token = auth._sign({"uid": user.id, "exp": time.time() + 60})
    return project, specification, {"Authorization": f"Bearer {token}"}


def test_stage_two_full_api_flow_persists_project_uml_data(client, db_session):
    project, specification, headers = _project_with_specification(db_session)

    candidates = client.get(
        f"/api/projects/{project.id}/specifications-with-stories",
        headers=headers,
    )
    assert candidates.status_code == 200
    assert [item["id"] for item in candidates.json()] == [specification.id]
    assert candidates.json()[0]["user_story"]["feature"] == "đặt đơn hàng"

    with patch(
        "services.ollama.generate_content",
        return_value=json.dumps(
            {
                "suggested_actors": [{"name": "Khách hàng"}],
                "suggested_use_cases": [
                    {
                        "name": "Đặt đơn hàng",
                        "description": "Khách hàng chọn sản phẩm và xác nhận đơn.",
                    }
                ],
            },
            ensure_ascii=False,
        ),
    ):
        suggestions = client.post(
            f"/api/specifications/{specification.id}/extract-actors-usecases",
            headers=headers,
        )
    assert suggestions.status_code == 200
    assert suggestions.json()["suggested_actors"] == [{"name": "Khách hàng"}]

    actor_response = client.post(
        f"/api/projects/{project.id}/actors",
        json={"name": "Khách hàng"},
        headers=headers,
    )
    assert actor_response.status_code == 201
    actor_id = actor_response.json()["id"]
    use_case_response = client.post(
        f"/api/specifications/{specification.id}/use-cases",
        json={"name": "Đặt đơn hàng"},
        headers=headers,
    )
    assert use_case_response.status_code == 201
    use_case_id = use_case_response.json()["id"]
    assert use_case_response.json()["main_flow"] == []

    relation_response = client.post(
        f"/api/use-cases/{use_case_id}/actor-relations",
        json={"actor_id": actor_id, "relation_type": "association"},
        headers=headers,
    )
    assert relation_response.status_code == 200
    assert relation_response.json()["use_case_id"] == use_case_id

    with patch("routers.uml.render_plantuml", return_value="data:image/svg+xml;base64,PHN2Zz4="):
        use_case_diagram = client.post(
            f"/api/projects/{project.id}/diagrams/use-case",
            headers=headers,
        )
    assert use_case_diagram.status_code == 201
    assert use_case_diagram.json()["type"] == "use_case"
    assert use_case_diagram.json()["use_case_id"] is None
    assert "Đặt đơn hàng" in use_case_diagram.json()["source_code"]

    with patch(
        "services.ollama.generate_content",
        return_value=json.dumps(
            {
                "main_flow": ["Khách hàng chọn sản phẩm", "Hệ thống xác nhận đơn hàng"],
                "alt_flow": ["Khách hàng thay đổi giỏ hàng"],
                "exception_flow": ["Sản phẩm hết hàng"],
            },
            ensure_ascii=False,
        ),
    ):
        generated_scenario = client.post(
            f"/api/use-cases/{use_case_id}/generate-scenario",
            headers=headers,
        )
    assert generated_scenario.status_code == 200
    assert len(generated_scenario.json()["main_flow"]) == 2

    edited_scenario = client.patch(
        f"/api/use-cases/{use_case_id}",
        json={
            "main_flow": ["Khách hàng chọn sản phẩm", "Đơn hàng được lưu"],
            "alt_flow": ["Khách hàng quay lại"],
            "exception_flow": ["Không thể thanh toán"],
        },
        headers=headers,
    )
    assert edited_scenario.status_code == 200
    assert edited_scenario.json()["main_flow"][-1] == "Đơn hàng được lưu"

    with patch("routers.uml.render_plantuml", return_value="https://render.local/sequence.svg"):
        interaction = client.post(
            f"/api/use-cases/{use_case_id}/diagrams",
            json={"diagram_type": "sequence"},
            headers=headers,
        )
    assert interaction.status_code == 201
    assert interaction.json()["use_case_id"] == use_case_id
    assert interaction.json()["type"] == "sequence"

    with patch(
        "services.ollama.generate_content",
        return_value=json.dumps(
            {
                "classes": [
                    {
                        "name": "DonHang",
                        "attributes": ["maDon: int"],
                        "methods": ["xacNhan()"],
                    },
                    {
                        "name": "SanPham",
                        "attributes": ["ten: str"],
                        "methods": ["kiemTraTonKho()"],
                    },
                ],
                "relations": [
                    {
                        "class_a": "DonHang",
                        "class_b": "SanPham",
                        "relation_type": "aggregation",
                    }
                ],
            },
            ensure_ascii=False,
        ),
    ):
        class_result = client.post(
            f"/api/projects/{project.id}/generate-classes",
            headers=headers,
        )
    assert class_result.status_code == 200
    assert {item["name"] for item in class_result.json()} == {
        "DonHang",
        "SanPham",
    }
    with patch("routers.uml.render_plantuml", return_value="data:image/svg+xml;base64,PHN2Zz4="):
        class_diagram = client.post(
            f"/api/projects/{project.id}/diagrams/class",
            headers=headers,
        )
    assert class_diagram.status_code == 201
    assert class_diagram.json()["type"] == "class"

    saved = client.get(f"/api/projects/{project.id}/uml-state", headers=headers)
    assert saved.status_code == 200
    assert len(saved.json()["actors"]) == 1
    assert len(saved.json()["use_cases"]) == 1
    assert len(saved.json()["relations"]) == 1
    assert len(saved.json()["diagrams"]) == 3
    assert len(saved.json()["classes"]) == 2
    assert len(saved.json()["class_relations"]) == 1
    assert db_session.query(Actor).count() == 1
    assert db_session.query(UseCase).count() == 1
    assert db_session.query(UcActorRelation).count() == 1
    assert db_session.query(Diagram).count() == 3
    assert db_session.query(ClassEntity).count() == 2
    assert db_session.query(ClassRelation).count() == 1
    no_longer_available = client.get(
        f"/api/projects/{project.id}/specifications-with-stories",
        headers=headers,
    )
    assert no_longer_available.status_code == 200
    assert no_longer_available.json() == []
    listed_actors = client.get(f"/api/projects/{project.id}/actors", headers=headers)
    assert listed_actors.status_code == 200
    assert listed_actors.json()[0]["id"] == actor_id


def test_unconfigured_plantuml_renderer_returns_explicit_error_without_fake_diagram(
    client, db_session, monkeypatch
):
    project, specification, headers = _project_with_specification(db_session)
    actor = Actor(project_id=project.id, name="Khách hàng")
    db_session.add(actor)
    db_session.flush()
    use_case = UseCase(
        specification_id=specification.id,
        name="Đặt đơn hàng",
        main_flow=json.dumps(["Chọn sản phẩm"]),
        alt_flow="[]",
        exception_flow="[]",
    )
    db_session.add(use_case)
    db_session.commit()
    monkeypatch.delenv("PLANTUML_RENDER_URL", raising=False)

    with patch(
        "routers.uml.render_plantuml",
        side_effect=PlantUMLRenderError(
            "Chưa cấu hình dịch vụ render PlantUML. Cần cấu hình PlantUML render service."
        ),
    ):
        response = client.post(
            f"/api/projects/{project.id}/diagrams/use-case",
            headers=headers,
        )
    assert response.status_code == 503
    assert "plantuml render service" in response.json()["detail"].lower()
    pending_use_case_diagram = db_session.query(Diagram).one()
    assert pending_use_case_diagram.type == "use_case"
    assert pending_use_case_diagram.image_url is None
    assert "Đặt đơn hàng" in pending_use_case_diagram.source_code

    with patch(
        "services.ollama.generate_content",
        return_value=json.dumps(
            {
                "classes": [
                    {"name": "DonHang", "attributes": ["maDon"], "methods": ["xacNhan()"]}
                ],
                "relations": [],
            },
            ensure_ascii=False,
        ),
    ):
        classes_response = client.post(
            f"/api/projects/{project.id}/generate-classes",
            headers=headers,
        )
    assert classes_response.status_code == 200
    with patch(
        "routers.uml.render_plantuml",
        side_effect=PlantUMLRenderError("Cần cấu hình PlantUML render service."),
    ):
        class_response = client.post(
            f"/api/projects/{project.id}/diagrams/class",
            headers=headers,
        )
    assert class_response.status_code == 503
    assert db_session.query(ClassEntity).filter_by(name="DonHang").count() == 1
    pending_diagrams = db_session.query(Diagram).order_by(Diagram.id).all()
    assert len(pending_diagrams) == 2
    assert pending_diagrams[-1].type == "class"
    assert pending_diagrams[-1].image_url is None
    assert "DonHang" in pending_diagrams[-1].source_code


def test_delete_actor_and_usecase_clean_up_database_dependents(client, db_session):
    project, specification, headers = _project_with_specification(db_session)
    actor = Actor(project_id=project.id, name="Khách hàng")
    use_case = UseCase(
        specification_id=specification.id,
        name="Đặt đơn hàng",
        main_flow="[]",
        alt_flow="[]",
        exception_flow="[]",
    )
    db_session.add_all([actor, use_case])
    db_session.commit()
    db_session.refresh(actor)
    db_session.refresh(use_case)
    relation = UcActorRelation(
        use_case_id=use_case.id,
        actor_id=actor.id,
        relation_type="association",
    )
    diagram = Diagram(
        project_id=project.id,
        use_case_id=use_case.id,
        type="sequence",
        source_code="@startuml\n@enduml",
        image_url="data:image/svg+xml;base64,PHN2Zz4=",
        version=1,
    )
    db_session.add_all([relation, diagram])
    db_session.commit()

    deleted_actor = client.delete(f"/api/actors/{actor.id}", headers=headers)
    assert deleted_actor.status_code == 204
    assert db_session.query(Actor).filter_by(id=actor.id).count() == 0
    assert db_session.query(UcActorRelation).filter_by(actor_id=actor.id).count() == 0

    deleted_use_case = client.delete(f"/api/use-cases/{use_case.id}", headers=headers)
    assert deleted_use_case.status_code == 204
    assert db_session.query(UseCase).filter_by(id=use_case.id).count() == 0
    assert db_session.query(Diagram).filter_by(use_case_id=use_case.id).count() == 0


def test_stage_two_batch_extract_save_scenarios_and_diagrams(client, db_session):
    project, specification, headers = _project_with_specification(db_session)
    suggestions_payload = json.dumps(
        {
            "suggested_actors": [{"name": "Khách hàng"}, {"name": " khách hàng "}],
            "suggested_use_cases": [
                {
                    "specification_id": specification.id,
                    "name": "Đặt đơn hàng",
                    "description": "Chọn sản phẩm và xác nhận đơn.",
                }
            ],
        },
        ensure_ascii=False,
    )
    with patch("services.ollama.generate_content", return_value=suggestions_payload):
        suggestions = client.post(
            f"/api/projects/{project.id}/extract-actors-usecases-batch",
            headers=headers,
        )
    assert suggestions.status_code == 200
    assert len(suggestions.json()["suggested_actors"]) == 1
    assert suggestions.json()["suggested_use_cases"][0]["specification_id"] == specification.id

    saved = client.post(
        f"/api/projects/{project.id}/actors-use-cases/batch",
        json={
            "actors": [{"name": "Khách hàng"}],
            "use_cases": [{"specification_id": specification.id, "name": "Đặt đơn hàng"}],
            "relations": [{
                "specification_id": specification.id,
                "use_case_name": "Đặt đơn hàng",
                "actor_name": "Khách hàng",
                "relation_type": "association",
            }],
        },
        headers=headers,
    )
    assert saved.status_code == 201
    assert len(saved.json()["actors"]) == 1
    assert len(saved.json()["use_cases"]) == 1
    assert len(saved.json()["relations"]) == 1
    use_case_id = saved.json()["use_cases"][0]["id"]

    scenario_payload = json.dumps(
        {
            "results": [{
                "use_case_id": use_case_id,
                "main_flow": ["Chọn sản phẩm", "Xác nhận đơn"],
                "alt_flow": ["Sửa giỏ hàng"],
                "exception_flow": ["Sản phẩm hết hàng"],
            }]
        },
        ensure_ascii=False,
    )
    with patch("services.ollama.generate_content", return_value=scenario_payload):
        scenarios = client.post(
            f"/api/projects/{project.id}/use-cases/generate-scenarios-batch",
            headers=headers,
        )
    assert scenarios.status_code == 200
    assert scenarios.json()["results"][0]["use_case_id"] == use_case_id
    # Item batch phải tự mô tả đủ use case (đồng bộ với UseCaseRecord),
    # không chỉ có use_case_id.
    assert scenarios.json()["results"][0]["name"] == saved.json()["use_cases"][0]["name"]
    assert scenarios.json()["results"][0]["specification_id"] == specification.id
    assert db_session.get(UseCase, use_case_id).main_flow == json.dumps(
        ["Chọn sản phẩm", "Xác nhận đơn"],
        ensure_ascii=False,
    )

    with patch("routers.uml.render_plantuml", return_value="https://render.local/sequence.svg"):
        diagrams = client.post(
            f"/api/projects/{project.id}/use-cases/generate-interaction-diagrams-batch",
            json={"diagram_type": "sequence"},
            headers=headers,
        )
    assert diagrams.status_code == 201
    assert len(diagrams.json()) == 1
    assert diagrams.json()[0]["use_case_id"] == use_case_id
    assert diagrams.json()[0]["image_url"] == "https://render.local/sequence.svg"
    assert db_session.query(Diagram).filter_by(use_case_id=use_case_id, type="sequence").count() == 1


def test_scenario_batch_fills_in_use_cases_the_ai_omitted(client, db_session):
    """Model nhỏ hay bỏ sót use case khi sinh kịch bản theo lô.

    Endpoint phải giữ kết quả hợp lệ, sinh bù riêng cho use case còn thiếu và
    trả về đủ kịch bản, thay vì trả lỗi 502 "AI không trả đúng một kịch bản".
    """
    project, specification, headers = _project_with_specification(db_session)
    first = UseCase(
        specification_id=specification.id,
        name="Đặt đơn hàng",
        main_flow="[]",
        alt_flow="[]",
        exception_flow="[]",
    )
    second = UseCase(
        specification_id=specification.id,
        name="Hủy đơn hàng",
        main_flow="[]",
        alt_flow="[]",
        exception_flow="[]",
    )
    db_session.add_all([first, second])
    db_session.commit()
    db_session.refresh(first)
    db_session.refresh(second)

    # Lượt gọi batch cố tình chỉ trả một use case; lượt gọi bù trả cho use case kia.
    batch_only_first = json.dumps(
        {
            "results": [{
                "use_case_id": first.id,
                "main_flow": ["Chọn sản phẩm"],
                "alt_flow": [],
                "exception_flow": [],
            }]
        },
        ensure_ascii=False,
    )
    single_fallback = json.dumps(
        {
            "main_flow": ["Mở chi tiết đơn"],
            "alt_flow": ["Xác nhận hủy"],
            "exception_flow": ["Đơn đã giao"],
        },
        ensure_ascii=False,
    )

    # Sinh kịch bản đi qua generate_json (có retry), nên phải chọn phản hồi theo
    # nội dung prompt thay vì theo thứ tự gọi, tránh lệch khi có lần thử lại.
    def fake_generate(prompt: str, **_kwargs) -> str:
        return single_fallback if "USE CASE:" in prompt else batch_only_first

    with patch("services.ollama.generate_content", side_effect=fake_generate):
        response = client.post(
            f"/api/projects/{project.id}/use-cases/generate-scenarios-batch",
            headers=headers,
        )

    assert response.status_code == 200
    results = {item["use_case_id"]: item for item in response.json()["results"]}
    assert set(results) == {first.id, second.id}
    # Cả item do AI trả về lẫn item sinh bù phải đều có name/specification_id đúng,
    # đây chính là chỗ trước kia lệch với UseCaseRecord.
    assert results[first.id]["name"] == first.name
    assert results[first.id]["specification_id"] == first.specification_id
    assert results[second.id]["name"] == second.name
    assert results[second.id]["specification_id"] == second.specification_id
    # API commit ở session khác, nên đọc lại từ DB thay vì dùng bản cache cũ.
    db_session.expire_all()
    assert db_session.get(UseCase, first.id).main_flow == json.dumps(
        ["Chọn sản phẩm"], ensure_ascii=False
    )
    assert db_session.get(UseCase, second.id).main_flow == json.dumps(
        ["Mở chi tiết đơn"], ensure_ascii=False
    )
    assert db_session.get(UseCase, second.id).alt_flow == json.dumps(
        ["Xác nhận hủy"], ensure_ascii=False
    )


def test_interaction_diagram_uses_project_actor_when_use_case_has_no_relation(
    client, db_session
):
    """Use case chưa gán tác nhân vẫn phải sinh được biểu đồ tương tác.

    Trước đây endpoint trả 409 "Use case ... chưa được liên kết với tác nhân",
    chặn cả lô chỉ vì một use case mồ côi. Biểu đồ tương tác luôn cần một tác
    nhân khởi động, nên hệ thống phải tự dùng tác nhân của dự án.
    """
    project, specification, headers = _project_with_specification(db_session)
    actor = Actor(project_id=project.id, name="Khách hàng")
    use_case = UseCase(
        specification_id=specification.id,
        name="Đặt đơn hàng",
        main_flow=json.dumps(["Chọn sản phẩm"], ensure_ascii=False),
        alt_flow="[]",
        exception_flow="[]",
    )
    db_session.add_all([actor, use_case])
    db_session.commit()
    db_session.refresh(actor)
    db_session.refresh(use_case)
    # Cố ý KHÔNG tạo UcActorRelation: mô phỏng dữ liệu use case mồ côi.

    with patch("routers.uml.render_plantuml", return_value="https://render.local/uc.svg"):
        response = client.post(
            f"/api/projects/{project.id}/use-cases/generate-interaction-diagrams-batch",
            json={"diagram_type": "sequence"},
            headers=headers,
        )

    assert response.status_code == 201
    assert len(response.json()) == 1
    assert response.json()[0]["use_case_id"] == use_case.id
    # Tác nhân dự phòng của dự án phải xuất hiện trong mã PlantUML.
    assert "Khách hàng" in response.json()[0]["source_code"]


def test_interaction_diagram_reports_clearly_when_project_has_no_actor(
    client, db_session
):
    """Dự án hoàn toàn không có tác nhân: báo lỗi nói rõ phải làm gì ở Bước 1."""
    project, specification, headers = _project_with_specification(db_session)
    use_case = UseCase(
        specification_id=specification.id,
        name="Đặt đơn hàng",
        main_flow=json.dumps(["Chọn sản phẩm"], ensure_ascii=False),
        alt_flow="[]",
        exception_flow="[]",
    )
    db_session.add(use_case)
    db_session.commit()

    with patch("routers.uml.render_plantuml", return_value="https://render.local/uc.svg"):
        response = client.post(
            f"/api/projects/{project.id}/use-cases/generate-interaction-diagrams-batch",
            json={"diagram_type": "sequence"},
            headers=headers,
        )

    assert response.status_code == 409
    assert "chưa có tác nhân" in response.json()["detail"].lower()
