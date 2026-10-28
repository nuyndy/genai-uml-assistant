from typing import Literal
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator


RelationType = Literal["association", "include", "extend", "generalization"]
InteractionDiagramType = Literal["sequence", "collaboration"]
DiagramType = Literal["use_case", "class", "sequence", "collaboration"]


class ActorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)

    model_config = ConfigDict(str_strip_whitespace=True)


class ActorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    role: str | None = None
    main_businesses: str | None = None

    model_config = ConfigDict(str_strip_whitespace=True)


class ActorRecord(BaseModel):
    id: int
    project_id: int
    name: str
    description: str | None = None
    role: str | None = None
    main_businesses: str | None = None

    model_config = ConfigDict(from_attributes=True)


class UseCaseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)

    model_config = ConfigDict(str_strip_whitespace=True)


class UseCaseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    actor: str | None = None
    description: str | None = None
    preconditions: str | None = None
    minimal_guarantees: str | None = None
    postconditions: str | None = None
    main_flow: list[str] | None = None
    alt_flow: list[str] | None = None
    exception_flow: list[str] | None = None

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("main_flow", "alt_flow", "exception_flow")
    @classmethod
    def validate_nonempty_lines(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        cleaned = [value.strip() for value in values]
        if any(not value for value in cleaned):
            raise ValueError("Các bước kịch bản không được để trống.")
        return cleaned


class UseCaseRecord(BaseModel):
    id: int
    specification_id: int
    name: str
    actor: str | None = None
    description: str | None = None
    preconditions: str | None = None
    minimal_guarantees: str | None = None
    postconditions: str | None = None
    main_flow: list[str]
    alt_flow: list[str]
    exception_flow: list[str]


class UseCaseScenarioSuggestion(BaseModel):
    # Sinh đủ thông tin đặc tả kịch bản, không chỉ ba luồng xử lý.
    actor: list[str] = Field(min_length=1)
    description: list[str] = Field(min_length=1)
    preconditions: list[str] = Field(min_length=1)
    minimal_guarantees: list[str] = Field(min_length=1)
    postconditions: list[str] = Field(min_length=1)
    main_flow: list[str] = Field(min_length=1)
    alt_flow: list[str] = Field(default_factory=list)
    exception_flow: list[str] = Field(default_factory=list)

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator(
        "actor", "description", "preconditions", "minimal_guarantees",
        "postconditions", "main_flow", "alt_flow", "exception_flow",
    )
    @classmethod
    def validate_nonempty_lines(cls, values: list[str]) -> list[str]:
        cleaned = [value.strip() for value in values]
        if any(not value for value in cleaned):
            raise ValueError("Các trường kịch bản không được chứa dòng trống.")
        return cleaned


class ActorRelationInput(BaseModel):
    actor_id: int = Field(gt=0)
    relation_type: RelationType


class ClassCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    attributes: list[str] = Field(default_factory=list)
    methods: list[str] = Field(default_factory=list)

    model_config = ConfigDict(str_strip_whitespace=True)


class ClassUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    attributes: list[str] | None = None
    methods: list[str] | None = None

    model_config = ConfigDict(str_strip_whitespace=True)


class ClassRelationInput(BaseModel):
    class_b_id: int = Field(gt=0)
    relation_type: str = Field(min_length=1, max_length=100)

    model_config = ConfigDict(str_strip_whitespace=True)


class ClassRelationRecord(BaseModel):
    id: int
    class_a_id: int
    class_b_id: int
    relation_type: str

    model_config = ConfigDict(from_attributes=True)


class ActorRelationRecord(BaseModel):
    id: int
    use_case_id: int
    actor_id: int
    relation_type: RelationType

    model_config = ConfigDict(from_attributes=True)


class SaveActorUseCasesBatchResult(BaseModel):
    actors: list[ActorRecord]
    use_cases: list[UseCaseRecord]
    relations: list[ActorRelationRecord]


class SuggestedActor(BaseModel):
    name: str = Field(min_length=1, max_length=255)

    model_config = ConfigDict(str_strip_whitespace=True)


class SuggestedUseCase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    specification_id: int | None = Field(default=None, gt=0)

    model_config = ConfigDict(str_strip_whitespace=True)


class ExtractActorsUseCasesResult(BaseModel):
    suggested_actors: list[SuggestedActor]
    suggested_use_cases: list[SuggestedUseCase]

class BatchSuggestedUseCase(BaseModel):
    specification_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)

    model_config = ConfigDict(str_strip_whitespace=True)


