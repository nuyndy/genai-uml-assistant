import logging

from fastapi import Depends, HTTPException, Request
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from application.ownership import resolve_project_id, user_owns_project
from database.db import get_db
from database.models import User
from routers.auth import get_current_user

logger = logging.getLogger(__name__)

_NOT_FOUND_DETAIL = "Không tìm thấy dự án hoặc bạn không có quyền truy cập."


def require_project_owner(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    try:
        project_id = resolve_project_id(
            db,
            request.path_params,
            request.url.path,
        )
        if project_id is None or not user_owns_project(
            db,
            project_id=project_id,
            user_id=current_user.id,
        ):
            raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL)
    except HTTPException:
        raise
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc
    except SQLAlchemyError as exc:
        logger.exception("Could not verify project ownership")
        raise HTTPException(
            status_code=500,
            detail="Không thể kiểm tra quyền truy cập dự án.",
        ) from exc
