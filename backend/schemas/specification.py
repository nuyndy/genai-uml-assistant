from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator, model_validator

from services.spec_generator import NONFUNCTIONAL_GROUPS


SpecificationType = Literal["functional", "non_functional"]


class GenerateSpecificationInput(BaseModel):
    type: SpecificationType
    regenerate: bool = False


class SpecificationUpdate(BaseModel):
    content: str | dict[str, Any]

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class FieldMapping(BaseModel):
    field_name: str = Field(min_length=1)
    data_type: str = Field(min_length=1)
    required: StrictBool
    validation_rule: str = Field(min_length=1)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class FunctionalSpecification(BaseModel):
    function_code: str = ""
    function_name: str = ""
    description: str = ""
    actors: list[str] = Field(default_factory=list)
    process: list[str] = Field(default_factory=list)
    input_data: list[str] = Field(default_factory=list)
    processing_rules: list[str] = Field(default_factory=list)
    output_data: list[str] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)
    business_rules: list[str] = Field(default_factory=list)
    field_mapping: list[FieldMapping] = Field(default_factory=list)
    source_user_story_ids: list[int] = Field(default_factory=list)
    # Legacy fields accepted to read existing records; new FR forms do not use them.
    priority: Literal["Must", "Should", "Could", "Won't"] | None = None
    pre_conditions: list[str] = Field(default_factory=list)
    main_flow: list[str] = Field(default_factory=list)
    alternative_flows: list[str] = Field(default_factory=list)
    exception_flows: list[str] = Field(default_factory=list)
    post_conditions: list[str] = Field(default_factory=list)
    minimal_guarantee: str = ""
    @field_validator("function_code")
    @classmethod
    def validate_function_code(cls, value: str) -> str:
        # Empty values remain readable for legacy records; newly supplied codes
        # must use the FR identifier namespace, never the former UC namespace.
        if value and not __import__("re").fullmatch(r"FR-\d{3,}", value):
            raise ValueError("Mã đặc tả chức năng phải có dạng FR-001.")
        return value

    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


class FunctionalSpecificationBatch(BaseModel):
    items: list[FunctionalSpecification] = Field(min_length=1)
    model_config = ConfigDict(extra="forbid")


class NonFunctionalItem(BaseModel):
    group: str = Field(min_length=1)
    criteria: str = ""
    requirement: str = ""
    metric: str = ""
    conditions: str = ""
    verification_method: str = ""
    scope: str = ""
    source: str = ""
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


class NonFunctionalSpecification(BaseModel):
    items: list[NonFunctionalItem]

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def require_fixed_groups(self) -> "NonFunctionalSpecification":
        groups = tuple(item.group for item in self.items)
        if groups != NONFUNCTIONAL_GROUPS:
            raise ValueError("Các nhóm phi chức năng phải đúng 5 nhóm đã quy định.")
        return self


class SrsDocumentMetaInput(BaseModel):
    intro_purpose: str
    intro_scope: str
    intro_definitions: str
    overview_user_classes: str
    overview_environment: str
    appendix_notes: str

    model_config = ConfigDict(extra="forbid")


class SpecificationDocumentExportInput(BaseModel):
    format: Literal["docx"]

    model_config = ConfigDict(extra="forbid")


class SpecificationRecord(BaseModel):
    id: int
    user_story_id: int | None
    feature: str
    type: SpecificationType
    content: str
    version: int
    approval_status: Literal["draft", "approved"] = "draft"

    model_config = ConfigDict(from_attributes=True)


class SpecificationApprovalResult(BaseModel):
    specification_id: int
    approval_status: Literal["draft", "approved"]
    approved_at: str | None = None


class SpecificationDocument(BaseModel):
    sections: list[dict[str, Any]]
    raw_markdown: str