class ExtractProjectActorsUseCasesResult(BaseModel):
    suggested_actors: list[SuggestedActor]
    suggested_use_cases: list[BatchSuggestedUseCase]


class BatchUseCaseSelection(BaseModel):
    specification_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=255)

    model_config = ConfigDict(str_strip_whitespace=True)


class BatchActorUseCaseRelation(BaseModel):
    specification_id: int = Field(gt=0)
    use_case_name: str = Field(min_length=1, max_length=255)
    actor_name: str = Field(min_length=1, max_length=255)
    relation_type: RelationType

    model_config = ConfigDict(str_strip_whitespace=True)


class SaveActorUseCasesBatch(BaseModel):
    actors: list[ActorCreate]
    use_cases: list[BatchUseCaseSelection]
    relations: list[BatchActorUseCaseRelation] = Field(default_factory=list)

class UseCaseScenarioBatchItem(UseCaseScenarioSuggestion):
    """Kịch bản sinh cho một use case trong lần sinh hàng loạt (Bước 3).

    Giữ ĐỒNG BỘ với `UseCaseRecord`: ngoài `use_case_id` (khoá gốc của use case)
    còn trả kèm `name` và `specification_id`, để frontend không phải phụ thuộc
    vào một lần gọi `uml-state` phụ trợ mới hiển thị được thông tin use case.

    `name` / `specification_id` để mặc định `None` (không bắt buộc) vì đây là
    schema vừa dùng để PHÂN TÍCH JSON do AI trả về (`_ai_json`) — model nhỏ chỉ
    sinh `use_case_id` + kịch bản. Router sẽ tự điền hai trường này từ bản ghi
    đã nạp sẵn trước khi trả cho client.
    """

    use_case_id: int
    name: str | None = None
    specification_id: int | None = None


class UseCaseScenarioBatchResult(BaseModel):
    results: list[UseCaseScenarioBatchItem]


class InteractionDiagramInput(BaseModel):
    diagram_type: InteractionDiagramType


class DiagramRecord(BaseModel):
    id: int
    project_id: int
    use_case_id: int | None
    type: DiagramType
    source_code: str
    image_url: str | None
    version: int

    model_config = ConfigDict(from_attributes=True)


class DiagramUpdate(BaseModel):
    source_code: str = Field(min_length=1)

    model_config = ConfigDict(str_strip_whitespace=True)


class ClassSuggestion(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    # Không chấp nhận kết quả AI chỉ có tên lớp mà thiếu thành viên.
    attributes: list[str] = Field(min_length=2)
    methods: list[str] = Field(min_length=1)

    model_config = ConfigDict(str_strip_whitespace=True)


class ClassRelationSuggestion(BaseModel):
    class_a: str = Field(min_length=1)
    class_b: str = Field(min_length=1)
    relation_type: str = Field(min_length=1, max_length=100)

    model_config = ConfigDict(str_strip_whitespace=True)


class ClassDiagramSuggestion(BaseModel):
    classes: list[ClassSuggestion]
    relations: list[ClassRelationSuggestion] = Field(default_factory=list)


class ClassEntityRecord(BaseModel):
    id: int
    project_id: int
    name: str
    attributes: list[str]
    methods: list[str]


class ClassDiagramResult(BaseModel):
    classes: list[ClassEntityRecord]
    diagram: DiagramRecord


class ProjectUmlState(BaseModel):
    actors: list[ActorRecord]
    use_cases: list[UseCaseRecord]
    relations: list[ActorRelationRecord]
    diagrams: list[DiagramRecord]
    classes: list[ClassEntityRecord]
    class_relations: list[dict[str, int | str]]


class SpecificationStoryRecord(BaseModel):
    id: int
    role: str | None
    feature: str
    benefit: str | None

    model_config = ConfigDict(from_attributes=True)


class SpecificationWithStoryRecord(BaseModel):
    id: int
    user_story_id: int
    type: Literal["functional", "non_functional"]
    content: str
    version: int
    user_story: SpecificationStoryRecord


class DiagramRevisionRecord(BaseModel):
    id: int
    diagram_id: int
    version: int
    source_code: str
    image_url: str | None = None
    change_type: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
