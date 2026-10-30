from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.requirement import router as requirement_router
from routers.specification import router as specification_router
from routers.projects import router as projects_router
from routers.baseline import router as baseline_router
from routers.uml import router as uml_router
from routers.srs import router as srs_router
from routers.auth import router as auth_router
from database.db import Base, engine
from database import models

app = FastAPI(title="GenAI UML Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# create_all chỉ tạo các bảng còn thiếu cho môi trường mới; không dùng nó để
# thay đổi schema hiện hữu. Mọi thay đổi schema phải nằm trong migrations/.
Base.metadata.create_all(bind=engine)

app.include_router(auth_router)
app.include_router(requirement_router)
app.include_router(specification_router)
app.include_router(projects_router)
app.include_router(uml_router)
app.include_router(srs_router)
app.include_router(baseline_router)


@app.get("/")
async def root():
    return {"message": "GenAI UML Assistant API is running!"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
