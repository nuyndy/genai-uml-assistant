from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.uml_generator import router as uml_router
from routers.requirement import router as requirement_router

app = FastAPI(title="GenAI UML Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(uml_router)
app.include_router(requirement_router)

@app.get("/")
async def root():
    return {"message": "GenAI UML Assistant API is running!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)