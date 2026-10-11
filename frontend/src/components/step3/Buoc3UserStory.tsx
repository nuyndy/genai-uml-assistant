import React from "react";
import {
  Card,
  EmptyState,
  PrimaryButton,
  SoftButton,
  StatusBadge,
  inputClass,
  wrapClass,
} from "../ui/primitives";
import type { UserStory, UserStoryDraft } from "../../types/workflow"; // adjust path as needed
import type { RawRequirement } from "../../types/workflow";

interface Props {
  draftRequirements: UserStory[]; // Actually requirements, but using type for placeholder
  storyDrafts: Record<number, UserStoryDraft>;
  requirementValues: Record<number, RawRequirement>;
  loadingStoryDrafts: boolean;
  busy: boolean;
  allStoryDraftsReady: boolean;
  onGenerateStoryDrafts: () => void;
  onChangeStoryDraft: (requirementId: number, field: keyof UserStoryDraft, value: string) => void;
  onConfirmAll: () => void;
  onStepChange: (step: number) => void;
}

export default function Buoc3UserStory({
  draftRequirements,
  storyDrafts,
  requirementValues,
  loadingStoryDrafts,
  busy,
  allStoryDraftsReady,
  onGenerateStoryDrafts,
  onChangeStoryDraft,
  onConfirmAll,
  onStepChange,
}: Props) {
  return (
    <div className="space-y-5">
      <Card tone="violet" title="Kiểm duyệt User Story">
        <p className="text-sm text-slate-700">
          Bản nháp User Story từ các yêu cầu đã nhập. Kiểm tra và chỉnh sửa nội dung chưa phù hợp trước khi
          xác nhận.
        </p>
      </Card>
      {draftRequirements.length === 0 ? (
        <EmptyState title="Chưa có yêu cầu để rà soát" hint="Quay lại Bước 1 để thêm yêu cầu." />
      ) : (
        <>
          <Card tone="violet" title="Bản nháp User Story do AI " subtitle="Được tạo từ
            yêu cầu
            ."
            actions="".
            }
          </Card>
        </>
      )}
    </div>
  );
}
