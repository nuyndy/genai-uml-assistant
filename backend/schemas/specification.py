from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, model_validator

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
    function_code: str = Field(min_length=1)
    function_name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    actors: list[str]
    priority: Literal["Must", "Should", "Could", "Won't"]
    pre_conditions: list[str]
    main_flow: list[str]
    alternative_flows: list[str]
    exception_flows: list[str]
    post_conditions: list[str]
    business_rules: list[str]
    field_mapping: list[FieldMapping]

    # Bỏ qua khóa lạ do AI thêm vào thay vì từ chối cả đặc tả: model nhỏ
    # thường chèn thêm khóa mô tả, chặn cứng sẽ làm hỏng nội dung đúng.
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


class NonFunctionalItem(BaseModel):
    group: str = Field(min_length=1)
    criteria: str = Field(min_length=1)
    requirement: str = Field(min_length=1)

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

    model_config = ConfigDict(from_attributes=True)


class SpecificationDocument(BaseModel):
    sections: list[dict[str, Any]]
    raw_markdown: str
