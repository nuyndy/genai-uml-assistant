import { Card, SoftButton, PrimaryButton, EmptyState } from "../../../common/ui/primitives";

interface ActorItem {
  id: number;
  name: string;
}

interface UseCaseItem {
  id: number;
  name: string;
  description?: string;
  specificationId?: number;
}

interface SuggestedActor {
  token: string;
  name: string;
}

interface SuggestedUseCase {
  token: string;
  specification_id: number;
  name: string;
  description: string;
}

interface Suggestions {
  actors: SuggestedActor[];
  useCases: SuggestedUseCase[];
}

interface Props {
  projectId?: number;
  requirements: ActorItem[]; // tác nhân đã lưu (state.actors)
  requirementValues: UseCaseItem[]; // use case đã lưu (state.usecases)
  analyses: Suggestions; // gợi ý từ AI
  loadingAnalysis: boolean;
  busy: boolean;
  loaded?: boolean;
  error?: string;
  runBatchAnalysis: () => void | Promise<void>;
  onConfirm: () => void;
  confirmed: boolean;
  onStepChange: (step: number) => void;
  requirementTitle?: (raw: never) => string;
  wrapClass: string;
}

export default function Step1ActorUseCase({
  requirements: actors,
  requirementValues: useCases,
  analyses: suggestions,
  loadingAnalysis,
  busy,
  runBatchAnalysis,
  onConfirm,
  confirmed,
  onStepChange,
  wrapClass,
}: Props) {
  const hasSuggestions = suggestions.actors.length > 0 || suggestions.useCases.length > 0;

  return (
    <div className="space-y-6">
      <Card
        tone="amber"
        title="Tác nhân và use case"
        actions={
          <SoftButton disabled={busy || loadingAnalysis} onClick={() => void runBatchAnalysis()}>
            {hasSuggestions || actors.length > 0 ? "Phân tích lại đặc tả" : "Phân tích đặc tả"}
          </SoftButton>
        }
      >
        {loadingAnalysis ? (
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            Đang trích xuất tác nhân và use case từ đặc tả chức năng...
          </p>
        ) : actors.length === 0 && useCases.length === 0 && !hasSuggestions ? (
          <EmptyState
            title="Chưa có tác nhân hoặc use case"
            hint="Bấm “Phân tích đặc tả” để AI gợi ý tác nhân và use case từ đặc tả chức năng."
          />
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Tác nhân đã lưu ({actors.length})
              </h3>
              {actors.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Chưa có tác nhân nào.</p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {actors.map((actor) => (
                    <li key={actor.id} className={wrapClass}>
                      {actor.name}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Use case đã lưu ({useCases.length})
              </h3>
              {useCases.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Chưa có use case nào.</p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {useCases.map((useCase) => (
                    <li key={useCase.id} className={wrapClass}>
                      {useCase.name}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {hasSuggestions && (
              <>
                <section className="min-w-0 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <h3 className="text-sm font-semibold text-amber-900">
                    Tác nhân gợi ý ({suggestions.actors.length})
                  </h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                    {suggestions.actors.map((actor) => (
                      <li key={actor.token} className={wrapClass}>
                        {actor.name}
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="min-w-0 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <h3 className="text-sm font-semibold text-amber-900">
                    Use case gợi ý ({suggestions.useCases.length})
                  </h3>
                  <ul className="mt-2 space-y-2 text-sm text-amber-900">
                    {suggestions.useCases.map((useCase) => (
                      <li key={useCase.token} className={wrapClass}>
                        <p className="font-medium">{useCase.name}</p>
                        {useCase.description && (
                          <p className="text-xs text-amber-800">{useCase.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500" role="status">
            {confirmed
              ? "Danh sách Actor và Use Case đã được xác nhận trong phiên làm việc."
              : "Rà soát danh sách đã lưu trước khi xác nhận. Gợi ý AI chưa tự động trở thành dữ liệu chính thức."}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <SoftButton
              disabled={busy || loadingAnalysis || actors.length === 0 || useCases.length === 0}
              onClick={onConfirm}
            >
              {confirmed ? "Đã xác nhận danh sách" : "Xác nhận Actor và Use Case"}
            </SoftButton>
            <PrimaryButton
              disabled={busy || loadingAnalysis || !confirmed}
              onClick={() => onStepChange(2)}
            >
              Tiếp tục sang Bước 2
            </PrimaryButton>
          </div>
        </div>
      </Card>
    </div>
  );
}