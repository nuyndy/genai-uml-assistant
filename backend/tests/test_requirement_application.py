import json

import pytest

from application.requirements import (
    RequirementConflictError,
    create_requirement,
    delete_requirement,
    list_requirements,
    update_requirement,
)
from database.models import Project, RawRequirement, User
from schemas.requirement import RequirementUpdate


def _setup(db_session):
    user = User(
        email="requirements-app@example.com",
        name="Requirements App",
        google_id="requirements-app-google-id",
    )
    db_session.add(user)
    db_session.flush()
    project = Project(name="Requirements Application", user_id=user.id)
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return user, project


def _payload(purpose="Mua được sản phẩm"):
    return RequirementUpdate(
        actor="Khách hàng",
        action="đặt",
        target_object="đơn hàng",
        purpose=purpose,
        pre_conditions=["Đã đăng nhập"],
        business_rules=["Giỏ hàng không rỗng"],
    )


def test_create_and_list_requirements_through_application(db_session):
    user, project = _setup(db_session)

    created = create_requirement(
        db_session,
        project_id=project.id,
        data=_payload(),
        user_id=user.id,
    )
    listed = list_requirements(db_session, project.id)

    assert created.status == "draft"
    assert json.loads(created.content)["target_object"] == "đơn hàng"
    assert len(listed) == 1
    assert listed[0].id == created.id


def test_update_requirement_through_application_records_new_content(db_session):
    user, project = _setup(db_session)
    created = create_requirement(
        db_session,
        project_id=project.id,
        data=_payload(),
        user_id=user.id,
    )

    updated = update_requirement(
        db_session,
        requirement_id=created.id,
        data=_payload("Xử lý đơn hàng thuận tiện"),
        user_id=user.id,
    )

    assert json.loads(updated.content)["purpose"] == "Xử lý đơn hàng thuận tiện"


def test_delete_requirement_through_application(db_session):
    user, project = _setup(db_session)
    created = create_requirement(
        db_session,
        project_id=project.id,
        data=_payload(),
        user_id=user.id,
    )

    delete_requirement(
        db_session,
        requirement_id=created.id,
        user_id=user.id,
    )

    assert db_session.get(RawRequirement, created.id) is None


def test_confirmed_requirement_cannot_be_updated_or_deleted(db_session):
    user, project = _setup(db_session)
    created = create_requirement(
        db_session,
        project_id=project.id,
        data=_payload(),
        user_id=user.id,
    )
    created.status = "confirmed"
    db_session.commit()

    with pytest.raises(RequirementConflictError):
        update_requirement(
            db_session,
            requirement_id=created.id,
            data=_payload("Không được phép sửa"),
            user_id=user.id,
        )

    with pytest.raises(RequirementConflictError):
        delete_requirement(
            db_session,
            requirement_id=created.id,
            user_id=user.id,
        )
