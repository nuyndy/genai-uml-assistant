from pydantic import BaseModel, ConfigDict, Field, field_validator


class RequirementFields(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    actor: str = Field(min_length=1)
    action: str = Field(min_length=1)
    target_object: str = Field(min_length=1)
    purpose: str = Field(min_length=1)
    pre_conditions: list[str] = Field(default_factory=list)
    business_rules: list[str] = Field(default_factory=list)

    @field_validator("pre_conditions", "business_rules")
    @classmethod
    def clean_list_items(cls, values: list[str]) -> list[str]:
        cleaned = [value.strip() for value in values]
        if any(not value for value in cleaned):
            raise ValueError("Danh sách không được chứa mục rỗng.")
        return cleaned


class RequirementInput(RequirementFields):
    project_id: int = Field(gt=0)


class RequirementUpdate(RequirementFields):
    pass


class RequirementCoverageSuggestion(RequirementFields):
    reason: str = Field(min_length=1)


class RequirementCoverageAnalysis(BaseModel):
    is_sufficient: bool
    summary: str = Field(min_length=1)
    suggestions: list[RequirementCoverageSuggestion] = Field(max_length=10)


class RequirementBatchInput(BaseModel):
    requirements: list[RequirementUpdate] = Field(min_length=1, max_length=20)


class RequirementAnalysis(BaseModel):
    is_complete: bool
    missing_elements: list[str]
    feedback: str


class RequirementBatchAnalysisItem(RequirementAnalysis):
    requirement_id: int


class RequirementBatchAnalysis(BaseModel):
    results: list[RequirementBatchAnalysisItem]


class ConfirmRequirementsBatch(BaseModel):
    requirement_ids: list[int] = Field(min_length=1)
    user_stories: list["UserStoryDraft"] | None = None


class UserStoryDraftContent(BaseModel):
    """Nội dung user story do AI sinh ra.

    KHÔNG chứa `requirement_id`: AI không bao giờ được yêu cầu sinh id này (id là
    dữ kiện của hệ thống, không phải nội dung văn bản). Router tự gắn
    `requirement_id` của yêu cầu đang xử lý sau khi AI trả về. Tách riêng khỏi
    `UserStoryDraft` để việc kiểm tra đầu ra AI không đòi một trường mà AI không
    có trách nhiệm sinh ra.
    """

    role: str = Field(min_length=1)
    feature: str = Field(min_length=1)
    benefit: str = Field(min_length=1)
    acceptance_criteria: str = Field(min_length=1)

    model_config = ConfigDict(str_strip_whitespace=True)


class UserStoryDraft(UserStoryDraftContent):
    requirement_id: int = Field(gt=0)


class UserStoryDraftBatch(BaseModel):
    results: list[UserStoryDraft]


class RequirementRecord(BaseModel):
    id: int
    project_id: int
    content: str
    status: str
    user_story: "UserStoryRecord | None" = None


class UserStoryUpdate(BaseModel):
    role: str | None
    feature: str = Field(min_length=1)
    benefit: str | None
    acceptance_criteria: str | None

    model_config = ConfigDict(str_strip_whitespace=True)


class UserStoryRecord(BaseModel):
    id: int
    role: str | None
    feature: str
    benefit: str | None
    acceptance_criteria: str | None
    requirement_id: int | None = None

    model_config = ConfigDict(from_attributes=True)


RequirementRecord.model_rebuild()
ConfirmRequirementsBatch.model_rebuild()
